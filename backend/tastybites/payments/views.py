import base64
import csv
import datetime
import json
import requests
import re
import uuid
from decimal import Decimal, InvalidOperation
import logging

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.core.files.storage import default_storage # type: ignore
from django.db.models import Q, Sum, F, Count, ExpressionWrapper, DecimalField, Max
from django.db.models.functions import ExtractHour, ExtractWeekDay, TruncDate
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseServerError, HttpResponse
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.core.mail import send_mail
from django.views.decorators.csrf import csrf_exempt
logger = logging.getLogger(__name__)
from datetime import timedelta
from .models import AdminToken, AdminUser, AppSettings, MenuItem, Transaction, Table, Order, OrderItem, WastageLog, Employee, StockLog, AdminSessionLog, MiscellaneousExpense, StaffToken, Review

import threading
import time

# Simple in-memory event queue for Server-Sent Events (SSE).
# This is sufficient for a single-process dev server. For multi-process
# or production use, replace with Redis/Message Broker.
EVENTS_COND = threading.Condition()
EVENTS_QUEUE: list[str] = []

def _emit_event(event_type: str, data: dict):
    try:
        payload = json.dumps({'type': event_type, 'data': data})
    except Exception:
        payload = json.dumps({'type': event_type, 'data': {}})
    with EVENTS_COND:
        EVENTS_QUEUE.append(payload)
        EVENTS_COND.notify_all()

def payments_stream(request):
    """SSE endpoint streaming order events."""
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    def event_generator():
        # On connect, send a small welcome comment to establish the stream
        yield ': connected\n\n'
        last_sent = 0
        while True:
            with EVENTS_COND:
                if not EVENTS_QUEUE:
                    # wait up to 15 seconds for new events
                    EVENTS_COND.wait(timeout=15)
                items = EVENTS_QUEUE.copy()
                EVENTS_QUEUE.clear()
            if items:
                for item in items:
                    yield f"data: {item}\n\n"
            else:
                # keep-alive comment
                yield ': ping\n\n'
            time.sleep(0.1)

    return StreamingHttpResponse(event_generator(), content_type='text/event-stream')


def _normalize_phone(ph: str) -> str:
    digits = ''.join(ch for ch in ph if ch.isdigit())
    # Remove leading + if present (already handled by isdigit, but for clarity)
    if digits.startswith('0'):
        digits = '254' + digits[1:]
    # Handle 9-digit numbers (e.g. 712345678 or 112345678)
    if len(digits) == 9:
        digits = '254' + digits
    return digits


def _display_rate() -> float:
    app_settings = AppSettings.current()
    try:
        return float(app_settings.conversion_rate or getattr(settings, 'MPESA_TO_KES_RATE', 1))
    except (TypeError, ValueError):
        return float(getattr(settings, 'MPESA_TO_KES_RATE', 1))


def _to_display_currency(amount):
    try:
        return float(Decimal(str(amount or 0)) * Decimal(str(_display_rate())))
    except Exception:
        return float(amount or 0)


def _get_oauth_token():
    access_token = cache.get('mpesa_access_token')
    if access_token:
        return access_token

    if getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox') == 'sandbox':
        oauth_url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    else:
        oauth_url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'

    # Ensure credentials are clean of whitespace
    key = settings.MPESA_CONSUMER_KEY.strip()
    secret = settings.MPESA_CONSUMER_SECRET.strip()

    try:
        session = requests.Session()
        headers = {'Accept': 'application/json', 'User-Agent': 'TastyBites/1.0'}
        resp = session.get(oauth_url, auth=(key, secret), headers=headers, timeout=15)
        resp.raise_for_status()
        token_data = resp.json()
        access_token = token_data.get('access_token')
        # Safaricom tokens usually expire in 3600s. Cache for slightly less (3540s).
        expires_in = int(token_data.get('expires_in', 3600))
        cache.set('mpesa_access_token', access_token, expires_in - 60)
        return access_token
    except requests.RequestException as e:
        body = None
        try:
            body = getattr(e, 'response', None) and e.response.text or str(e)
        except Exception:
            body = str(e)
        logger.exception('M-Pesa OAuth request failed: %s', body)
        raise Exception(f"M-Pesa API Auth failed: {body}")
    except json.JSONDecodeError:
        logger.exception('M-Pesa OAuth returned invalid JSON')
        raise Exception("M-Pesa API returned invalid JSON during auth.")
    except Exception as e:
        logger.exception('Unexpected error obtaining M-Pesa OAuth token: %s', e)
        raise Exception(f"An unexpected error occurred while getting M-Pesa OAuth token: {e}")

def _get_token_from_request(request):
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header.split('Bearer ')[1].strip()

    return (
        request.headers.get('X-ADMIN-TOKEN')
        or request.GET.get('admin_token')
        or request.POST.get('admin_token')
    )


def _get_admin_token(request):
    token = _get_token_from_request(request)
    if not token:
        return None

    if token == getattr(settings, 'MPESA_ADMIN_TOKEN', ''):
        return True

    admin_token = AdminToken.objects.filter(token=token).first()
    if admin_token and admin_token.is_valid():
        return admin_token
    return None


def _is_admin(request):
    return bool(_get_admin_token(request))

def _get_staff_token(request):
    token = _get_token_from_request(request)
    if not token:
        return None
    # Admin bypass: If it's a valid admin token, allow it as staff
    if _get_admin_token(request):
        return True
    staff_token = StaffToken.objects.filter(token=token).first()
    if staff_token and staff_token.is_valid():
        return staff_token
    return None

def _is_staff(request):
    return bool(_get_staff_token(request))

def staff_activities(request):
    """Returns a log of recent activities for the staff dashboard."""
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        # Fetch recent orders to show as activity
        orders = Order.objects.all().select_related('table').order_by('-created_at')[:15]
        activities = []

        for o in orders:
            activities.append({
                'id': f"act-{o.order_id[:8]}",
                'type': 'order',
                'title': f"Order {o.status.title()}",
                'description': f"Table {o.table.number if o.table else 'Takeaway'} - KES {o.total_amount}",
                'time': o.created_at.isoformat() if o.created_at else None,
                'status': o.status
            })

        return JsonResponse({'activities': activities})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def _get_period_dates(period_type: str, date_str: str):
    """
    Calculates start and end dates for a report period based on type and a reference date.
    """
    today = timezone.localdate() # Use localdate for consistent day boundaries
    selected_date = None
    if date_str:
        try:
            selected_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            pass # Fallback to today if date_str is invalid

    if not selected_date:
        selected_date = today

    start_date = None
    end_date = None
    label = ""

    if period_type == 'day':
        start_date = timezone.make_aware(datetime.datetime.combine(selected_date, datetime.time.min))
        end_date = timezone.make_aware(datetime.datetime.combine(selected_date, datetime.time.max))
        label = selected_date.strftime('%Y-%m-%d')
    elif period_type == 'week':
        # Find the Monday of the week containing selected_date
        # isoweekday() returns 1 for Monday, 7 for Sunday
        monday_of_week = selected_date - timedelta(days=selected_date.isoweekday() - 1)
        sunday_of_week = monday_of_week + timedelta(days=6)
        start_date = timezone.make_aware(datetime.datetime.combine(monday_of_week, datetime.time.min))
        end_date = timezone.make_aware(datetime.datetime.combine(sunday_of_week, datetime.time.max))
        label = f"Week of {monday_of_week.strftime('%Y-%m-%d')}"
    elif period_type == 'month':
        start_date = timezone.make_aware(datetime.datetime.combine(selected_date.replace(day=1), datetime.time.min))
        next_month = selected_date.replace(day=28) + timedelta(days=4) # Go to 4th day of next month
        last_day_of_month = next_month - timedelta(days=next_month.day)
        end_date = timezone.make_aware(datetime.datetime.combine(last_day_of_month, datetime.time.max))
        label = selected_date.strftime('%Y-%m')
    elif period_type == 'year':
        start_date = timezone.make_aware(datetime.datetime.combine(selected_date.replace(month=1, day=1), datetime.time.min))
        end_date = timezone.make_aware(datetime.datetime.combine(selected_date.replace(month=12, day=31), datetime.time.max))
        label = selected_date.strftime('%Y')
    else: # Default to current week if period_type is unknown
        # Fallback to current week (Monday-Sunday)
        monday_of_week = today - timedelta(days=today.isoweekday() - 1)
        sunday_of_week = monday_of_week + timedelta(days=6)
        start_date = timezone.make_aware(datetime.datetime.combine(monday_of_week, datetime.time.min))
        end_date = timezone.make_aware(datetime.datetime.combine(sunday_of_week, datetime.time.max))
        label = f"Week of {monday_of_week.strftime('%Y-%m-%d')}"

    return start_date, end_date, label

def _execute_stk_push(msisdn, amount, account_ref, tx):
    """Helper to trigger the actual Safaricom API request."""
    shortcode = getattr(settings, 'MPESA_EXPRESS_SHORTCODE', getattr(settings, 'MPESA_SHORTCODE', ''))
    passkey = getattr(settings, 'MPESA_PASSKEY', '')
    callback_url = getattr(settings, 'MPESA_CALLBACK_URL', '')

    # Safaricom Daraja API strictly requires an HTTPS callback URL.
    # It will reject 127.0.0.1, localhost, or plain HTTP with a 400 error.
    if not callback_url or not callback_url.startswith('https://'):


        tx.status = 'error'
        tx.raw_response = {'error': 'invalid_callback', 'message': f'Invalid Callback URL: "{callback_url}". Safaricom requires a public HTTPS URL. Please set up ngrok as per NGROK.md.'}
        tx.save()
        return tx.raw_response, 400

    try:
        token = _get_oauth_token()
    except Exception as e:
        tx.status = 'error'
        tx.raw_response = {'error': f'Auth failed: {str(e)}'}
        tx.save()
        return {'error': f'Failed to get oauth token: {e}'}, 500

    timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
    raw_password = f"{shortcode}{passkey}{timestamp}"
    password = base64.b64encode(raw_password.encode()).decode()

    stk_url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest' if getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox') == 'sandbox' else 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'

    session = requests.Session()
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'TastyBites/1.0'}
    
    # Safaricom strictly requires alphanumeric characters with NO spaces for AccountReference
    # We use regex to strip everything except letters and numbers
    account_reference = re.sub(r'[^a-zA-Z0-9]', '', account_ref)[:12] or 'TASTYBITES'
    transaction_desc = re.sub(r'[^a-zA-Z0-9]', '', f"Pay{account_ref}")[:20] or 'Payment'

    body = {
        'BusinessShortCode': shortcode,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': 'CustomerPayBillOnline',
        'Amount': int(float(amount)) if float(amount) >= 1 else 1, # Safaricom requires an integer
        'PartyA': msisdn,
        'PartyB': shortcode,
        'PhoneNumber': msisdn,
        'CallBackURL': callback_url,
        'AccountReference': account_reference,
        'TransactionDesc': transaction_desc,
    }

    try:
        r = session.post(stk_url, json=body, headers=headers, timeout=30)
        # Safaricom often returns 400/401/500 with a JSON body explaining why
        try:
            resp_json = r.json()
        except Exception:
            resp_json = {'error': 'non_json_response', 'raw': r.text}

        crid = resp_json.get('CheckoutRequestID')
        mrid = resp_json.get('MerchantRequestID')

        tx.checkout_request_id = crid
        tx.merchant_request_id = mrid
        tx.raw_response = resp_json

        # Safaricom returns ResponseCode '0' for success.
        # Any other code or a non-200 HTTP status means rejection.
        if r.status_code == 200 and str(resp_json.get('ResponseCode')) == '0':
            tx.status = 'pending'
            tx.save()
            logger.info('STK push initiated successfully: CheckoutRequestID=%s MerchantRequestID=%s', crid, mrid)
            return resp_json, 200
        else:
            tx.status = 'error'
            tx.save()
            # Capture the most descriptive error message possible from Safaricom
            error_msg = (
                resp_json.get('errorMessage') or
                resp_json.get('error') or
                resp_json.get('ResponseDescription') or
                f"M-Pesa server error (Status {r.status_code}). Please verify your Daraja App credentials and environment settings."
            )
            logger.error('STK push rejected: status=%s response=%s', r.status_code, resp_json)
            return {'error': 'stk_rejected', 'message': error_msg, 'details': resp_json}, 400
    except Exception as e:
        tx.status = 'error'
        tx.raw_response = {'error': str(e)}
        tx.save()
        logger.exception('STK Push failed with exception: %s', e)
        return {'error': f'STK Push failed: {str(e)}'}, 500


@csrf_exempt
def stk_push(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    phone = payload.get('phone')
    try:
        amount = Decimal(str(payload.get('amount') or '1'))
    except (ValueError, TypeError):
        amount = Decimal('1.00')

    account_ref = str(payload.get('item') or 'Order')
    callback_url = getattr(settings, 'MPESA_CALLBACK_URL', '')

    if not phone:
        return JsonResponse({'error': 'Phone number is required'}, status=400)

    msisdn = _normalize_phone(phone)
    if not msisdn.startswith('254') or len(msisdn) < 12:
        return JsonResponse({'error': 'Invalid phone number format'}, status=400)

    tx = Transaction.objects.create(
        phone=msisdn,
        amount=amount,
        item=account_ref,
        status='pending',
        method=Transaction.METHOD_M_PESA,
    )

    resp_json, status_code = _execute_stk_push(msisdn, amount, account_ref, tx)
    return JsonResponse(resp_json, status=status_code)


@csrf_exempt
def stk_callback(request):
    # Daraja will POST callback JSON here
    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest('Invalid JSON')

    # Typical payload: { "Body": { "stkCallback": { ... } } }
    body = payload.get('Body', {})
    stk = body.get('stkCallback') or {}
    merchant_id = stk.get('MerchantRequestID')
    checkout_id = stk.get('CheckoutRequestID')
    result_code = stk.get('ResultCode')
    result_desc = stk.get('ResultDesc')

    # find transaction by checkout or merchant id
    tx = None
    if checkout_id:
        tx = Transaction.objects.filter(checkout_request_id=checkout_id).first()
    if not tx and merchant_id:
        tx = Transaction.objects.filter(merchant_request_id=merchant_id).first()

    details = stk.get('CallbackMetadata', {})

    if tx:
        tx.raw_response = payload
        # Normalize result_code which may be string or int
        try:
            rc = int(result_code)
        except Exception:
            try:
                rc = int(str(result_code).strip())
            except Exception:
                rc = None

        tx.status = 'success' if rc == 0 else 'failed'
        tx.method = Transaction.METHOD_M_PESA
        # Try to extract receipt and amount from CallbackMetadata for easier debugging
        try:
            cb_meta = stk.get('CallbackMetadata') or {}
            items = cb_meta.get('Item') if isinstance(cb_meta, dict) else None
            if items and isinstance(items, list):
                for item in items:
                    name = item.get('Name') or item.get('name')
                    if name and name.lower() in ('mpesa_receipt_number', 'receipt'):
                        tx.mpesa_receipt = item.get('Value')
                    if name and name.lower() in ('amount',):
                        try:
                            tx.amount = Decimal(str(item.get('Value') or tx.amount))
                        except Exception:
                            pass
        except Exception:
            logger.debug('Failed to parse CallbackMetadata for tx=%s', tx.id)

        tx.save()
        # If this transaction is linked to an order, and the order is now fully paid,
        # mark the order as paid so reports can rely on completed orders.
        try:
            if tx.order and tx.order.is_paid:
                tx.order.status = 'paid'
                tx.order.save()
                if tx.order.table:
                    tx.order.table.status = Table.STATUS_AVAILABLE
                    tx.order.table.save(update_fields=['status'])

                # Emit SSE event so admin/cashier UIs update immediately
                try:
                    _emit_event('order_update', {'order_id': tx.order.order_id, 'status': 'paid'})
                except Exception:
                    logger.debug('Failed to emit SSE event for order %s', tx.order.order_id)
        except Exception:
            # protect callback from crashing if DB-side logic fails
            pass
    else:
        # create a record if not found
        Transaction.objects.create(
            merchant_request_id=merchant_id,
            checkout_request_id=checkout_id,
            phone='',
            amount=Decimal('0.00'),
            item='callback',
            status='success' if result_code == 0 else 'failed',
            method=Transaction.METHOD_M_PESA,
            raw_response=payload,
        )

    return JsonResponse({'status': 'ok'})


def payment_status(request):
    # Query by checkout_id param
    checkout_id = request.GET.get('checkout_id')
    if not checkout_id:
        return HttpResponseBadRequest('checkout_id required')

    tx = Transaction.objects.filter(checkout_request_id=checkout_id).first()
    if not tx:
        return JsonResponse({'status': 'not_found'})

    return JsonResponse({'status': tx.status, 'raw': tx.raw_response})


def config(request):
    app_settings = AppSettings.current()
    # Conversion rate is still returned for frontend pricing calculations.
    return JsonResponse({
        'base_currency': 'KES',
        'display_currency': 'KES',
        'conversion_rate': float(app_settings.conversion_rate),
        'delivery_rate_per_km': float(app_settings.delivery_rate_per_km),
        'min_delivery_fee': float(app_settings.min_delivery_fee),
    })


@csrf_exempt
def admin_signup(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    username = (payload.get('username') or '').strip()
    password = (payload.get('password') or '').strip()

    if not username or not password:
        return JsonResponse({'error': 'username and password are required'}, status=400)

    users_exist = AdminUser.objects.exists()
    if users_exist and not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if AdminUser.objects.filter(username=username).exists():
        return JsonResponse({'error': 'username already exists'}, status=400)

    try:
        user = AdminUser(username=username)
        user.set_password(password)
        user.save()

        if not users_exist:
            log = AdminSessionLog.objects.create(user=user)
            # Set initial expiry to 4 hours
            expiry = timezone.now() + timedelta(hours=4)
            token = AdminToken.objects.create(user=user, session_log=log, expires_at=expiry)
            return JsonResponse({'token': token.token, 'username': user.username})
    except Exception as e:
        return JsonResponse({
            'error': f'Signup failed: {str(e)}. Please ensure migrations are applied with "python manage.py migrate".'
        }, status=500)

    return JsonResponse({'ok': True, 'username': user.username})


@csrf_exempt
def upload_image(request):
    """Handles image file uploads for menu items."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    image_file = request.FILES.get('image')
    if not image_file:
        return JsonResponse({'error': 'no_image_provided'}, status=400)
    
    path = default_storage.save(f'menu_items/{uuid.uuid4().hex}_{image_file.name}', image_file)
    url = request.build_absolute_uri(settings.MEDIA_URL + path)
    return JsonResponse({'url': url})

@csrf_exempt
def staff_signin(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')
    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    username = (payload.get('username') or '').strip()
    password = (payload.get('password') or '').strip()

    if not username or not password:
        return JsonResponse({'error': 'username and password are required'}, status=400)

    emp = Employee.objects.filter(username=username).first()
    if not emp or not emp.check_password(password):
        return JsonResponse({'error': 'Invalid credentials.'}, status=401)

    expiry = timezone.now() + timedelta(hours=8)
    token = StaffToken.objects.create(employee=emp, expires_at=expiry)
    
    return JsonResponse({
        'token': token.token,
        'name': emp.name,
        'role': emp.role
    })

@csrf_exempt
def admin_signin(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    username = (payload.get('username') or '').strip()
    password = (payload.get('password') or '').strip()

    if not username or not password:
        return JsonResponse({'error': 'username and password are required'}, status=400)

    try:
        user = AdminUser.objects.filter(username=username).first()
        lockout_length = timedelta(minutes=5)
        max_attempts = 3

        if user:
            if user.lockout_until and user.lockout_until > timezone.now():
                remaining = int((user.lockout_until - timezone.now()).total_seconds())
                return JsonResponse(
                    {
                        'error': 'Too many failed attempts. Please wait before signing in again.',
                        'lockout_seconds': remaining,
                    },
                    status=429,
                )

        if not user or not user.check_password(password):
            if user:
                user.failed_login_attempts += 1
                if user.failed_login_attempts >= max_attempts:
                    user.lockout_until = timezone.now() + lockout_length
                    user.failed_login_attempts = 0
                    user.save()
                    return JsonResponse(
                        {
                            'error': f'Too many failed attempts. Try again in {int(lockout_length.total_seconds() // 60)} minutes.',
                            'lockout_seconds': int(lockout_length.total_seconds()),
                        },
                        status=429,
                    )
                else:
                    attempts_left = max_attempts - user.failed_login_attempts
                    user.save()
                    return JsonResponse(
                        {
                            'error': 'Invalid credentials.',
                            'attempts_left': attempts_left,
                        },
                        status=401,
                    )
            return JsonResponse({'error': 'Invalid credentials.'}, status=401)

        user.failed_login_attempts = 0
        user.lockout_until = None
        user.save()

        log = AdminSessionLog.objects.create(user=user)
        # Set initial expiry to 4 hours
        expiry = timezone.now() + timedelta(hours=4)
        token = AdminToken.objects.create(user=user, session_log=log, expires_at=expiry)
        return JsonResponse({'token': token.token, 'username': user.username})
    except Exception as e:
        return JsonResponse({'error': f'Login Error: {str(e)}. This usually indicates missing database migrations. Please run "python manage.py migrate".'}, status=500)


@csrf_exempt
def admin_touch(request):
    """Extends the session expiry time."""
    admin_token = _get_admin_token(request)
    if not admin_token or admin_token is True:
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    # Extend by 1 hour from now
    new_expiry = timezone.now() + timedelta(hours=1)
    admin_token.expires_at = new_expiry
    admin_token.save()
    
    return JsonResponse({'ok': True, 'expires_at': new_expiry.isoformat()})


@csrf_exempt
def admin_signout(request):
    """Ends the session and records logout time."""
    token_val = _get_token_from_request(request)
    if token_val:
        token_obj = AdminToken.objects.filter(token=token_val).first()
        if token_obj:
            if token_obj.session_log:
                token_obj.session_log.logout_time = timezone.now()
                token_obj.session_log.save()
            token_obj.delete()
    return JsonResponse({'ok': True})


def admin_session_logs(request):
    """Returns recent login/logout history."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    logs = [
        {
            'username': log.user.username,
            'login_time': log.login_time.isoformat() if log.login_time else None,
            'logout_time': log.logout_time.isoformat() if log.logout_time else None,
        }
        for log in AdminSessionLog.objects.all().order_by('-login_time')[:50]
    ]
    return JsonResponse({'logs': logs})


def admin_me(request):
    admin_token = _get_admin_token(request)
    if not admin_token:
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if admin_token is True:
        return JsonResponse({'username': 'admin', 'authorized': True})

    return JsonResponse({'username': admin_token.user.username, 'authorized': True})


@csrf_exempt
def admin_settings(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    app_settings = AppSettings.current()
    app_settings.base_currency = 'KES'
    app_settings.display_currency = 'KES'

    delivery_rate_val = payload.get('delivery_rate_per_km')
    if delivery_rate_val is not None:
        try:
            app_settings.delivery_rate_per_km = Decimal(str(delivery_rate_val))
        except (TypeError, InvalidOperation):
            pass

    min_delivery_fee_val = payload.get('min_delivery_fee')
    if min_delivery_fee_val is not None:
        try:
            app_settings.min_delivery_fee = Decimal(str(min_delivery_fee_val))
        except (TypeError, InvalidOperation):
            pass

    app_settings.save()

    return JsonResponse({
        'base_currency': app_settings.base_currency,
        'display_currency': app_settings.display_currency,
        'delivery_rate_per_km': float(app_settings.delivery_rate_per_km),
        'min_delivery_fee': float(app_settings.min_delivery_fee),
    })


@csrf_exempt
def admin_users(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method == 'GET':
        users = [
            {
                'username': user.username,
                'created_at': user.created_at.isoformat() if user.created_at else None,
            }
            for user in AdminUser.objects.all().order_by('created_at')
        ]
        return JsonResponse({'users': users})

    if request.method == 'POST':
        try:
            payload = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        username = (payload.get('username') or '').strip()
        password = (payload.get('password') or '').strip()

        if not username or not password:
            return JsonResponse({'error': 'username and password are required'}, status=400)

        if AdminUser.objects.filter(username=username).exists():
            return JsonResponse({'error': 'username already exists'}, status=400)

        user = AdminUser(username=username)
        user.set_password(password)
        user.save()
        return JsonResponse({'ok': True, 'username': user.username})

    return HttpResponseBadRequest('Only GET and POST allowed')


@csrf_exempt
def admin_user_detail(request, username: str):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method != 'DELETE':
        return HttpResponseBadRequest('Only DELETE allowed')

    user = AdminUser.objects.filter(username=username).first()
    if not user:
        return JsonResponse({'error': 'not_found'}, status=404)

    user.delete()
    return JsonResponse({'ok': True})


def _serialize_table(table):
    return {
        'id': table.id,
        'number': table.number,
        'name': table.name,
        'status': table.status,
        'active_orders': table.orders.count(),
        'created_at': table.created_at.isoformat() if table.created_at else None,
    }


def _serialize_menu_item(menu_item):
    return {
        'id': menu_item.id,
        'name': menu_item.name,
        'category': menu_item.category,
        'price': float(menu_item.price),
        'food_cost': float(menu_item.food_cost or Decimal('0.00')),
        'description': menu_item.description,
        'popular': bool(menu_item.popular),
        'spicy': bool(menu_item.spicy),
        'stock_level': menu_item.stock_level,
        'min_stock_level': menu_item.min_stock_level,
        'image_url': menu_item.image_url or "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
        'is_available': menu_item.is_available and menu_item.stock_level > 0,
    }


def _get_default_menu_items():
    return [
        { 'name': 'Classic Smash Burger', 'price': Decimal('750.00'), 'food_cost': Decimal('250.00'), 'category': 'Burgers', 'description': 'Double patty, cheddar, pickles, special sauce', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80' },
        { 'name': 'Spicy Chicken Burger', 'price': Decimal('780.00'), 'food_cost': Decimal('260.00'), 'category': 'Burgers', 'description': 'Crispy chicken, jalapeños, sriracha mayo', 'popular': False, 'spicy': True, 'image': 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=500&q=80' },
        { 'name': 'BBQ Bacon Burger', 'price': Decimal('860.00'), 'food_cost': Decimal('290.00'), 'category': 'Burgers', 'description': 'Smoked bacon, BBQ glaze, onion rings', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500&q=80' },
        { 'name': 'Veggie Deluxe', 'price': Decimal('690.00'), 'food_cost': Decimal('230.00'), 'category': 'Burgers', 'description': 'Plant-based patty, avocado, fresh greens', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?w=500&q=80' },
        { 'name': 'Loaded Fries', 'price': Decimal('360.00'), 'food_cost': Decimal('120.00'), 'category': 'Sides', 'description': 'Cheese sauce, bacon bits, green onions', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1573015084185-7205ba3d6ea8?w=500&q=80' },
        { 'name': 'Onion Rings', 'price': Decimal('280.00'), 'food_cost': Decimal('90.00'), 'category': 'Sides', 'description': 'Beer-battered, crispy golden perfection', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1639024471283-03518883511d?w=500&q=80' },
        { 'name': 'Chicken Wings (8pc)', 'price': Decimal('720.00'), 'food_cost': Decimal('240.00'), 'category': 'Sides', 'description': 'Choice of buffalo, BBQ, or garlic parmesan', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&q=80' },
        { 'name': 'Coleslaw', 'price': Decimal('210.00'), 'food_cost': Decimal('70.00'), 'category': 'Sides', 'description': 'Creamy homestyle coleslaw', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1550304084-37f40213435c?w=500&q=80' },
        { 'name': 'Classic Milkshake', 'price': Decimal('420.00'), 'food_cost': Decimal('130.00'), 'category': 'Drinks', 'description': 'Vanilla, chocolate, or strawberry', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80' },
        { 'name': 'Fresh Lemonade', 'price': Decimal('290.00'), 'food_cost': Decimal('90.00'), 'category': 'Drinks', 'description': 'Freshly squeezed with a hint of mint', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1523677012304-d02511920150?w=500&q=80' },
        { 'name': 'Iced Tea', 'price': Decimal('220.00'), 'food_cost': Decimal('70.00'), 'category': 'Drinks', 'description': 'Brewed daily, sweetened or unsweetened', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&q=80' },
        { 'name': 'Brownie Sundae', 'price': Decimal('460.00'), 'food_cost': Decimal('150.00'), 'category': 'Desserts', 'description': 'Warm brownie, vanilla ice cream, hot fudge', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=500&q=80' },
        { 'name': 'Apple Pie Bites', 'price': Decimal('330.00'), 'food_cost': Decimal('100.00'), 'category': 'Desserts', 'description': 'Cinnamon sugar dusted, served warm', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=500&q=80' },
    ]


def _ensure_menu_items(seed: bool = True):
    # Only seed default menu items when explicitly requested.
    if not seed:
        return
    
    default_items = _get_default_menu_items()
    
    # 1. If DB is empty, seed everything
    if not MenuItem.objects.exists():
        for item_data in default_items:
            MenuItem.objects.create(
                name=item_data['name'],
                category=item_data['category'],
                price=item_data['price'],
                food_cost=item_data['food_cost'],
                description=item_data['description'],
                popular=item_data['popular'],
                spicy=item_data['spicy'],
                image_url=item_data['image'],
                stock_level=50,
                min_stock_level=10,
            )
    else:
        # 2. If items exist but lack images/stock, update them so they look "pro"
        image_map = {i['name']: i['image'] for i in default_items}
        existing_items = MenuItem.objects.all()
        for item in existing_items:
            updated = False
            if (not item.image_url or "placeholder" in item.image_url) and item.name in image_map:
                item.image_url = image_map[item.name]
                updated = True
            if item.stock_level <= 0:
                item.stock_level = 50
                updated = True
            if updated:
                item.save()

def customer_home(request):
    """Professional Customer Home View returning grouped data."""
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    _ensure_menu_items(seed=True)
    # Include items with 0 stock but mark them as unavailable for a pro "catalog" feel
    items = MenuItem.objects.all()
    
    categories = list(items.values_list('category', flat=True).distinct().order_by('category'))
    featured = items.filter(popular=True).order_by('?')[:5]
    
    grouped_menu = {}
    for cat in categories:
        grouped_menu[cat] = [_serialize_menu_item(i) for i in items.filter(category=cat)]

    return JsonResponse({
        'hero': {
            'title': 'TASTY BITES HUB',
            'tagline': 'CRAFTED WITH PASSION, DELIVERED WITH PRECISION.',
            'image_url': 'https://images.unsplash.com/photo-1514356015730-0739d598061f?q=80&w=1600',
            'accent_color': '#f97316'
        },
        'categories': categories,
        'featured': [_serialize_menu_item(i) for i in featured],
        'menu_by_category': grouped_menu,
        'config': {
            'currency': 'KES',
            'delivery_min': float(AppSettings.current().min_delivery_fee)
        }
    })



def menu_items(request):

    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')


    # Seed defaults unless explicitly disabled by the client.
    seed_flag = request.GET.get('seed', '1')
    seed = str(seed_flag).strip().lower() not in ('0', 'false', 'no', 'off')
    _ensure_menu_items(seed=seed)
    items = MenuItem.objects.all().order_by('category', 'name')
    return JsonResponse({'menu_items': [_serialize_menu_item(item) for item in items]})



@csrf_exempt
def menu_item_update(request, item_id: int):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)





    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    item = MenuItem.objects.filter(id=item_id).first()
    if not item:
        return JsonResponse({'error': 'not_found'}, status=404)

    if 'name' in payload:
        item.name = str(payload.get('name')).strip()
    if 'category' in payload:
        item.category = str(payload.get('category')).strip()
    if 'description' in payload:
        item.description = str(payload.get('description')).strip()
    if 'popular' in payload:
        item.popular = bool(payload.get('popular'))
    if 'spicy' in payload:
        item.spicy = bool(payload.get('spicy'))
    if 'image_url' in payload:
        item.image_url = str(payload.get('image_url')).strip()

    if 'price' in payload:
        try:
            item.price = Decimal(str(payload.get('price')))
        except (TypeError, ValueError, InvalidOperation):
            return JsonResponse({'error': 'invalid price'}, status=400)

    if 'food_cost' in payload:
        try:
            item.food_cost = Decimal(str(payload.get('food_cost')))
        except (TypeError, ValueError, InvalidOperation):
            return JsonResponse({'error': 'invalid food_cost'}, status=400)

    if item.price < 0 or item.food_cost < 0:
        return JsonResponse({'error': 'values must be non-negative'}, status=400)

    item.save()
    return JsonResponse({'menu_item': _serialize_menu_item(item)})

@csrf_exempt
def menu_item_stock_update(request, item_id: int):
    """Admin updates stock levels for a menu item."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    item = MenuItem.objects.filter(id=item_id).first()
    if not item:
        return JsonResponse({'error': 'not_found'}, status=404)

    if 'stock_level' in payload:
        try:
            stock_level = int(payload.get('stock_level'))
            if stock_level < 0:
                return JsonResponse({'error': 'stock_level cannot be negative'}, status=400)
            item.stock_level = stock_level
        except (TypeError, ValueError):
            return JsonResponse({'error': 'invalid stock_level'}, status=400)

    if 'min_stock_level' in payload:
        try:
            min_stock_level = int(payload.get('min_stock_level'))
            if min_stock_level < 0:
                return JsonResponse({'error': 'min_stock_level cannot be negative'}, status=400)
            item.min_stock_level = min_stock_level
        except (TypeError, ValueError):
            return JsonResponse({'error': 'invalid min_stock_level'}, status=400)

    item.save()
    return JsonResponse({'menu_item': _serialize_menu_item(item)})

@csrf_exempt
def admin_add_stock(request):
    """Admin adds stock to a menu item and logs it."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
        item_id = payload.get('item_id')
        quantity = int(payload.get('quantity', 0))
        cost = Decimal(str(payload.get('cost', 0)))
        created_at_str = payload.get('created_at')
        
        item = MenuItem.objects.get(id=item_id)
    except (MenuItem.DoesNotExist, ValueError, InvalidOperation, Exception):
        return JsonResponse({'error': 'invalid_request'}, status=400)

    created_at = timezone.now()
    if created_at_str:
        try:
            created_at = datetime.datetime.fromisoformat(created_at_str)
            if timezone.is_naive(created_at):
                created_at = timezone.make_aware(created_at)
        except ValueError:
            pass

    StockLog.objects.create(item=item, quantity=quantity, cost=cost, created_at=created_at)
    item.stock_level += quantity
    item.save()

    return JsonResponse({'ok': True, 'new_stock': item.stock_level})

def most_consumed_stock(request):
    """Returns top consumed stock items based on orders."""
    consumed = OrderItem.objects.values('name').annotate(
        total_quantity=Sum('quantity')
    ).order_by('-total_quantity')[:5]
    
    results = [
        {'name': row['name'], 'total_quantity': row['total_quantity']}
        for row in consumed
    ]
    return JsonResponse({'results': results})


@csrf_exempt
def menu_item_delete(request, item_id: int):
    """Admin deletes a menu item."""
    if request.method != 'DELETE':
        return HttpResponseBadRequest('Only DELETE allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    item = MenuItem.objects.filter(id=item_id).first()
    if not item:
        return JsonResponse({'error': 'not_found'}, status=404)

    item.delete()
    return JsonResponse({'ok': True})


@csrf_exempt
def menu_item_create(request):
    """Admin creates a new menu item."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    name = (payload.get('name') or '').strip()
    category = (payload.get('category') or '').strip()  # "food type"
    description = (payload.get('description') or '').strip()

    try:
        price = Decimal(str(payload.get('price')))
        food_cost = Decimal(str(payload.get('food_cost') or payload.get('cost') or 0))
    except (TypeError, ValueError, InvalidOperation):
        return JsonResponse({'error': 'invalid price or food_cost'}, status=400)

    if not name or not category:
        return JsonResponse({'error': 'name and category are required'}, status=400)
    if price < 0 or food_cost < 0:
        return JsonResponse({'error': 'price and food_cost must be non-negative'}, status=400)

    popular = bool(payload.get('popular', False))
    spicy = bool(payload.get('spicy', False))

    if MenuItem.objects.filter(name=name).exists():
        return JsonResponse({'error': 'menu item name already exists'}, status=400)

    # Auto Marketing Flow: Triggered on new item creation
    # In a production environment, this would call OpenAI/Midjourney APIs 
    # and schedule tasks for Instagram/Push services.
    marketing_status = {
        "social_post_generated": True,
        "push_notifications_queued": 142, # Mocking users who liked similar categories
        "platform": "Instagram"
    }

    item = MenuItem.objects.create(
        name=name,
        category=category,
        price=price,
        food_cost=food_cost,
        description=description,
        popular=popular,
        spicy=spicy,
        image_url=payload.get('image_url', ''),
    )

    return JsonResponse({
        'menu_item': _serialize_menu_item(item),
        'automation': marketing_status
    })

def automation_insights(request):
    """The 'Super System' engine: Analyzes patterns for auto-staffing and re-engagement."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)

    # 1. Auto Re-engage Logic: Find customers who haven't ordered in 30 days
    inactive_customers = Order.objects.values('phone').annotate(
        last_order=Max('created_at')
    ).filter(last_order__lt=thirty_days_ago, phone__isnull=False).exclude(phone='')[:10]

    reengage_list = [
        {
            "phone": c['phone'],
            "last_order": c['last_order'].isoformat() if c['last_order'] else None,
            "suggestion": "Send 200 KES Discount SMS"
        } for c in inactive_customers
    ]

    # 2. Auto Staffing Logic: Analyze Friday volume (Day 6 in Django/Postgres)
    # Checks if any Friday in the last 3 months exceeded 200 orders
    high_volume_fridays = Order.objects.annotate(
        weekday=ExtractWeekDay('created_at')
    ).filter(weekday=6).values('created_at__date').annotate(
        total=Count('id')
    ).filter(total__gte=200).exists()

    staffing_suggestions = []
    if high_volume_fridays:
        staffing_suggestions.append({
            "trigger": "Friday Volume Pattern (>200 orders)",
            "action": "Schedule 2 extra kitchen staff 11am-3pm",
            "priority": "High"
        })
    else:
        # Provide "System Health" data if no high-volume triggers exist
        staffing_suggestions.append({
            "trigger": "Operational Efficiency",
            "action": "Current staffing levels optimal for current volume.",
            "priority": "Low"
        })
        
    # Add System Health check
    health_status = {
        "database": "Optimized",
        "last_sync": now.strftime("%H:%M:%S"),
        "automated_tasks": "Running"
    }

    # 3. Stock Level Automation
    low_stock_triggers = MenuItem.objects.filter(stock_level__lte=F('min_stock_level'))
    for item in low_stock_triggers:
        staffing_suggestions.append({
            "trigger": f"Low Stock: {item.name}",
            "action": f"Auto-generate Purchase Order for {item.category} supplier",
            "priority": "Medium"
        })

    return JsonResponse({
        "reengage_customers": reengage_list,
        "staffing_insights": staffing_suggestions,
        "system_health": health_status,
        "marketing_activity": [
            {"event": "New Dish Added", "action": "AI Instagram Post Generated", "time": now.isoformat()}
        ]
    })


def _serialize_review(review):
    return {
        'id': review.id,
        'customer_name': review.customer_name or 'Anonymous',
        'rating': review.rating,
        'comment': review.comment,
        'created_at': review.created_at.isoformat() if review.created_at else None,
    }


def reviews_list(request):
    """Returns a list of all customer reviews."""
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    reviews = Review.objects.all().order_by('-created_at')
    return JsonResponse({'reviews': [_serialize_review(r) for r in reviews]})


@csrf_exempt
def create_review(request):
    """Allows customers to submit a new review."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
        rating = int(payload.get('rating'))
        if not (1 <= rating <= 5):
            return JsonResponse({'error': 'Rating must be between 1 and 5'}, status=400)
        
        review = Review.objects.create(
            customer_name=payload.get('customer_name', '').strip() or None,
            rating=rating,
            comment=payload.get('comment', '').strip() or None,
        )
        return JsonResponse(_serialize_review(review), status=201)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Invalid rating or JSON format'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
@csrf_exempt
def employees_list(request):
    """Lists all employees and handles creation via POST."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method == 'GET':
        employees = Employee.objects.all().order_by('-created_at')
        data = [{
            'id': e.id,  # type: ignore
            'name': e.name,
            'role': e.role,
            'username': e.username,
            'phone': e.phone,
            'email': e.email,
            'salary': float(e.salary),
            'account_number': getattr(e, 'account_number', ''),
            'status': e.status,
            'joined_at': e.created_at.isoformat() if e.created_at else None
        } for e in employees]
        return JsonResponse({'employees': data})

    if request.method == 'POST':
        try:
            payload = json.loads(request.body.decode('utf-8'))
            emp = Employee.objects.create(
                name=payload.get('name'),
                role=payload.get('role', 'Staff'),
                phone=payload.get('phone', ''),
                email=payload.get('email', ''),
                username=payload.get('username'),
                salary=Decimal(str(payload.get('salary', 0))),
                status=payload.get('status', 'active'),
                account_number=payload.get('account_number', '')
            )
            if payload.get('password'):
                emp.set_password(payload['password'])
                emp.save()
            return JsonResponse({'ok': True, 'id': emp.id})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return HttpResponseBadRequest('Method not allowed')

@csrf_exempt
def employee_detail(request, employee_id: int):
    """Handles update and delete for a specific employee."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    emp = Employee.objects.filter(id=employee_id).first()  # type: ignore
    if not emp:
        return JsonResponse({'error': 'not_found'}, status=404)

    if request.method == 'POST': # Update
        try:
            payload = json.loads(request.body.decode('utf-8'))
            if 'name' in payload: emp.name = payload['name']
            if 'role' in payload: emp.role = payload['role']
            if 'phone' in payload: emp.phone = payload['phone']
            if 'email' in payload: emp.email = payload['email']
            if 'username' in payload: emp.username = payload['username']
            if 'password' in payload and payload['password']: emp.set_password(payload['password'])
            if 'salary' in payload: emp.salary = Decimal(str(payload['salary']))
            if 'status' in payload: emp.status = payload['status']
            if 'account_number' in payload: emp.account_number = payload['account_number']
            emp.save()
            return JsonResponse({'ok': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    if request.method == 'DELETE':
        emp.delete()
        return JsonResponse({'ok': True})

    return HttpResponseBadRequest('Method not allowed')

@csrf_exempt
def send_employee_email(request, employee_id: int):
    """API endpoint for the system to send an email to an employee."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    emp = Employee.objects.filter(id=employee_id).first()
    if not emp:
        return JsonResponse({'error': 'Employee not found'}, status=404)
    if not emp.email:
        return JsonResponse({'error': 'Employee has no email address registered'}, status=400)

    try:
        payload = json.loads(request.body.decode('utf-8'))
        message = payload.get('message')
        subject = payload.get('subject', 'Message from Tasty Bites Admin')

        if not message:
            return JsonResponse({'error': 'Message body is required'}, status=400)

        sender = getattr(settings, 'EMAIL_HOST_USER', getattr(settings, 'DEFAULT_FROM_EMAIL', 'admin@tastybites.com'))
        send_mail(
            subject,
            message,
            sender,
            [emp.email],
            fail_silently=False,
        )
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'error': f"Failed to send email: {str(e)}"}, status=500)

@csrf_exempt
def send_bulk_employee_email(request):
    """API endpoint to send an email to multiple selected employees."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
        employee_ids = payload.get('employee_ids', [])
        message = payload.get('message')
        subject = payload.get('subject', 'Important Update: Tasty Bites Hub')

        if not employee_ids or not isinstance(employee_ids, list):
            return JsonResponse({'error': 'A list of employee IDs is required'}, status=400)
        if not message:
            return JsonResponse({'error': 'Message body is required'}, status=400)

        # Ensure IDs are integers to prevent lookup failures
        clean_ids = [int(eid) for eid in employee_ids if str(eid).isdigit()]
        employees = Employee.objects.filter(id__in=clean_ids).exclude(email='')
        
        sender = getattr(settings, 'EMAIL_HOST_USER', getattr(settings, 'DEFAULT_FROM_EMAIL', 'admin@tastybites.com'))
        count = 0
        for emp in employees:
            try:
                send_mail(
                    subject,
                    message,
                    sender,
                    [emp.email],
                    fail_silently=False,
                )
                count += 1
            except Exception as e:
                print(f"Bulk email error for {emp.email}: {e}")

        return JsonResponse({'ok': True, 'count': count})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def admin_clear(request):
    """Clears stored operational data (orders/tables/transactions/wastage/menu items)."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    # Delete in dependency order
    try:
        OrderItem.objects.all().delete()
        Transaction.objects.all().delete()
        Order.objects.all().delete()
        WastageLog.objects.all().delete()
        Table.objects.all().delete()
        MenuItem.objects.all().delete()
    except Exception as e:
        return JsonResponse({'error': 'clear_failed', 'message': str(e)}, status=500)

    return JsonResponse({'ok': True})





@csrf_exempt
def admin_delete_wastage_log(request, log_id: int):
    if request.method != 'DELETE':
        return HttpResponseBadRequest('Only DELETE allowed')
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    log = WastageLog.objects.filter(id=log_id).first()
    if not log:
        return JsonResponse({'error': 'not_found'}, status=404)
    log.delete()
    return JsonResponse({'ok': True})


@csrf_exempt
def miscellaneous_log(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method == 'GET':
        period_type = request.GET.get('period_type', 'week')
        date_str = request.GET.get('date')
        start_date, end_date, _ = _get_period_dates(period_type, date_str)
        logs = MiscellaneousExpense.objects.filter(
            created_at__gte=start_date, created_at__lte=end_date).order_by('-created_at')[:100]
        return JsonResponse({'miscellaneous': [
            {
                'id': log.id,
                'item_name': log.item_name,
                'reason': log.reason,
                'cost': _to_display_currency(log.cost),
                'created_at': log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]})

    if request.method != 'POST':
        return HttpResponseBadRequest('Only GET and POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
        item_name = (payload.get('item_name') or '').strip()
        reason = (payload.get('reason') or '').strip()
        cost = Decimal(str(payload.get('cost') or '0'))
        if not item_name: return JsonResponse({'error': 'item_name required'}, status=400)
        log = MiscellaneousExpense.objects.create(item_name=item_name, reason=reason, cost=cost)
        return JsonResponse({'id': log.id, 'item_name': log.item_name, 'cost': _to_display_currency(log.cost)})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
def admin_delete_misc_log(request, log_id: int):
    if request.method != 'DELETE': return HttpResponseBadRequest('Only DELETE allowed')
    if not _is_admin(request): return JsonResponse({'error': 'unauthorized'}, status=403)
    log = MiscellaneousExpense.objects.filter(id=log_id).first()
    if not log: return JsonResponse({'error': 'not_found'}, status=404)
    log.delete()
    return JsonResponse({'ok': True})

@csrf_exempt
def admin_clear_misc_logs(request):
    if request.method != 'POST': return HttpResponseBadRequest('Only POST allowed')
    if not _is_admin(request): return JsonResponse({'error': 'unauthorized'}, status=403)
    MiscellaneousExpense.objects.all().delete()
    return JsonResponse({'ok': True})


@csrf_exempt
def admin_clear_wastage_logs(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    WastageLog.objects.all().delete()
    return JsonResponse({'ok': True})


def _serialize_order(order):
    total_food_cost = sum((item.food_cost or Decimal('0.00')) * item.quantity for item in order.items.all())  # type: ignore
    has_delivery = bool(order.delivery_address)
    return {
        'order_id': order.order_id,
        'table': order.table.number if order.table else ('Delivery' if has_delivery else 'Takeaway'),
        'table_details': { # Keep full table details for other uses
            'id': order.table.id,
            'number': order.table.number,
            'name': order.table.name,
        } if order.table else None,
        'phone': order.phone,
        'delivery_address': order.delivery_address,
        'delivery_distance_km': float(order.delivery_distance_km) if order.delivery_distance_km is not None else None,
        'delivery_time': order.delivery_time,
        'delivery_cost': float(order.delivery_cost),
        'status': order.status,
        'split_count': order.split_count,
        'total_amount': float(order.total_amount),
        'food_cost': float(total_food_cost),
        'is_paid': order.is_paid,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'items': [
            {
                'id': item.id,
                'name': item.name,
                'price': float(item.price),
                'food_cost': float(item.food_cost or Decimal('0.00')),
                'quantity': item.quantity,
                'modifiers': item.modifiers or [],
                'seat_number': item.seat_number,
                'is_served': item.is_served,
                'subtotal': float(item.price * item.quantity),
            }
            for item in order.items.all().order_by('id')  # type: ignore
        ],
    }


def _build_receipt_text(order):
    rows = [
        f"Order ID: {order.order_id}",
        f"Table: {order.table.number if order.table else 'N/A'} {order.table.name if order.table else ''}".strip(),
        f"Phone: {order.phone or 'N/A'}",
        f"Status: {order.status}",
        f"Created: {order.created_at.isoformat() if order.created_at else 'N/A'}",
        "",
        "Items:",
    ]
    for item in order.items.all().order_by('id'):  # type: ignore
        modifiers = ', '.join(item.modifiers or [])
        rows.append(f" - {item.quantity} x {item.name} @ {item.price:.2f} = {(item.price * item.quantity):.2f}")
        if modifiers:
            rows.append(f"    Modifiers: {modifiers}")
    rows.append("")
    rows.append(f"Total: {order.total_amount:.2f}")
    if order.split_count > 1:
        rows.append(f"Split: {order.split_count} -> {order.total_amount / order.split_count:.2f} each")
    rows.append(f"Paid: {'Yes' if order.is_paid else 'No'}")
    return "\n".join(rows)


@csrf_exempt
def tables_list(request):
    if request.method == 'GET':
        tables = [
            _serialize_table(table)
            for table in Table.objects.all().order_by('number')
        ]
        return JsonResponse({'tables': tables})

    if request.method != 'POST':
        return HttpResponseBadRequest('Only GET and POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    number = (payload.get('number') or '').strip()
    name = (payload.get('name') or '').strip()

    if not number:
        return JsonResponse({'error': 'number is required'}, status=400)

    if Table.objects.filter(number=number).exists():
        return JsonResponse({'error': 'table number already exists'}, status=400)

    table = Table.objects.create(number=number, name=name)
    return JsonResponse(_serialize_table(table))


@csrf_exempt
def table_detail(request, table_id: int):
    table = Table.objects.filter(id=table_id).first()
    if not table:
        return JsonResponse({'error': 'not_found'}, status=404)

    if request.method == 'GET':
        return JsonResponse(_serialize_table(table))

    if request.method == 'DELETE':
        if not _is_admin(request):
            return JsonResponse({'error': 'unauthorized'}, status=403)
        table.delete()
        return JsonResponse({'ok': True})

    return HttpResponseBadRequest('Only GET and DELETE allowed')


@csrf_exempt
def create_order(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    phone = (payload.get('phone') or '').strip()
    table_number = (payload.get('table_number') or '').strip()
    split_count = int(payload.get('split_count') or 1)
    items = payload.get('items') or []

    if not isinstance(items, list) or not items:
        return JsonResponse({'error': 'items are required'}, status=400)

    table = None
    if table_number:
        table, _ = Table.objects.get_or_create(number=table_number, defaults={'name': table_number})

    delivery_address = (payload.get('delivery_address') or '').strip()
    delivery_distance_km = payload.get('delivery_distance_km')
    delivery_time = (payload.get('delivery_time') or '').strip()
    delivery_cost = Decimal(str(payload.get('delivery_cost') or '0') or '0')

    order = Order.objects.create(
        table=table,
        phone=phone,
        delivery_address=delivery_address,
        delivery_distance_km=Decimal(str(delivery_distance_km)) if delivery_distance_km not in (None, '') else None,
        delivery_time=delivery_time,
        delivery_cost=delivery_cost,
        split_count=max(1, split_count),
        status='pending',
        total_amount=Decimal('0.00'),
    )

    total = Decimal('0.00')
    for item in items:
        name = (item.get('name') or '').strip()
        if not name:
            continue
        price = Decimal(str(item.get('price') or '0') or '0')
        food_cost = Decimal(str(item.get('food_cost') or item.get('cost') or '0') or '0')
        quantity = max(1, int(item.get('quantity') or 1))
        modifiers = item.get('modifiers') or []
        if isinstance(modifiers, str):
            modifiers = [mod.strip() for mod in modifiers.split(',') if mod.strip()]

        OrderItem.objects.create(
            order=order,
            name=name,
            price=price,
            food_cost=food_cost,
            quantity=quantity,
            modifiers=modifiers,
        )
        total += price * quantity

    total += delivery_cost
    order.total_amount = total
    order.save()

    if table:
        table.status = Table.STATUS_OCCUPIED
        table.save(update_fields=['status'])

    return JsonResponse(_serialize_order(order))


def queue_list(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    orders = Order.objects.all().order_by('-created_at')[:100]
    return JsonResponse({'results': [_serialize_order(order) for order in orders]})


@csrf_exempt
def order_status_update(request, order_id: str):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')
    if not (_is_admin(request) or _is_staff(request)):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    status = (payload.get('status') or '').strip()
    if not status:
        return JsonResponse({'error': 'status is required'}, status=400)

    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    order.status = status
    if 'split_count' in payload:
        order.split_count = max(1, int(payload.get('split_count') or 1))

    # If admin marks order as paid, create a transaction record and release table.
    if status == 'paid':
        payment_method = (payload.get('payment_method') or 'cash').strip().lower()
        order.payment_method = payment_method
        try:
            Transaction.objects.create(
                phone=order.phone or '',
                amount=order.total_amount,
                item=order.order_id,
                status='success',
                method=Transaction.METHOD_CASH if payment_method == 'cash' else Transaction.METHOD_M_PESA,
                order=order,
            )
        except Exception:
            logger.exception('Failed to create transaction for admin-paid order %s', order.order_id)

        if order.table:
            order.table.status = Table.STATUS_AVAILABLE
            order.table.save(update_fields=['status'])

        # Log admin activity
        try:
            _log_staff_activity(request, 'Admin cleared payment', {'order_id': order.order_id, 'payment_method': payment_method}, order=order)
        except Exception:
            logger.debug('Failed to log admin activity for order %s', order.order_id)

        # Emit SSE event so UIs update immediately
        try:
            _emit_event('order_update', {'order_id': order.order_id, 'status': 'paid'})
        except Exception:
            logger.debug('Failed to emit SSE event for admin-paid order %s', order.order_id)

    elif status in ['completed', 'cancelled', 'served'] and order.table:
        order.table.status = Table.STATUS_AVAILABLE
        order.table.save(update_fields=['status'])

    order.save()
    return JsonResponse(_serialize_order(order))


@csrf_exempt
def order_item_price_update(request, order_id: str, item_id: int):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    item = order.items.filter(id=item_id).first()  # type: ignore
    if not item:
        return JsonResponse({'error': 'item_not_found'}, status=404)

    price_value = payload.get('price')
    try:
        price = Decimal(str(price_value))
    except (TypeError, ValueError, InvalidOperation):
        return JsonResponse({'error': 'invalid price'}, status=400)

    if price < 0:
        return JsonResponse({'error': 'price must be non-negative'}, status=400)

    item.price = price
    item.save()

    total_amount = sum(((i.price or Decimal('0.00')) * i.quantity for i in order.items.all()), Decimal('0.00'))
    order.total_amount = total_amount
    order.save()

    return JsonResponse(_serialize_order(order))


def order_receipt(request, order_id: str):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    return JsonResponse({
        'receipt_text': _build_receipt_text(order),
        'order': _serialize_order(order),
    })


def orders_list(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    # Parse filter parameters
    start_date_str = request.GET.get('start_date', '').strip()
    end_date_str = request.GET.get('end_date', '').strip()
    statuses_str = request.GET.get('statuses', '').strip()
    limit = int(request.GET.get('limit', 100))

    query = Order.objects.all()

    # Filter by date range
    if start_date_str:
        try:
            start_date = datetime.datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            query = query.filter(created_at__gte=start_date)
        except (ValueError, TypeError):
            pass

    if end_date_str:
        try:
            end_date = datetime.datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            query = query.filter(created_at__lte=end_date)
        except (ValueError, TypeError):
            pass

    # Filter by statuses
    if statuses_str:
        status_list = [s.strip() for s in statuses_str.split(',') if s.strip()]
        if status_list:
            query = query.filter(status__in=status_list)

    orders = query.order_by('-created_at')[:limit]
    data = [
        {
            'order_id': order.order_id,
            'table': order.table.number if order.table else ('Delivery' if order.delivery_address else 'Takeaway'),
            'phone': order.phone,
            'delivery_address': order.delivery_address,
            'delivery_distance_km': float(order.delivery_distance_km) if order.delivery_distance_km is not None else None,
            'delivery_time': order.delivery_time,
            'delivery_cost': float(order.delivery_cost),
            'status': order.status,
            'total_amount': float(order.total_amount),
            'item_count': order.items.count(),
            'is_paid': order.is_paid,
            'split_count': order.split_count,
            'created_at': order.created_at.isoformat() if order.created_at else None,
        }
        for order in orders
    ]
    return JsonResponse({'results': data})


def order_detail(request, order_id: str):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    return JsonResponse(_serialize_order(order))


def _build_report_summary(start_date: datetime.datetime, end_date: datetime.datetime, range_label: str):

    # Identify orders from this period that are fully paid
    paid_orders = Order.objects.filter(
        created_at__gte=start_date,
        created_at__lte=end_date
    ).annotate(
        paid_sum=Sum('transactions__amount', filter=Q(transactions__status='success'))
    ).filter(paid_sum__gte=F('total_amount'), total_amount__gt=0)
    
    paid_order_ids = paid_orders.values_list('id', flat=True)

    order_items = OrderItem.objects.filter(order__id__in=paid_order_ids).annotate(
        item_revenue=ExpressionWrapper(F('price') * F('quantity'), output_field=DecimalField()),
        item_food_cost=ExpressionWrapper(F('food_cost') * F('quantity'), output_field=DecimalField()),
    )
    item_totals = order_items.values('name').annotate(
        quantity=Sum('quantity'),
        revenue=Sum('item_revenue'),
        food_cost=Sum('item_food_cost'),
    ).order_by('-quantity')

    best_items = [
        {
            'name': row['name'],
            'quantity': row['quantity'] or 0,
            'revenue': _to_display_currency(row['revenue'] or 0),
            'food_cost': _to_display_currency(row['food_cost'] or 0),
        }
        for row in item_totals[:5]
    ]
    worst_items = [
        {
            'name': row['name'],
            'quantity': row['quantity'] or 0,
            'revenue': _to_display_currency(row['revenue'] or 0),
            'food_cost': _to_display_currency(row['food_cost'] or 0),
        }
        for row in item_totals.order_by('quantity')[:5]
    ]

    hourly = []
    hours = Order.objects.filter(id__in=paid_order_ids).annotate(hour=ExtractHour('created_at')).values('hour').annotate(
        orders=Count('id'),
        revenue=Sum('total_amount'),
    ).order_by('hour')
    for row in hours:
        hourly.append({
            'hour': row['hour'], # type: ignore
            'orders': row['orders'],
            'revenue': _to_display_currency(row['revenue'] or 0),
        })

    # Revenue is computed from successful transactions within the period
    # Revenue is computed from successful transactions associated with fully paid orders
    total_revenue = float(Transaction.objects.filter(
        order__id__in=paid_order_ids, status='success'
    ).aggregate(total=Sum('amount'))['total'] or 0)
    total_food_cost = float(order_items.aggregate(total=Sum(F('food_cost') * F('quantity'), output_field=DecimalField()))['total'] or 0)
    
    total_wastage = float(WastageLog.objects.filter(
        created_at__gte=start_date, created_at__lte=end_date
    ).aggregate(total=Sum('cost'))['total'] or 0)
    
    total_misc = float(MiscellaneousExpense.objects.filter(
        created_at__gte=start_date, created_at__lte=end_date
    ).aggregate(total=Sum('cost'))['total'] or 0)
    
    # Final Profit = Revenue - Food Cost - Waste Cost - Misc Expenses
    final_profit = total_revenue - total_food_cost - total_wastage - total_misc

    food_cost_ratio = float((Decimal(total_food_cost) / Decimal(total_revenue) * 100) if total_revenue else 0)

    cash_revenue = float(Transaction.objects.filter(
        order__id__in=paid_order_ids,
        status='success',
        method=Transaction.METHOD_CASH,
    ).aggregate(total=Sum('amount'))['total'] or 0)
    mpesa_revenue = float(Transaction.objects.filter(
        order__id__in=paid_order_ids,
        status='success',
        method=Transaction.METHOD_M_PESA,
    ).aggregate(total=Sum('amount'))['total'] or 0)

    return { # type: ignore
        'range_days': (end_date - start_date).days + 1,
        'range_label': range_label,
        'best_items': best_items,
        'worst_items': worst_items,
        'hourly_sales': hourly,
        'totals': {
            'revenue': _to_display_currency(total_revenue),
            'cash_revenue': _to_display_currency(cash_revenue),
            'mpesa_revenue': _to_display_currency(mpesa_revenue),
            'food_cost': _to_display_currency(total_food_cost),
            'wastage': _to_display_currency(total_wastage),
            'miscellaneous': _to_display_currency(total_misc),
            'profit': _to_display_currency(final_profit),
            'food_cost_ratio': round(food_cost_ratio, 2),
        },
    }


def report_summary(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    period_type = request.GET.get('period_type', 'week') # Default to week
    date_str = request.GET.get('date') # YYYY-MM-DD
    
    start_date, end_date, label = _get_period_dates(period_type, date_str)
    data = _build_report_summary(start_date, end_date, label)
    return JsonResponse(data)


@csrf_exempt
def download_report(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    period_type = request.GET.get('period_type', 'week')
    date_str = request.GET.get('date')
    
    start_date, end_date, label = _get_period_dates(period_type, date_str)
    report_data = _build_report_summary(start_date, end_date, label)
    filename = f"tastybites-report-{report_data['range_label']}.csv"
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow(['Tasty Bites Sales Report'])
    writer.writerow(['Report Type', report_data['range_label']])
    writer.writerow(['Range Days', report_data['range_days']])
    writer.writerow([])

    writer.writerow(['Totals'])
    for key, value in report_data['totals'].items():
        writer.writerow([key, value])
    writer.writerow([])

    writer.writerow(['Best Selling Items'])
    writer.writerow(['Name', 'Quantity', 'Revenue', 'Food Cost'])
    for item in report_data['best_items']:
        writer.writerow([item['name'], item['quantity'], item['revenue'], item['food_cost']])
    writer.writerow([])

    writer.writerow(['Worst Selling Items'])
    writer.writerow(['Name', 'Quantity', 'Revenue', 'Food Cost'])
    for item in report_data['worst_items']:
        writer.writerow([item['name'], item['quantity'], item['revenue'], item['food_cost']])
    writer.writerow([])

    writer.writerow(['Hourly Sales'])
    writer.writerow(['Hour', 'Orders', 'Revenue'])
    for entry in report_data['hourly_sales']:
        writer.writerow([entry['hour'], entry['orders'], entry['revenue']])

    # Add Miscellaneous Expenses
    miscellaneous_logs = MiscellaneousExpense.objects.filter(
        created_at__gte=start_date, created_at__lte=end_date).order_by('-created_at')
    if miscellaneous_logs.exists():
        writer.writerow([])
        writer.writerow(['Miscellaneous Expenses'])
        writer.writerow(['Item', 'Cost', 'Reason', 'Created At'])
        for log in miscellaneous_logs:
            writer.writerow([log.item_name, _to_display_currency(log.cost), log.reason, log.created_at.strftime('%Y-%m-%d %H:%M:%S')])
    return response


@csrf_exempt
def wastage_log(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method == 'GET':
        period_type = request.GET.get('period_type', 'week') # Default to week
        date_str = request.GET.get('date') # YYYY-MM-DD
        
        start_date, end_date, _ = _get_period_dates(period_type, date_str)

        logs = WastageLog.objects.filter(
            created_at__gte=start_date, created_at__lte=end_date).order_by('-created_at')[:100]
        return JsonResponse({'wastage': [
            {
                'id': log.id,
                'item_name': log.item_name,
                'quantity': log.quantity,
                'reason': log.reason,
                'cost': _to_display_currency(log.cost),
                'created_at': log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]})

    if request.method != 'POST':
        return HttpResponseBadRequest('Only GET and POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    item_name = (payload.get('item_name') or '').strip()
    quantity = int(payload.get('quantity') or 1)
    reason = (payload.get('reason') or '').strip()
    cost = Decimal(str(payload.get('cost') or '0') or '0')

    if not item_name or quantity <= 0:
        return JsonResponse({'error': 'item_name and quantity are required'}, status=400)

    log = WastageLog.objects.create(item_name=item_name, quantity=quantity, reason=reason, cost=cost)
    return JsonResponse({
        'id': log.id,
        'item_name': log.item_name,
        'quantity': log.quantity,
        'reason': log.reason,
        'cost': _to_display_currency(log.cost),
        'created_at': log.created_at.isoformat() if log.created_at else None,
    })


@csrf_exempt
def order_update(request, checkout_id: str):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    t = Transaction.objects.filter(checkout_request_id=checkout_id).first()
    if not t:
        return JsonResponse({'error': 'not_found'}, status=404)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        payload = {}

    new_status = payload.get('status')
    if new_status:
        t.status = new_status
        t.save()
        return JsonResponse({'ok': True, 'status': t.status})

    return JsonResponse({'error': 'no_status_provided'}, status=400)

@csrf_exempt
def table_list(request):
    """Returns all tables and their current status."""
    if request.method == 'POST':
        if not _is_admin(request):
            return JsonResponse({'error': 'unauthorized'}, status=403)

        try:
            payload = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        number = (payload.get('number') or '').strip()
        name = (payload.get('name') or '').strip()
        if not number:
            return JsonResponse({'error': 'number is required'}, status=400)

        if Table.objects.filter(number=number).exists():
            return JsonResponse({'error': 'table number already exists'}, status=400)

        table = Table.objects.create(number=number, name=name)
        return JsonResponse({'id': table.id, 'number': table.number, 'name': table.name, 'status': table.status})

    tables = Table.objects.all().order_by('number')
    return JsonResponse({
        'tables': [
            {'id': t.id, 'number': t.number, 'name': t.name, 'status': t.status}
            for t in tables
        ]
    })

@csrf_exempt
def table_update(request, table_id):
    """Updates or removes a table."""
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    try:
        t = Table.objects.get(pk=table_id)
    except Table.DoesNotExist:
        return JsonResponse({'error': 'not_found'}, status=404)

    if request.method == 'DELETE':
        t.delete()
        return JsonResponse({'ok': True})

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    t.status = payload.get('status', t.status)
    t.name = (payload.get('name') or t.name)
    t.save()
    return JsonResponse({'ok': True, 'status': t.status, 'name': t.name})


def get_active_pos_order(request):
    """Retrieves an active order for a given table number."""
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    table_number = request.GET.get('table_number')
    if not table_number:
        return JsonResponse({'error': 'table_number is required'}, status=400)

    try:
        table = Table.objects.get(number=table_number)
        # Find an active order for this table. Prioritize non-completed/cancelled orders.
        order = Order.objects.filter(
            table=table,
            status__in=['pending', 'preparing', 'paid', 'bill_pending']
        ).order_by('-created_at').first() # Get the most recent active order

        if order:
            return JsonResponse(_serialize_order(order))
        else:
            return JsonResponse({'error': 'no_active_order_found'}, status=404)
    except Table.DoesNotExist:
        return JsonResponse({'error': 'table_not_found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': 'server_error', 'message': str(e)}, status=500)


@csrf_exempt
def create_pos_order(request):
    """Creates a full order with items and modifiers."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    # Initialize msisdn at function scope to avoid unbound variable errors
    msisdn = ""

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    items_data = payload.get('items', [])
    if not isinstance(items_data, list) or not items_data:
        return JsonResponse({'error': 'items are required'}, status=400)

    order_type = str(payload.get('order_type', 'table') or 'table').strip().lower()
    table_number = payload.get('table_number')
    phone = str(payload.get('phone', '') or '').strip()
    
    delivery_address = (payload.get('delivery_address') or '').strip()
    delivery_time = (payload.get('delivery_time') or '').strip()
    delivery_distance_km = payload.get('delivery_distance_km')
    delivery_cost_raw = payload.get('delivery_cost')

    payment_method = str(payload.get('payment_method') or Transaction.METHOD_M_PESA).lower()
    if payment_method == Transaction.METHOD_M_PESA:
        if not phone:
            return JsonResponse({'error': 'phone_required', 'message': 'Phone number is required for M-Pesa payments.'}, status=400)
        
        msisdn = _normalize_phone(phone)
        if not msisdn.startswith('254') or len(msisdn) < 12:
            return JsonResponse({'error': 'invalid_phone', 'message': 'Please provide a valid M-Pesa phone number (e.g. 2547XXXXXXXX).'}, status=400)

    try:
        table = None
        # Fix 500 error: Do not attempt to create a Table object for 'Counter' or empty numbers
        # This prevents database type errors if 'number' is an integer field.
        clean_table_no = str(table_number or '').strip()
        if order_type == 'table' and clean_table_no and clean_table_no.lower() != 'counter':
            table, _ = Table.objects.get_or_create(number=clean_table_no, defaults={'name': clean_table_no})

        # Robust Decimal conversion for delivery data
        delivery_cost = Decimal('0.00')
        try:
            delivery_cost = Decimal(str(delivery_cost_raw or '0') or '0')
        except (InvalidOperation, ValueError, TypeError):
            pass

        clean_distance = None
        try:
            if delivery_distance_km not in (None, ''):
                clean_distance = Decimal(str(delivery_distance_km))
        except (InvalidOperation, ValueError, TypeError):
            pass

        total_amount = Decimal('0.00')
        for item in items_data:
            try:
                price = Decimal(str(item.get('price') or '0'))
                quantity = max(1, int(item.get('quantity') or 1))
                total_amount += price * quantity
            except (InvalidOperation, ValueError):
                continue

        total_amount += delivery_cost

        split_count = max(1, int(payload.get('split_count', 1)))
        initial_status = payload.get('status', 'preparing')
        order = Order.objects.create(
            table=table,
            phone=phone,
            delivery_address=delivery_address,
            delivery_distance_km=clean_distance,
            delivery_time=delivery_time,
            delivery_cost=delivery_cost,
            status=initial_status,
            split_count=split_count,
            total_amount=total_amount,
        )

        cash_payment = payment_method == Transaction.METHOD_CASH

        for idx, item in enumerate(items_data):
            try:
                provided_seat = int(item.get('seat_number')) if item.get('seat_number') is not None else 0
            except Exception:
                provided_seat = 0

            if provided_seat > 0:
                seat = provided_seat
            else:
                seat = (idx % split_count) + 1

            modifiers = item.get('modifiers', [])
            if isinstance(modifiers, str):
                modifiers = [mod.strip() for mod in modifiers.split(',') if mod.strip()]
            elif not isinstance(modifiers, list):
                modifiers = []

            # Robust Decimal conversion for OrderItem to prevent 500 crashes
            try:
                i_price = Decimal(str(item.get('price') or '0'))
                i_food_cost = Decimal(str(item.get('food_cost') or item.get('cost') or '0') or '0')
            except (InvalidOperation, ValueError, TypeError):
                i_price = Decimal('0.00')
                i_food_cost = Decimal('0.00')

            OrderItem.objects.create(
                order=order,
                name=str(item.get('name') or '').strip(),
                price=i_price,
                food_cost=i_food_cost,
                quantity=max(1, int(item.get('quantity') or 1)),
                modifiers=modifiers,
                seat_number=seat,
            )

        if table:
            table.status = Table.STATUS_OCCUPIED
            table.save()

        stk_data = None
        if cash_payment:
            Transaction.objects.create(
                phone=phone,
                amount=total_amount,
                item='Cash payment',
                order=order,
                status='success',
                method=Transaction.METHOD_CASH,
                raw_response={'source': 'cash_payment'},
            )
            # cash payments immediately settle the order
            try:
                order.status = 'paid'
                order.save()
                if order.table:
                    order.table.status = Table.STATUS_AVAILABLE
                    order.table.save(update_fields=['status'])
            except Exception:
                pass

        elif payment_method == Transaction.METHOD_M_PESA:
            tx = Transaction.objects.create(
                phone=msisdn,
                amount=total_amount,
                item="POS Order",
                order=order,
                status='pending',
                method=Transaction.METHOD_M_PESA,
            )
            # Use a simple alphanumeric reference to avoid M-Pesa Status 500 errors
            stk_data, status_code = _execute_stk_push(msisdn, total_amount, "POSOrder", tx)
            
            # If STK Push failed at initiation, return that specific error immediately
            if status_code != 200:
                return JsonResponse(stk_data, status=status_code)

        return JsonResponse({
            **_serialize_order(order), 'stk_response': stk_data # Include STK response for frontend polling if needed
        })
    except Exception as exc:
        error_message = str(exc)
        print(f"create_pos_order error: {error_message}")
        return JsonResponse({'error': 'server_error', 'message': error_message}, status=500)

@csrf_exempt
def add_to_pos_order(request, order_id):
    """Adds new items to an existing active order (KOT update)."""
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
        
    try:
        order = Order.objects.get(order_id=order_id)
        payload = json.loads(request.body.decode('utf-8'))
        items_data = payload.get('items', [])
        
        new_total = order.total_amount
        for item in items_data:
            price = Decimal(str(item.get('price', 0)))
            quantity = max(1, int(item.get('quantity', 1)))
            
            OrderItem.objects.create(
                order=order,
                name=str(item.get('name', '')).strip(),
                price=price,
                food_cost=Decimal(str(item.get('food_cost') or item.get('cost') or 0)),
                quantity=quantity,
                modifiers=item.get('modifiers', []),
                seat_number=item.get('seat_number', 1)
            )
            new_total += (price * quantity)
            
        order.total_amount = new_total
        order.save()
        
        return JsonResponse(_serialize_order(order))
    except Order.DoesNotExist:
        return JsonResponse({'error': 'order_not_found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': 'server_error', 'message': str(e)}, status=500)

def kds_queue(request):
    """Live queue for the kitchen."""
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        # Optimization: use select_related and prefetch_related to reduce DB queries
        orders = Order.objects.filter(
            status__in=['preparing', 'pending', 'paid']
        ).select_related('table').prefetch_related('items').order_by('created_at')

        results = []
        for o in orders:
            # Safer item serialization
            items = [{
                'name': i.name,
                'quantity': i.quantity,
                'seat': i.seat_number,
                'is_served': i.is_served,
                'modifiers': i.modifiers if isinstance(i.modifiers, list) else []
            } for i in o.items.all()]
            
            # Safer table access
            table_display = 'Takeaway'
            if o.table:
                table_display = o.table.number or o.table.name or f"Table {o.table.id}"
            elif o.delivery_address:
                table_display = 'Delivery'

            results.append({
                'order_id': o.order_id,
                'table': table_display,
                'items': items,
                'created_at': o.created_at.isoformat() if o.created_at else None,
                'status': o.status,
                'phone': o.phone,
                'total_amount': float(o.total_amount or 0), # Robustness against None
                'split_count': o.split_count or 1,
            })

        return JsonResponse({'queue': results})
    except Exception as e:
        # Log the actual error to server console and return a JSON error instead of crashing
        print(f"KDS Queue Error: {str(e)}")
        return JsonResponse({'error': 'server_error', 'message': str(e)}, status=500)

@csrf_exempt
def order_complete(request, order_id):
    """Kitchen marks order as ready/served."""
    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)
    
    order.status = 'ready'
    order.save()
    return JsonResponse({'ok': True})

@csrf_exempt
def mark_item_served(request, order_id, item_index):
    """Waiter marks a specific item in an order as served."""
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    try:
        order = Order.objects.get(order_id=order_id)
        # We convert to a list to match the index sent from the frontend map
        items = list(order.items.all().order_by('id'))
        idx = int(item_index)
        
        if 0 <= idx < len(items):
            item = items[idx]
            item.is_served = True
            item.save()
            return JsonResponse({'ok': True, 'order': _serialize_order(order)})
        else:
            return JsonResponse({'error': 'item_not_found'}, status=404)
    except Order.DoesNotExist:
        return JsonResponse({'error': 'order_not_found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def request_bill(request, order_id):
    """Waiter signals that the customer is ready to pay."""
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    try:
        order = Order.objects.get(order_id=order_id)
        order.status = 'bill_pending'
        order.save()
        
        if order.table:
            order.table.status = 'bill_pending'
            order.table.save()
            
        return JsonResponse({'ok': True, 'order': _serialize_order(order)})
    except Order.DoesNotExist:
        return JsonResponse({'error': 'order_not_found'}, status=404)

@csrf_exempt
def initiate_split_payment(request):
    """Initiates an STK push for a portion of the bill."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
        order = Order.objects.get(order_id=payload.get('order_id'))
        phone = payload.get('phone')
        if not phone:
            return JsonResponse({'error': 'phone_required'}, status=400)
        # If amount isn't provided, we split the total by the split_count
        amount_provided = payload.get('amount')
        if amount_provided:
            amount = Decimal(str(amount_provided))
        else:
            amount = order.total_amount / order.split_count
    except (Order.DoesNotExist, Exception):
        return JsonResponse({'error': 'invalid_request'}, status=400)

    msisdn = _normalize_phone(phone)
    
    # Create the transaction linked to the order
    tx = Transaction.objects.create(
        phone=msisdn,
        amount=amount,
        item=f"Table {order.table.number if order.table else 'POS'} Bill",
        order=order,
        status='pending',
        method=Transaction.METHOD_M_PESA,
    )

    response_body, status_code = _execute_stk_push(msisdn, amount, f"Order {order.order_id}", tx)
    return JsonResponse(response_body, status=status_code)

def get_receipt_data(request, order_id):
    """Generates a structured dictionary for thermal printer consumption."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    items = []
    for i in order.items.all():  # type: ignore
        items.append({
            'name': i.name,
            'qty': i.quantity,
            'seat': i.seat_number,
            'is_served': i.is_served,
            'price': float(i.price),
            'modifiers': i.modifiers,
            'subtotal': float(i.subtotal)
        })

    app_settings = AppSettings.current()
    
    data = {
        'header': 'TASTY BITES HUB',
        'order_no': order.order_id,
        'table': order.table.number if order.table else 'Takeaway',
        'timestamp': order.created_at.strftime('%Y-%m-%d %H:%M:%S') if order.created_at else '',
        'items': items,
        'total': float(order.total_amount),
        'split_count': order.split_count,
        'per_person': float(order.total_amount / order.split_count) if order.split_count > 1 else float(order.total_amount),
        'currency': app_settings.display_currency,
        'is_paid': order.is_paid,
        'phone': order.phone,
        'footer': 'Thank you for dining with us!'
    }
    
    return JsonResponse(data)