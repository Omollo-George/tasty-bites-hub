import base64
import csv
import datetime
import json
import requests
import uuid
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db.models import Q, Sum, F, Count, ExpressionWrapper, DecimalField
from django.db.models.functions import ExtractHour
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseServerError, HttpResponse
from django.utils import timezone
from django.core.mail import send_mail
from django.views.decorators.csrf import csrf_exempt
from datetime import timedelta
from .models import AdminToken, AdminUser, AppSettings, MenuItem, Transaction, Table, Order, OrderItem, WastageLog, Employee, StockLog, AdminSessionLog


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
    if getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox') == 'sandbox':
        oauth_url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    else:
        oauth_url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'

    try:
        resp = requests.get(oauth_url, auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET), timeout=10)
        resp.raise_for_status()
        return resp.json().get('access_token')
    except requests.RequestException as e:
        raise Exception(f"M-Pesa API Auth failed: {e}")
    except json.JSONDecodeError:
        raise Exception("M-Pesa API returned invalid JSON during auth.")
    except Exception as e:
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

    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    account_reference = account_ref.replace(' ', '')[:12] or 'TASTYBITES'
    transaction_desc = f"Tasty Bites {account_ref}"[:20].strip() or 'Payment'

    body = {
        'BusinessShortCode': shortcode,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': 'CustomerPayBillOnline',
        'Amount': max(1, int(amount)), # Ensure amount is at least 1
        'PartyA': msisdn,
        'PartyB': shortcode,
        'PhoneNumber': msisdn,
        'CallBackURL': callback_url,
        'AccountReference': account_reference,
        'TransactionDesc': transaction_desc,
    }

    try:
        r = requests.post(stk_url, json=body, headers=headers, timeout=30)
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
            return resp_json, 200
        else:
            tx.status = 'error'
            tx.save()
            
            # Capture the most descriptive error message possible from Safaricom
            error_msg = (
                resp_json.get('errorMessage') or 
                resp_json.get('ResponseDescription') or 
                f"M-Pesa rejected request (Status {r.status_code})"
            )
            return {'error': 'stk_rejected', 'message': error_msg, 'details': resp_json}, 400
    except Exception as e:
        tx.status = 'error'
        tx.raw_response = {'error': str(e)}
        tx.save()
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
        amount = int(float(payload.get('amount') or 1))
    except (ValueError, TypeError):
        amount = 1

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
        tx.status = 'success' if result_code == 0 else 'failed'
        tx.method = Transaction.METHOD_M_PESA
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
        except Exception:
            # protect callback from crashing if DB-side logic fails
            pass
    else:
        # create a record if not found
        Transaction.objects.create(
            merchant_request_id=merchant_id,
            checkout_request_id=checkout_id,
            phone='',
            amount=0,
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
    # Default phone and conversion rate are no longer exposed via this endpoint
    # as per the request.
    return JsonResponse({
        'base_currency': 'KES',
        'display_currency': 'KES',
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

    user = AdminUser(username=username)
    user.set_password(password)
    user.save()

    if not users_exist:
        log = AdminSessionLog.objects.create(user=user)
        # Set initial expiry to 4 hours
        expiry = timezone.now() + timedelta(hours=4)
        token = AdminToken.objects.create(user=user, session_log=log, expires_at=expiry)
        return JsonResponse({'token': token.token, 'username': user.username})

    return JsonResponse({'ok': True, 'username': user.username})


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
                user.save(update_fields=['failed_login_attempts', 'lockout_until'])
                return JsonResponse(
                    {
                        'error': f'Too many failed attempts. Try again in {int(lockout_length.total_seconds() // 60)} minutes.',
                        'lockout_seconds': int(lockout_length.total_seconds()),
                    },
                    status=429,
                )
            else:
                attempts_left = max_attempts - user.failed_login_attempts
                user.save(update_fields=['failed_login_attempts'])
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
    user.save(update_fields=['failed_login_attempts', 'lockout_until'])

    log = AdminSessionLog.objects.create(user=user)
    # Set initial expiry to 4 hours
    expiry = timezone.now() + timedelta(hours=4)
    token = AdminToken.objects.create(user=user, session_log=log, expires_at=expiry)
    return JsonResponse({'token': token.token, 'username': user.username})


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

    app_settings.save()

    return JsonResponse({
        'base_currency': app_settings.base_currency,
        'display_currency': app_settings.display_currency,
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
    }


def _get_default_menu_items():
    return [
        { 'name': 'Classic Smash Burger', 'price': Decimal('750.00'), 'food_cost': Decimal('250.00'), 'category': 'Burgers', 'description': 'Double patty, cheddar, pickles, special sauce', 'popular': True, 'spicy': False },
        { 'name': 'Spicy Chicken Burger', 'price': Decimal('780.00'), 'food_cost': Decimal('260.00'), 'category': 'Burgers', 'description': 'Crispy chicken, jalapeños, sriracha mayo', 'popular': False, 'spicy': True },
        { 'name': 'BBQ Bacon Burger', 'price': Decimal('860.00'), 'food_cost': Decimal('290.00'), 'category': 'Burgers', 'description': 'Smoked bacon, BBQ glaze, onion rings', 'popular': True, 'spicy': False },
        { 'name': 'Veggie Deluxe', 'price': Decimal('690.00'), 'food_cost': Decimal('230.00'), 'category': 'Burgers', 'description': 'Plant-based patty, avocado, fresh greens', 'popular': False, 'spicy': False },
        { 'name': 'Loaded Fries', 'price': Decimal('360.00'), 'food_cost': Decimal('120.00'), 'category': 'Sides', 'description': 'Cheese sauce, bacon bits, green onions', 'popular': True, 'spicy': False },
        { 'name': 'Onion Rings', 'price': Decimal('280.00'), 'food_cost': Decimal('90.00'), 'category': 'Sides', 'description': 'Beer-battered, crispy golden perfection', 'popular': False, 'spicy': False },
        { 'name': 'Chicken Wings (8pc)', 'price': Decimal('720.00'), 'food_cost': Decimal('240.00'), 'category': 'Sides', 'description': 'Choice of buffalo, BBQ, or garlic parmesan', 'popular': True, 'spicy': False },
        { 'name': 'Coleslaw', 'price': Decimal('210.00'), 'food_cost': Decimal('70.00'), 'category': 'Sides', 'description': 'Creamy homestyle coleslaw', 'popular': False, 'spicy': False },
        { 'name': 'Classic Milkshake', 'price': Decimal('420.00'), 'food_cost': Decimal('130.00'), 'category': 'Drinks', 'description': 'Vanilla, chocolate, or strawberry', 'popular': True, 'spicy': False },
        { 'name': 'Fresh Lemonade', 'price': Decimal('290.00'), 'food_cost': Decimal('90.00'), 'category': 'Drinks', 'description': 'Freshly squeezed with a hint of mint', 'popular': False, 'spicy': False },
        { 'name': 'Iced Tea', 'price': Decimal('220.00'), 'food_cost': Decimal('70.00'), 'category': 'Drinks', 'description': 'Brewed daily, sweetened or unsweetened', 'popular': False, 'spicy': False },
        { 'name': 'Brownie Sundae', 'price': Decimal('460.00'), 'food_cost': Decimal('150.00'), 'category': 'Desserts', 'description': 'Warm brownie, vanilla ice cream, hot fudge', 'popular': True, 'spicy': False },
        { 'name': 'Apple Pie Bites', 'price': Decimal('330.00'), 'food_cost': Decimal('100.00'), 'category': 'Desserts', 'description': 'Cinnamon sugar dusted, served warm', 'popular': False, 'spicy': False },
    ]


def _ensure_menu_items(seed: bool = True):
    # Only seed default menu items when explicitly requested.
    if not seed:
        return
    if not MenuItem.objects.exists():
        for item_data in _get_default_menu_items():
            MenuItem.objects.create(
                name=item_data['name'],
                category=item_data['category'],
                price=item_data['price'],
                food_cost=item_data['food_cost'],
                description=item_data['description'],
                popular=item_data['popular'],
                spicy=item_data['spicy'],
                stock_level=50, # Default stock level for new items
                min_stock_level=10, # Default min stock level for new items
            )



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

    item = MenuItem.objects.create(
        name=name,
        category=category,
        price=price,
        food_cost=food_cost,
        description=description,
        popular=popular,
        spicy=spicy,
    )

    return JsonResponse({'menu_item': _serialize_menu_item(item)})

@csrf_exempt
def employees_list(request):
    """Lists all employees and handles creation via POST."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method == 'GET':
        employees = Employee.objects.all().order_by('-created_at')
        data = [{
            'id': e.id,
            'name': e.name,
            'role': e.role,
            'phone': e.phone,
            'email': e.email,
            'salary': float(e.salary),
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
                salary=Decimal(str(payload.get('salary', 0))),
                status=payload.get('status', 'active')
            )
            return JsonResponse({'ok': True, 'id': emp.id})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return HttpResponseBadRequest('Method not allowed')

@csrf_exempt
def employee_detail(request, employee_id: int):
    """Handles update and delete for a specific employee."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    emp = Employee.objects.filter(id=employee_id).first()
    if not emp:
        return JsonResponse({'error': 'not_found'}, status=404)

    if request.method == 'POST': # Update
        try:
            payload = json.loads(request.body.decode('utf-8'))
            if 'name' in payload: emp.name = payload['name']
            if 'role' in payload: emp.role = payload['role']
            if 'phone' in payload: emp.phone = payload['phone']
            if 'email' in payload: emp.email = payload['email']
            if 'salary' in payload: emp.salary = Decimal(str(payload['salary']))
            if 'status' in payload: emp.status = payload['status']
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

        send_mail(
            subject,
            message,
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'admin@tastybites.com'),
            [emp.email],
            fail_silently=False,
        )
        return JsonResponse({'ok': True})
    except Exception as e:
        return JsonResponse({'error': f"Failed to send email: {str(e)}"}, status=500)


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





def _serialize_order(order):
    total_food_cost = sum((item.food_cost or Decimal('0.00')) * item.quantity for item in order.items.all())
    return {
        'order_id': order.order_id,
        'table': {
            'id': order.table.id,
            'number': order.table.number,
            'name': order.table.name,
        } if order.table else None,
        'phone': order.phone,
        'status': order.status,
        'split_count': order.split_count,
        'total_amount': float(order.total_amount),
        'food_cost': float(total_food_cost),
        'is_paid': order.is_paid,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'items': [
            {
                'name': item.name,
                'price': float(item.price),
                'food_cost': float(item.food_cost or Decimal('0.00')),
                'quantity': item.quantity,
                'modifiers': item.modifiers or [],
                'subtotal': float(item.price * item.quantity),
            }
            for item in order.items.all().order_by('id')
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
    for item in order.items.all().order_by('id'):
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

    order = Order.objects.create(
        table=table,
        phone=phone,
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

    order.total_amount = total
    order.save()

    if table:
        table.status = Table.STATUS_OCCUPIED
        table.save(update_fields=['status'])

    return JsonResponse(_serialize_order(order))


def queue_list(request):
    orders = Order.objects.all().order_by('-created_at')[:100]
    return JsonResponse({'results': [_serialize_order(order) for order in orders]})


@csrf_exempt
def order_status_update(request, order_id: str):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
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

    if status in ['completed', 'cancelled', 'served'] and order.table:
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

    item = order.items.filter(id=item_id).first()
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

    total_amount = sum((i.price or Decimal('0.00')) * i.quantity for i in order.items.all())
    order.total_amount = total_amount
    order.save()

    return JsonResponse(_serialize_order(order))


def order_receipt(request, order_id: str):
    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    return JsonResponse({
        'receipt_text': _build_receipt_text(order),
        'order': _serialize_order(order),
    })


def orders_list(request):
    orders = Order.objects.all().order_by('-created_at')[:100]
    data = [
        {
            'order_id': order.order_id,
            'table': order.table.number if order.table else 'Takeaway',
            'phone': order.phone,
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
    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    return JsonResponse({
        'order_id': order.order_id,
        'table': order.table.number if order.table else 'Takeaway',
        'phone': order.phone,
        'status': order.status,
        'total_amount': float(order.total_amount),
        'split_count': order.split_count,
        'is_paid': order.is_paid,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'items': [
            {
                'id': item.id,
                'name': item.name,
                'quantity': item.quantity,
                'price': float(item.price),
                'modifiers': item.modifiers or [],
                'seat_number': item.seat_number,
                'subtotal': float(item.subtotal),
            }
            for item in order.items.all().order_by('id')
        ],
    })


def _normalize_report_range(range_label: str):
    if not isinstance(range_label, str):
        return 7

    value = range_label.strip().lower()
    if value in ('daily', 'day', '1'):
        return 1
    if value in ('weekly', 'week', '7'):
        return 7
    if value in ('monthly', 'month', '30'):
        return 30

    try:
        days = int(value)
    except (TypeError, ValueError):
        days = 7
    return min(max(days, 1), 365)


def _parse_report_range(range_label: str):
    days = _normalize_report_range(range_label)
    return timezone.now() - datetime.timedelta(days=days)


def _format_range_label(range_label: str):
    days = _normalize_report_range(range_label)
    if days == 1:
        return 'daily'
    if days == 7:
        return 'weekly'
    if days == 30:
        return 'monthly'
    return f'last_{days}_days'


def _build_report_summary(range_label: str):
    start_date = _parse_report_range(range_label)

    # Consider only orders that have completed (successful) transactions in the period
    paid_order_ids = Transaction.objects.filter(
        status='success',
        order__isnull=False,
        order__created_at__gte=start_date,
    ).values_list('order', flat=True).distinct()

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
            'hour': row['hour'],
            'orders': row['orders'],
            'revenue': _to_display_currency(row['revenue'] or 0),
        })

    # Revenue is computed from successful transactions within the period
    total_revenue = float(Transaction.objects.filter(order__created_at__gte=start_date, status='success').aggregate(total=Sum('amount'))['total'] or 0)
    total_cost = float(order_items.aggregate(total=Sum(F('food_cost') * F('quantity'), output_field=DecimalField()))['total'] or 0)
    total_profit = total_revenue - total_cost
    food_cost_ratio = float((Decimal(total_cost) / Decimal(total_revenue) * 100) if total_revenue else 0)

    cash_revenue = float(Transaction.objects.filter(
        order__created_at__gte=start_date,
        status='success',
        method=Transaction.METHOD_CASH,
    ).aggregate(total=Sum('amount'))['total'] or 0)
    mpesa_revenue = float(Transaction.objects.filter(
        order__created_at__gte=start_date,
        status='success',
        method=Transaction.METHOD_M_PESA,
    ).aggregate(total=Sum('amount'))['total'] or 0)

    return {
        'range_days': _normalize_report_range(range_label),
        'range_label': _format_range_label(range_label),
        'best_items': best_items,
        'worst_items': worst_items,
        'hourly_sales': hourly,
        'totals': {
            'revenue': _to_display_currency(total_revenue),
            'cash_revenue': _to_display_currency(cash_revenue),
            'mpesa_revenue': _to_display_currency(mpesa_revenue),
            'food_cost': _to_display_currency(total_cost),
            'profit': _to_display_currency(total_profit),
            'food_cost_ratio': round(food_cost_ratio, 2),
        },
    }


def report_summary(request):
    range_label = request.GET.get('range', '7')
    data = _build_report_summary(range_label)
    return JsonResponse(data)


@csrf_exempt
def download_report(request):
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    range_label = request.GET.get('range', '7')
    report_data = _build_report_summary(range_label)
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

    return response


@csrf_exempt
def wastage_log(request):
    if request.method == 'GET':
        logs = WastageLog.objects.all().order_by('-created_at')[:100]
        return JsonResponse({'wastage': [
            {
                'id': log.id,
                'item_name': log.item_name,
                'quantity': log.quantity,
                'reason': log.reason,
                'cost': float(log.cost),
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
        'cost': float(log.cost),
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
    if not _is_admin(request):
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

@csrf_exempt
def create_pos_order(request):
    """Creates a full order with items and modifiers."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

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

    payment_method = str(payload.get('payment_method') or Transaction.METHOD_M_PESA).lower()
    if payment_method == Transaction.METHOD_M_PESA:
        if not phone:
            return JsonResponse({'error': 'phone_required', 'message': 'Phone number is required for M-Pesa payments.'}, status=400)
        
        msisdn = _normalize_phone(phone)
        if not msisdn.startswith('254') or len(msisdn) < 12:
            return JsonResponse({'error': 'invalid_phone', 'message': 'Please provide a valid M-Pesa phone number (e.g. 2547XXXXXXXX).'}, status=400)

    try:
        table = None
        if order_type != 'takeaway' and table_number:
            table, _ = Table.objects.get_or_create(number=str(table_number), defaults={'name': str(table_number)})

        total_amount = Decimal('0.00')
        for item in items_data:
            price = Decimal(str(item.get('price') or '0'))
            quantity = max(1, int(item.get('quantity') or 1))
            total_amount += price * quantity

        split_count = max(1, int(payload.get('split_count', 1)))
        order = Order.objects.create(
            table=table,
            phone=phone,
            status='preparing',
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

            OrderItem.objects.create(
                order=order,
                name=str(item.get('name') or '').strip(),
                price=Decimal(str(item.get('price') or '0')),
                food_cost=Decimal(str(item.get('food_cost') or item.get('cost') or '0') or '0'),
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
                item=f"Order {order.order_id}",
                order=order,
                status='pending',
                method=Transaction.METHOD_M_PESA,
            )
            stk_data, status_code = _execute_stk_push(msisdn, total_amount, f"Order {order.order_id}", tx)
            
            # If STK Push failed at initiation, return that specific error immediately
            if status_code != 200:
                return JsonResponse(stk_data, status=status_code)

        return JsonResponse({
            'order_id': order.order_id,
            'status': order.status,
            'total_amount': float(order.total_amount),
            'table': table.number if table else None,
            'order_type': 'takeaway' if order_type == 'takeaway' else 'table',
            'is_paid': order.is_paid,
            'payment_method': payment_method,
            'stk_response': stk_data,
        })
    except Exception as exc:
        error_message = str(exc)
        print(f"create_pos_order error: {error_message}")
        return JsonResponse({'error': 'server_error', 'message': error_message}, status=500)

def kds_queue(request):
    """Live queue for the kitchen."""
    orders = Order.objects.filter(
        status__in=['preparing', 'pending', 'paid']
    ).order_by('created_at')

    results = []
    for o in orders:
        items = [{
            'name': i.name,
            'quantity': i.quantity,
            'seat': i.seat_number,
            'modifiers': i.modifiers
        } for i in o.items.all()]
        
        results.append({
            'order_id': o.order_id,
            'table': o.table.number if o.table else 'Takeaway',
            'items': items,
            'created_at': o.created_at.isoformat() if o.created_at else None,
            'status': o.status,
            'phone': o.phone,
            'total_amount': float(o.total_amount),
            'split_count': o.split_count,
        })

    return JsonResponse({'queue': results})

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
        amount = payload.get('amount') or (order.total_amount / order.split_count)
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
    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    items = []
    for i in order.items.all():
        items.append({
            'name': i.name,
            'qty': i.quantity,
            'seat': i.seat_number,
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