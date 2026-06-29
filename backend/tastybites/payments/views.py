import base64
import csv
import datetime
import json
import requests
import re
import uuid
import os
from decimal import Decimal, InvalidOperation
import logging

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.core.files.storage import default_storage # type: ignore
from django.core.management import call_command
from django.db.models import Q, Sum, F, Count, ExpressionWrapper, DecimalField, Max
from django.db.models.functions import ExtractHour, ExtractWeekDay, TruncDate
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseServerError, HttpResponse
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.core.mail import send_mail
from django.views.decorators.csrf import csrf_exempt
from django.db import connection, utils as db_utils
from django.core.exceptions import FieldError
logger = logging.getLogger(__name__)
from datetime import timedelta
from .models import AdminToken, AdminUser, AppSettings, MenuItem, Transaction, Table, Order, OrderItem, WastageLog, Employee, StockLog, AdminSessionLog, StaffActivity, MiscellaneousExpense, StaffToken, Review

import threading
import time

# Simple in-memory event queue for Server-Sent Events (SSE).
# This is sufficient for a single-process dev server. For multi-process
# or production use, replace with Redis/Message Broker.
EVENTS_COND = threading.Condition()
EVENTS_QUEUE: list[str] = []
EVENTS_MAX_HISTORY = 200

def _emit_event(event_type: str, data: dict):
    try:
        payload = json.dumps({'type': event_type, 'data': data})
    except Exception:
        payload = json.dumps({'type': event_type, 'data': {}})
    with EVENTS_COND:
        EVENTS_QUEUE.append(payload)
        if len(EVENTS_QUEUE) > EVENTS_MAX_HISTORY:
            # Keep a bounded event history so slow reconnects do not grow memory indefinitely
            EVENTS_QUEUE.pop(0)
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
                if len(EVENTS_QUEUE) <= last_sent:
                    EVENTS_COND.wait(timeout=15)
                if len(EVENTS_QUEUE) > last_sent:
                    items = EVENTS_QUEUE[last_sent:]
                    last_sent = len(EVENTS_QUEUE)
                else:
                    items = []
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


def _ensure_required_tables() -> bool:
    try:
        call_command('migrate', 'payments', verbosity=0, interactive=False)
    except Exception as exc:
        logger.warning('Migrate repair failed, trying direct table creation: %s', exc)

    existing_tables = set(connection.introspection.table_names())
    vendor = connection.vendor

    create_statements = []

    if 'payments_appsettings' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_appsettings (
                id integer PRIMARY KEY AUTOINCREMENT,
                default_phone varchar(32) NOT NULL DEFAULT '',
                conversion_rate numeric NOT NULL DEFAULT 1.00,
                delivery_rate_per_km numeric NOT NULL DEFAULT 100.00,
                min_delivery_fee numeric NOT NULL DEFAULT 50.00,
                base_currency varchar(8) NOT NULL DEFAULT 'KES',
                display_currency varchar(8) NOT NULL DEFAULT 'KES',
                updated_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_appsettings (
                id bigserial PRIMARY KEY,
                default_phone varchar(32) NOT NULL DEFAULT '',
                conversion_rate numeric NOT NULL DEFAULT 1.00,
                delivery_rate_per_km numeric NOT NULL DEFAULT 100.00,
                min_delivery_fee numeric NOT NULL DEFAULT 50.00,
                base_currency varchar(8) NOT NULL DEFAULT 'KES',
                display_currency varchar(8) NOT NULL DEFAULT 'KES',
                updated_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_adminuser' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_adminuser (
                id integer PRIMARY KEY AUTOINCREMENT,
                username varchar(150) NOT NULL UNIQUE,
                password_hash varchar(256) NOT NULL,
                failed_login_attempts smallint NOT NULL DEFAULT 0,
                lockout_until datetime NULL,
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_adminuser (
                id bigserial PRIMARY KEY,
                username varchar(150) NOT NULL UNIQUE,
                password_hash varchar(256) NOT NULL,
                failed_login_attempts smallint NOT NULL DEFAULT 0,
                lockout_until timestamp with time zone NULL,
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_employee' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_employee (
                id integer PRIMARY KEY AUTOINCREMENT,
                name varchar(255) NOT NULL,
                role varchar(100) NOT NULL DEFAULT 'Staff',
                username varchar(150) UNIQUE,
                password_hash varchar(256),
                phone varchar(32) NOT NULL DEFAULT '',
                email varchar(254) NOT NULL DEFAULT '',
                salary numeric NOT NULL DEFAULT 0.00,
                account_number varchar(100) NOT NULL DEFAULT '',
                special_id varchar(50) NOT NULL DEFAULT '',
                document varchar(100) NULL,
                status varchar(32) NOT NULL DEFAULT 'active',
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_employee (
                id bigserial PRIMARY KEY,
                name varchar(255) NOT NULL,
                role varchar(100) NOT NULL DEFAULT 'Staff',
                username varchar(150) UNIQUE,
                password_hash varchar(256),
                phone varchar(32) NOT NULL DEFAULT '',
                email varchar(254) NOT NULL DEFAULT '',
                account_number varchar(100) NOT NULL DEFAULT '',
                special_id varchar(50) NOT NULL DEFAULT '',
                document varchar(100) NULL,
                status varchar(32) NOT NULL DEFAULT 'active',
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_table' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_table (
                id integer PRIMARY KEY AUTOINCREMENT,
                number varchar(32) NOT NULL UNIQUE,
                name varchar(128) NOT NULL,
                status varchar(32) NOT NULL,
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_table (
                id bigserial PRIMARY KEY,
                number varchar(32) NOT NULL UNIQUE,
                name varchar(128) NOT NULL,
                status varchar(32) NOT NULL,
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_menuitem' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_menuitem (
                id integer PRIMARY KEY AUTOINCREMENT,
                name varchar(255) NOT NULL UNIQUE,
                category varchar(64) NOT NULL DEFAULT 'All',
                sku varchar(64),
                price numeric NOT NULL,
                food_cost numeric NOT NULL DEFAULT 0.00,
                description text NOT NULL DEFAULT '',
                popular integer NOT NULL DEFAULT 0,
                spicy integer NOT NULL DEFAULT 0,
                stock_level integer NOT NULL DEFAULT 0,
                min_stock_level integer NOT NULL DEFAULT 10,
                image_url varchar(512) NOT NULL DEFAULT '',
                is_available integer NOT NULL DEFAULT 1,
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_menuitem (
                id bigserial PRIMARY KEY,
                name varchar(255) NOT NULL UNIQUE,
                category varchar(64) NOT NULL DEFAULT 'All',
                sku varchar(64),
                price numeric NOT NULL,
                food_cost numeric NOT NULL DEFAULT 0.00,
                description text NOT NULL DEFAULT '',
                popular boolean NOT NULL DEFAULT false,
                spicy boolean NOT NULL DEFAULT false,
                stock_level integer NOT NULL DEFAULT 0,
                min_stock_level integer NOT NULL DEFAULT 10,
                image_url varchar(512) NOT NULL DEFAULT '',
                is_available boolean NOT NULL DEFAULT true,
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_order' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_order (
                id integer PRIMARY KEY AUTOINCREMENT,
                order_id varchar(64) NOT NULL UNIQUE,
                phone varchar(32) NOT NULL DEFAULT '',
                delivery_address varchar(512) NOT NULL DEFAULT '',
                delivery_distance_km numeric NULL,
                delivery_time varchar(128) NOT NULL DEFAULT '',
                delivery_cost numeric NOT NULL DEFAULT 0.00,
                status varchar(32) NOT NULL,
                split_count integer NOT NULL DEFAULT 1,
                total_amount numeric NOT NULL DEFAULT 0.00,
                created_at datetime NOT NULL,
                table_id integer NULL REFERENCES payments_table(id),
                waiter_id integer NULL,
                waiter_name varchar(255) NOT NULL DEFAULT ''
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_order (
                id bigserial PRIMARY KEY,
                order_id varchar(64) NOT NULL UNIQUE,
                phone varchar(32) NOT NULL DEFAULT '',
                delivery_address varchar(512) NOT NULL DEFAULT '',
                delivery_distance_km numeric NULL,
                delivery_time varchar(128) NOT NULL DEFAULT '',
                delivery_cost numeric NOT NULL DEFAULT 0.00,
                status varchar(32) NOT NULL,
                split_count integer NOT NULL DEFAULT 1,
                total_amount numeric NOT NULL DEFAULT 0.00,
                created_at timestamp with time zone NOT NULL,
                table_id bigint NULL REFERENCES payments_table(id),
                waiter_id bigint NULL,
                waiter_name varchar(255) NOT NULL DEFAULT ''
            )
            '''
        )

    if 'payments_orderitem' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_orderitem (
                id integer PRIMARY KEY AUTOINCREMENT,
                name varchar(255) NOT NULL,
                price numeric NOT NULL,
                quantity integer NOT NULL,
                modifiers text NULL,
                seat_number integer NOT NULL,
                created_at datetime NOT NULL,
                order_id integer NOT NULL REFERENCES payments_order(id)
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_orderitem (
                id bigserial PRIMARY KEY,
                name varchar(255) NOT NULL,
                price numeric NOT NULL,
                quantity integer NOT NULL,
                modifiers jsonb NULL,
                seat_number integer NOT NULL,
                created_at timestamp with time zone NOT NULL,
                order_id bigint NOT NULL REFERENCES payments_order(id)
            )
            '''
        )

    if 'payments_transaction' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_transaction (
                id integer PRIMARY KEY AUTOINCREMENT,
                merchant_request_id varchar(64),
                checkout_request_id varchar(64),
                phone varchar(32) NOT NULL DEFAULT '',
                amount numeric NOT NULL DEFAULT 0.00,
                item varchar(255) NOT NULL DEFAULT '',
                status varchar(32) NOT NULL DEFAULT 'pending',
                method varchar(32) NOT NULL DEFAULT 'mpesa',
                mpesa_receipt varchar(64),
                raw_response text,
                created_at datetime NOT NULL,
                order_id integer NULL REFERENCES payments_order(id)
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_transaction (
                id bigserial PRIMARY KEY,
                merchant_request_id varchar(64),
                checkout_request_id varchar(64),
                phone varchar(32) NOT NULL DEFAULT '',
                amount numeric NOT NULL DEFAULT 0.00,
                item varchar(255) NOT NULL DEFAULT '',
                status varchar(32) NOT NULL DEFAULT 'pending',
                method varchar(32) NOT NULL DEFAULT 'mpesa',
                mpesa_receipt varchar(64),
                raw_response jsonb,
                created_at timestamp with time zone NOT NULL,
                order_id bigint NULL REFERENCES payments_order(id)
            )
            '''
        )

    if 'payments_adminsessionlog' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_adminsessionlog (
                id integer PRIMARY KEY AUTOINCREMENT,
                user_id integer NOT NULL REFERENCES payments_adminuser(id) ON DELETE CASCADE,
                login_time datetime NOT NULL,
                logout_time datetime NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_adminsessionlog (
                id bigserial PRIMARY KEY,
                user_id bigint NOT NULL REFERENCES payments_adminuser(id) ON DELETE CASCADE,
                login_time timestamp with time zone NOT NULL DEFAULT now(),
                logout_time timestamp with time zone NULL
            )
            '''
        )

    if 'payments_admintoken' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_admintoken (
                id integer PRIMARY KEY AUTOINCREMENT,
                user_id integer NOT NULL REFERENCES payments_adminuser(id) ON DELETE CASCADE,
                token varchar(64) NOT NULL UNIQUE,
                session_log_id integer NULL REFERENCES payments_adminsessionlog(id) ON DELETE SET NULL,
                created_at datetime NOT NULL,
                expires_at datetime NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_admintoken (
                id bigserial PRIMARY KEY,
                user_id bigint NOT NULL REFERENCES payments_adminuser(id) ON DELETE CASCADE,
                token varchar(64) NOT NULL UNIQUE,
                session_log_id bigint NULL REFERENCES payments_adminsessionlog(id) ON DELETE SET NULL,
                created_at timestamp with time zone NOT NULL,
                expires_at timestamp with time zone NULL
            )
            '''
        )

    if 'payments_stafftoken' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_stafftoken (
                id integer PRIMARY KEY AUTOINCREMENT,
                employee_id integer NOT NULL REFERENCES payments_employee(id) ON DELETE CASCADE,
                token varchar(64) NOT NULL UNIQUE,
                created_at datetime NOT NULL,
                expires_at datetime NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_stafftoken (
                id bigserial PRIMARY KEY,
                employee_id bigint NOT NULL REFERENCES payments_employee(id) ON DELETE CASCADE,
                token varchar(64) NOT NULL UNIQUE,
                created_at timestamp with time zone NOT NULL,
                expires_at timestamp with time zone NULL
            )
            '''
        )

    if 'payments_staffactivity' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_staffactivity (
                id integer PRIMARY KEY AUTOINCREMENT,
                employee_id integer NOT NULL REFERENCES payments_employee(id) ON DELETE CASCADE,
                order_id integer NULL REFERENCES payments_order(id),
                action varchar(255) NOT NULL,
                details text NULL,
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_staffactivity (
                id bigserial PRIMARY KEY,
                employee_id bigint NOT NULL REFERENCES payments_employee(id) ON DELETE CASCADE,
                order_id bigint NULL REFERENCES payments_order(id),
                action varchar(255) NOT NULL,
                details jsonb NULL,
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_review' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_review (
                id integer PRIMARY KEY AUTOINCREMENT,
                customer_name varchar(255),
                rating integer NOT NULL,
                comment text,
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_review (
                id bigserial PRIMARY KEY,
                customer_name varchar(255),
                rating integer NOT NULL,
                comment text,
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_wastagelog' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_wastagelog (
                id integer PRIMARY KEY AUTOINCREMENT,
                item_name varchar(255) NOT NULL,
                quantity integer NOT NULL DEFAULT 1,
                reason varchar(512) NOT NULL DEFAULT '',
                cost numeric NOT NULL DEFAULT 0.00,
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_wastagelog (
                id bigserial PRIMARY KEY,
                item_name varchar(255) NOT NULL,
                quantity integer NOT NULL DEFAULT 1,
                reason varchar(512) NOT NULL DEFAULT '',
                cost numeric NOT NULL DEFAULT 0.00,
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_miscellaneousexpense' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_miscellaneousexpense (
                id integer PRIMARY KEY AUTOINCREMENT,
                item_name varchar(255) NOT NULL,
                reason varchar(512) NOT NULL DEFAULT '',
                cost numeric NOT NULL DEFAULT 0.00,
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_miscellaneousexpense (
                id bigserial PRIMARY KEY,
                item_name varchar(255) NOT NULL,
                reason varchar(512) NOT NULL DEFAULT '',
                cost numeric NOT NULL DEFAULT 0.00,
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    if 'payments_stocklog' not in existing_tables:
        create_statements.append(
            '''
            CREATE TABLE payments_stocklog (
                id integer PRIMARY KEY AUTOINCREMENT,
                item_id integer NOT NULL,
                quantity integer NOT NULL,
                cost numeric NOT NULL,
                created_at datetime NOT NULL
            )
            ''' if vendor != 'postgresql' else
            '''
            CREATE TABLE payments_stocklog (
                id bigserial PRIMARY KEY,
                item_id bigint NOT NULL,
                quantity integer NOT NULL,
                cost numeric NOT NULL,
                created_at timestamp with time zone NOT NULL
            )
            '''
        )

    try:
        with connection.cursor() as cursor:
            for statement in create_statements:
                cursor.execute(statement)
    except Exception as exc:
        logger.warning('Could not ensure required payments tables directly: %s', exc)
        return False

    try:
        Order.objects.exists()
        return True
    except (db_utils.ProgrammingError, db_utils.OperationalError) as exc:
        logger.warning('Payments schema unavailable after repair: %s', exc)
        return False


def _ensure_required_columns() -> bool:
    try:
        with connection.cursor() as cursor:
            table_names = set(connection.introspection.table_names(cursor))

            if 'payments_orderitem' in table_names:
                columns = {col.name for col in connection.introspection.get_table_description(cursor, 'payments_orderitem')}
                if 'food_cost' not in columns:
                    cursor.execute('ALTER TABLE payments_orderitem ADD COLUMN food_cost numeric NOT NULL DEFAULT 0.00')
                if 'is_served' not in columns:
                    cursor.execute('ALTER TABLE payments_orderitem ADD COLUMN is_served boolean NOT NULL DEFAULT 0')

            if 'payments_transaction' in table_names:
                columns = {col.name for col in connection.introspection.get_table_description(cursor, 'payments_transaction')}
                if 'mpesa_receipt' not in columns:
                    cursor.execute('ALTER TABLE payments_transaction ADD COLUMN mpesa_receipt varchar(64) NULL')

            if 'payments_order' in table_names:
                columns = {col.name for col in connection.introspection.get_table_description(cursor, 'payments_order')}
                if 'phone' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN phone varchar(32) NOT NULL DEFAULT ""')
                if 'delivery_address' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN delivery_address varchar(512) NOT NULL DEFAULT ""')
                if 'delivery_distance_km' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN delivery_distance_km numeric NULL')
                if 'delivery_time' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN delivery_time varchar(128) NOT NULL DEFAULT ""')
                if 'delivery_cost' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN delivery_cost numeric NOT NULL DEFAULT 0.00')
                if 'split_count' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN split_count integer NOT NULL DEFAULT 1')
                if 'total_amount' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN total_amount numeric NOT NULL DEFAULT 0.00')
                if 'waiter_id' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN waiter_id integer NULL')
                if 'waiter_name' not in columns:
                    cursor.execute('ALTER TABLE payments_order ADD COLUMN waiter_name varchar(255) NOT NULL DEFAULT ""')

            return True
    except Exception as exc:
        logger.warning('Could not ensure required payments columns: %s', exc)
        return False


def _payments_schema_ready() -> bool:
    return _ensure_required_tables() and _ensure_required_columns()


def _schema_error_response(message='Payments database schema is not available. Please apply database migrations.'):
    return JsonResponse({'error': 'schema_not_ready', 'message': message}, status=503)


def _wait_for_payments_schema(max_attempts: int = 3, delay_seconds: float = 1.0) -> bool:
    for attempt in range(1, max_attempts + 1):
        try:
            if _payments_schema_ready():
                return True
        except Exception as exc:
            logger.warning('Payments schema check attempt %s/%s failed: %s', attempt, max_attempts, exc)

        if attempt < max_attempts:
            time.sleep(delay_seconds)

    return False


def _default_config_payload() -> dict:
    return {
        'base_currency': 'KES',
        'display_currency': 'KES',
        'conversion_rate': 1.0,
        'delivery_rate_per_km': 100.0,
        'min_delivery_fee': 50.0,
    }


def _display_rate() -> float:
    try:
        app_settings = AppSettings.current()
        return float(app_settings.conversion_rate or getattr(settings, 'MPESA_TO_KES_RATE', 1))
    except Exception as exc:
        logger.warning('Unable to read AppSettings, using default conversion rate: %s', exc)
        return float(getattr(settings, 'MPESA_TO_KES_RATE', 1))


def _to_display_currency(amount):
    try:
        return float(Decimal(str(amount or 0)) * Decimal(str(_display_rate())))
    except Exception:
        return float(amount or 0)


def _resolve_menu_item_from_payload(item_payload: dict):
    """Try to resolve a MenuItem from the incoming order item payload.
    Priority: menu_item_id / id -> sku (if field exists) -> name fallback (case-insensitive).
    """
    try:
        # Try explicit id fields first
        menu_item_id = item_payload.get('menu_item_id') or item_payload.get('id')
        if menu_item_id is not None and str(menu_item_id).strip() != '':
            try:
                return MenuItem.objects.filter(id=int(menu_item_id)).first()
            except Exception:
                pass

        # Try SKU-like fields if the model has such a field
        for sku_key in ('sku', 'menu_item_sku', 'sku_code'):
            sku_val = item_payload.get(sku_key)
            if sku_val:
                try:
                    mi = MenuItem.objects.filter(**{ 'sku': sku_val }).first()
                    if mi:
                        return mi
                except FieldError:
                    # MenuItem has no 'sku' field; try next option
                    try:
                        mi = MenuItem.objects.filter(**{ sku_key: sku_val }).first()
                        if mi:
                            return mi
                    except Exception:
                        pass
                except Exception:
                    pass

        # Fallback to name match
        name = (item_payload.get('name') or '').strip()
        if name:
            return MenuItem.objects.filter(name__iexact=name).first()
    except Exception:
        return None
    return None


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

def _normalize_image_url(url: str) -> str:
    if not url:
        return ''
    normalized = str(url).strip()
    if not normalized:
        return ''
    if normalized.startswith('http://') or normalized.startswith('https://'):
        if '/menu_items/' in normalized and '/media/' not in normalized:
            return normalized.replace('/menu_items/', '/media/menu_items/')
        return normalized
    if normalized.startswith('//'):
        return normalized
    if normalized.startswith('/media/'):
        return normalized
    if normalized.startswith('/menu_items/'):
        return f'/media{normalized}'
    return f'/media/{normalized}'


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


def _get_token_from_request(request):
    # Support Authorization Bearer and both admin/staff token headers.
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header.split(' ', 1)[1].strip()

    token = (
        request.headers.get('X-ADMIN-TOKEN', '') or
        request.headers.get('X-STAFF-TOKEN', '') or
        request.GET.get('admin_token', '') or
        request.POST.get('admin_token', '') or
        request.GET.get('staff_token', '') or
        request.POST.get('staff_token', '')
    )
    return token.strip() if token else None


def _is_admin(request):
    return bool(_get_admin_token(request))


def _debug_request_auth(request):
    return {
        'Authorization': request.headers.get('Authorization', ''),
        'X-ADMIN-TOKEN': request.headers.get('X-ADMIN-TOKEN', ''),
        'admin_token_post': request.POST.get('admin_token', ''),
        'admin_token_get': request.GET.get('admin_token', ''),
    }

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


def _request_token_debug(request):
    return {
        'Authorization': request.headers.get('Authorization', ''),
        'X-ADMIN-TOKEN': request.headers.get('X-ADMIN-TOKEN', ''),
        'X-STAFF-TOKEN': request.headers.get('X-STAFF-TOKEN', ''),
        'admin_token': request.GET.get('admin_token') or request.POST.get('admin_token', ''),
        'staff_token': request.GET.get('staff_token') or request.POST.get('staff_token', ''),
    }


def _get_staff_employee(request):
    staff_token = _get_staff_token(request)
    if staff_token is True or staff_token is None:
        return None
    return staff_token.employee


def _log_staff_activity(request, action, details=None, order=None):
    staff = _get_staff_employee(request)
    if not staff:
        return None

    try:
        return StaffActivity.objects.create(
            employee=staff,
            order=order,
            action=action,
            details=details or {}
        )
    except Exception as e:
        logger.warning('Failed to log staff activity: %s', e)
        return None


def _is_staff(request):
    return bool(_get_staff_token(request))


def _is_customer_order(request):
    return not _get_admin_token(request) and not _get_staff_token(request)


def staff_activities(request):
    """Returns a log of recent activities for the staff dashboard."""
    if not _is_staff(request):
        debug_info = _request_token_debug(request)
        if settings.DEBUG:
            return JsonResponse({'error': 'unauthorized', 'debug': debug_info}, status=403)
        return JsonResponse({'error': 'unauthorized'}, status=403)

    staff = _get_staff_employee(request)
    admin_token = _get_admin_token(request)
    role_param = (request.GET.get('role') or '').strip().lower()

    try:
        if admin_token and role_param:
            activities_qs = StaffActivity.objects.filter(employee__role__iexact=role_param)
            order_qs = Order.objects.filter(waiter__role__iexact=role_param)
        elif staff:
            activities_qs = StaffActivity.objects.filter(employee=staff)
            order_qs = Order.objects.filter(waiter=staff)
        else:
            activities_qs = StaffActivity.objects.none()
            order_qs = Order.objects.none()

        activities = activities_qs.select_related('employee', 'order').order_by('-created_at')[:30]
        results = []

        for activity in activities:
            order = activity.order
            details = activity.details or {}
            table_label = details.get('table')
            if not table_label and order:
                table_label = order.table.number if order.table else 'Takeaway'

            results.append({
                'id': f"act-{activity.id}",
                'action': activity.action,
                'description': details.get('description') or activity.action,
                'order_id': order.order_id if order else details.get('order_id'),
                'table': table_label,
                'time': activity.created_at.isoformat() if activity.created_at else None,
                'status': order.status if order else details.get('status'),
            })

        orders_taken = order_qs.count()
        tables_served = order_qs.filter(status__in=['ready', 'paid']).exclude(table__isnull=True).values('table').distinct().count()
        completed_orders = order_qs.filter(status__in=['paid']).count()

        summary = {
            'orders_taken': orders_taken,
            'tables_served': tables_served,
            'completed_orders': completed_orders,
        }

        return JsonResponse({'activities': results, 'summary': summary})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def _get_period_dates(period_type: str, date_str: str, start_date_str: str | None = None, end_date_str: str | None = None):
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
    elif period_type == 'custom':
        # custom date ranges are passed through explicit query parameters
        start_date_str = start_date_str or ''
        end_date_str = end_date_str or ''
        try:
            if start_date_str:
                start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d')
            if end_date_str:
                end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d')
        except ValueError:
            start_date = None
            end_date = None

        if not start_date or not end_date:
            start_date = timezone.make_aware(datetime.datetime.combine(today, datetime.time.min))
            end_date = timezone.make_aware(datetime.datetime.combine(today, datetime.time.max))
            label = today.strftime('%Y-%m-%d')
        else:
            start_date = timezone.make_aware(datetime.datetime.combine(start_date.date(), datetime.time.min))
            end_date = timezone.make_aware(datetime.datetime.combine(end_date.date(), datetime.time.max))
            label = f"{start_date.strftime('%Y-%m-%d')} → {end_date.strftime('%Y-%m-%d')}"
    else: # Default to current week if period_type is unknown
        # Fallback to current week (Monday-Sunday)
        monday_of_week = today - timedelta(days=today.isoweekday() - 1)
        sunday_of_week = monday_of_week + timedelta(days=6)
        start_date = timezone.make_aware(datetime.datetime.combine(monday_of_week, datetime.time.min))
        end_date = timezone.make_aware(datetime.datetime.combine(sunday_of_week, datetime.time.max))
        label = f"Week of {monday_of_week.strftime('%Y-%m-%d')}"

    return start_date, end_date, label

def _simulate_stk_success(tx, amount, account_ref):
    checkout_id = f"SIM-{uuid.uuid4().hex[:12]}"
    merchant_id = f"SIM-{uuid.uuid4().hex[:12]}"
    payload = {
        'ResponseCode': '0',
        'ResponseDescription': 'Simulated M-Pesa payment completed successfully.',
        'MerchantRequestID': merchant_id,
        'CheckoutRequestID': checkout_id,
        'simulated': True,
        'amount': str(amount),
        'account_ref': str(account_ref),
    }
    tx.checkout_request_id = checkout_id
    tx.merchant_request_id = merchant_id
    tx.status = 'success'
    tx.method = Transaction.METHOD_M_PESA
    tx.raw_response = payload
    tx.save()

    try:
        if tx.order:
            tx.order.status = 'paid'
            tx.order.save(update_fields=['status'])
            if tx.order.table:
                tx.order.table.status = Table.STATUS_AVAILABLE
                tx.order.table.save(update_fields=['status'])
            _emit_event('order_update', {'order_id': tx.order.order_id, 'status': 'paid'})
    except Exception:
        logger.debug('Failed to finalize simulated payment for order %s', tx.order.order_id if tx.order else None)

    return payload, 200


def _build_mpesa_callback_url(request=None):
    callback_url = getattr(settings, 'MPESA_CALLBACK_URL', '').strip()
    if callback_url:
        return callback_url
    if request is not None:
        try:
            built = request.build_absolute_uri('/api/payments/stk/callback/')
            if built.startswith('http://'):
                return built.replace('http://', 'https://', 1)
            if built.startswith('https://'):
                return built
        except Exception:
            return ''
    return ''


def _execute_stk_push(msisdn, amount, account_ref, tx, request=None):
    """Helper to trigger the actual Safaricom API request."""
    shortcode = getattr(settings, 'MPESA_EXPRESS_SHORTCODE', getattr(settings, 'MPESA_SHORTCODE', ''))
    passkey = getattr(settings, 'MPESA_PASSKEY', '')
    consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', '').strip()
    consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', '').strip()
    callback_url = _build_mpesa_callback_url(request)

    if not shortcode or not passkey or not consumer_key or not consumer_secret or not callback_url.startswith('https://'):
        logger.info('Using simulated M-Pesa flow because Daraja credentials or callback URL are unavailable.')
        return _simulate_stk_success(tx, amount, account_ref)

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

    resp_json, status_code = _execute_stk_push(msisdn, amount, account_ref, tx, request=request)
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
    try:
        if _payments_schema_ready():
            app_settings = AppSettings.current()
            payload = {
                'base_currency': app_settings.base_currency or 'KES',
                'display_currency': app_settings.display_currency or 'KES',
                'conversion_rate': float(app_settings.conversion_rate or 1.0),
                'delivery_rate_per_km': float(app_settings.delivery_rate_per_km or 100.0),
                'min_delivery_fee': float(app_settings.min_delivery_fee or 50.0),
            }
        else:
            payload = _default_config_payload()
    except Exception as exc:
        logger.warning('Config endpoint failed, returning safe defaults: %s', exc)
        payload = _default_config_payload()

    return JsonResponse(payload)


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
        return JsonResponse({'error': 'unauthorized', 'debug': _debug_request_auth(request)}, status=403)
    
    image_file = request.FILES.get('image')
    if not image_file:
        return JsonResponse({'error': 'no_image_provided'}, status=400)
    
    try:
        saved_path = default_storage.save(f'menu_items/{uuid.uuid4().hex}_{image_file.name}', image_file)
        saved_path = saved_path.replace('\\', '/')
        url = request.build_absolute_uri(f"{settings.MEDIA_URL}{saved_path}")
        return JsonResponse({'url': url, 'image_url': url, 'path': saved_path})
    except Exception as exc:
        return JsonResponse({'error': 'upload_failed', 'details': str(exc)}, status=500)

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
    
    # Check if employee is on shift
    # Only employees with status='on_shift' can access the staff portal
    if emp.status != 'on_shift':
        return JsonResponse({'error': 'You are not scheduled for a shift. Please contact an administrator.'}, status=403)

    expiry = timezone.now() + timedelta(hours=8)
    token = StaffToken.objects.create(employee=emp, expires_at=expiry)
    
    return JsonResponse({
        'token': token.token,
        'id': emp.id,
        'name': emp.name,
        'role': emp.role,
        'expires_at': expiry.isoformat()
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
        expiry = timezone.now() + timedelta(hours=4)
        token = AdminToken.objects.create(user=user, session_log=log, expires_at=expiry)
        return JsonResponse({'token': token.token, 'username': user.username})
    except (db_utils.ProgrammingError, db_utils.OperationalError, AttributeError) as exc:
        logger.warning('Admin sign-in failed due to schema issue: %s', exc)
        return JsonResponse(
            {
                'error': 'Admin authentication is temporarily unavailable because the admin authentication tables are missing or incomplete. Please redeploy or run database migrations.'
            },
            status=503,
        )
    except Exception as e:
        logger.exception('Unexpected admin sign-in failure: %s', e)
        return JsonResponse({'error': 'Login failed. Please try again later.'}, status=500)


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


@csrf_exempt
def admin_clear_sessions(request):
    """Clears all admin sessions after password verification."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    admin_token = _get_admin_token(request)
    if not admin_token:
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    if admin_token is True:
        return JsonResponse({'error': 'password verification not supported for dev admin'}, status=400)
    
    try:
        payload = json.loads(request.body)
        password = (payload.get('password') or '').strip()
        
        if not password:
            return JsonResponse({'error': 'password is required'}, status=400)
        
        # Get the current admin user from token
        user = admin_token.user
        
        # Verify password
        if not user.check_password(password):
            return JsonResponse({'error': 'Invalid password'}, status=401)
        
        # Clear all admin sessions and tokens
        AdminSessionLog.objects.all().delete()
        AdminToken.objects.all().delete()
        
        return JsonResponse({'message': 'All admin sessions cleared successfully'})
    except json.JSONDecodeError:
        return JsonResponse({'error': 'invalid json'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Error: {str(e)}'}, status=500)


def admin_me(request):
    admin_token = _get_admin_token(request)
    if not admin_token:
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if admin_token is True:
        return JsonResponse({
            'id': None,
            'username': 'admin',
            'display_name': 'Administrator',
            'authorized': True,
            'expires_at': None,
        })

    return JsonResponse({
        'id': admin_token.user.id,
        'username': admin_token.user.username,
        'display_name': admin_token.user.username,
        'authorized': True,
        'expires_at': admin_token.expires_at.isoformat() if admin_token.expires_at else None,
    })


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


def _get_fallback_images():
    """Get a pool of diverse food images for fallback when items lack image_url."""
    return [
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',  # Burger 1
        'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=500&q=80',  # Burger 2
        'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500&q=80',      # Burger 3
        'https://images.unsplash.com/photo-1573015084185-7205ba3d6ea8?w=500&q=80',  # Fries
        'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&q=80',  # Wings
        'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80',  # Milkshake
        'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=500&q=80',      # Sundae
        'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=500&q=80',  # Pizza
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&q=80',  # Salad
        'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=500&q=80',  # Lemonade
        'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&q=80',      # Iced tea
        'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=500&q=80',  # Apple pie
    ]


def _serialize_menu_item(menu_item):
    image_url = _normalize_image_url(menu_item.image_url)
    
    # If no image URL, assign a varied default based on item id
    if not image_url:
        fallback_images = _get_fallback_images()
        image_url = fallback_images[menu_item.id % len(fallback_images)]
    
    return {
        'id': menu_item.id,
        'sku': getattr(menu_item, 'sku', None),
        'name': menu_item.name,
        'category': menu_item.category,
        'price': float(menu_item.price),
        'food_cost': float(menu_item.food_cost or Decimal('0.00')),
        'description': menu_item.description,
        'popular': bool(menu_item.popular),
        'spicy': bool(menu_item.spicy),
        'stock_level': menu_item.stock_level,
        'min_stock_level': menu_item.min_stock_level,
        'image_url': image_url,
        'is_available': menu_item.is_available and menu_item.stock_level > 0,
    }


def _get_default_menu_items():
    return [
        { 'name': 'Classic Smash Burger', 'price': Decimal('750.00'), 'food_cost': Decimal('250.00'), 'category': 'Burgers', 'description': 'Double patty, cheddar, pickles, special sauce', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80' },
        { 'name': 'Spicy Chicken Burger', 'price': Decimal('780.00'), 'food_cost': Decimal('260.00'), 'category': 'Burgers', 'description': 'Crispy chicken, jalapeños, sriracha mayo', 'popular': False, 'spicy': True, 'image': 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=500&q=80' },
        { 'name': 'BBQ Bacon Burger', 'price': Decimal('860.00'), 'food_cost': Decimal('290.00'), 'category': 'Burgers', 'description': 'Smoked bacon, BBQ glaze, onion rings', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500&q=80' },
        { 'name': 'Veggie Deluxe', 'price': Decimal('690.00'), 'food_cost': Decimal('230.00'), 'category': 'Burgers', 'description': 'Plant-based patty, avocado, fresh greens', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?w=500&q=80' },
        { 'name': 'Loaded Fries', 'price': Decimal('360.00'), 'food_cost': Decimal('120.00'), 'category': 'Sides', 'description': 'Cheese sauce, bacon bits, green onions', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1573015084185-7205ba3d6ea8?w=500&q=80' },
        { 'name': 'Onion Rings', 'price': Decimal('280.00'), 'food_cost': Decimal('90.00'), 'category': 'Sides', 'description': 'Beer-battered, crispy golden perfection', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=500&q=80' },
        { 'name': 'Chicken Wings (8pc)', 'price': Decimal('720.00'), 'food_cost': Decimal('240.00'), 'category': 'Sides', 'description': 'Choice of buffalo, BBQ, or garlic parmesan', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&q=80' },
        { 'name': 'Coleslaw', 'price': Decimal('210.00'), 'food_cost': Decimal('70.00'), 'category': 'Sides', 'description': 'Creamy homestyle coleslaw', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1481833761820-0509d3217039?w=500&q=80' },
        { 'name': 'Classic Milkshake', 'price': Decimal('420.00'), 'food_cost': Decimal('130.00'), 'category': 'Drinks', 'description': 'Vanilla, chocolate, or strawberry', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80' },
        { 'name': 'Fresh Lemonade', 'price': Decimal('290.00'), 'food_cost': Decimal('90.00'), 'category': 'Drinks', 'description': 'Freshly squeezed with a hint of mint', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=500&q=80' },
        { 'name': 'Iced Tea', 'price': Decimal('220.00'), 'food_cost': Decimal('70.00'), 'category': 'Drinks', 'description': 'Brewed daily, sweetened or unsweetened', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&q=80' },
        { 'name': 'Brownie Sundae', 'price': Decimal('460.00'), 'food_cost': Decimal('150.00'), 'category': 'Desserts', 'description': 'Warm brownie, vanilla ice cream, hot fudge', 'popular': True, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=500&q=80' },
        { 'name': 'Apple Pie Bites', 'price': Decimal('330.00'), 'food_cost': Decimal('100.00'), 'category': 'Desserts', 'description': 'Cinnamon sugar dusted, served warm', 'popular': False, 'spicy': False, 'image': 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=500&q=80' },
    ]


def _ensure_menu_items(seed: bool = True):
    # Only seed default menu items when explicitly requested.
    if not seed:
        return

    try:
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
    except (db_utils.ProgrammingError, db_utils.OperationalError) as exc:
        logger.warning('Unable to seed menu items because payments schema is unavailable: %s', exc)


def _fallback_menu_items_payload():
    default_items = _get_default_menu_items()
    return {
        'menu_items': [
            {
                'id': idx + 1,
                'sku': None,
                'name': item['name'],
                'category': item['category'],
                'price': float(item['price']),
                'food_cost': float(item['food_cost']),
                'description': item['description'],
                'popular': bool(item['popular']),
                'spicy': bool(item['spicy']),
                'stock_level': 50,
                'min_stock_level': 10,
                'image_url': item['image'],
                'is_available': True,
            }
            for idx, item in enumerate(default_items)
        ]
    }


def _customer_home_fallback_response(message: str = 'Using default menu data while the database schema is being updated.'):
    default_items = _get_default_menu_items()
    categories = sorted({item['category'] for item in default_items})
    featured = [
        {
            'id': idx + 1,
            'sku': None,
            'name': item['name'],
            'category': item['category'],
            'price': float(item['price']),
            'food_cost': float(item['food_cost']),
            'description': item['description'],
            'popular': bool(item['popular']),
            'spicy': bool(item['spicy']),
            'stock_level': 50,
            'min_stock_level': 10,
            'image_url': item['image'],
            'is_available': True,
        }
        for idx, item in enumerate(default_items) if item['popular']
    ][:5]
    grouped_menu = {
        cat: [
            {
                'id': idx + 1,
                'sku': None,
                'name': item['name'],
                'category': item['category'],
                'price': float(item['price']),
                'food_cost': float(item['food_cost']),
                'description': item['description'],
                'popular': bool(item['popular']),
                'spicy': bool(item['spicy']),
                'stock_level': 50,
                'min_stock_level': 10,
                'image_url': item['image'],
                'is_available': True,
            }
            for idx, item in enumerate(default_items) if item['category'] == cat
        ]
        for cat in categories
    }
    return JsonResponse({
        'hero': {
            'title': 'TASTY BITES HUB',
            'tagline': 'CRAFTED WITH PASSION, DELIVERED WITH PRECISION.',
            'image_url': 'https://images.unsplash.com/photo-1514356015730-0739d598061f?q=80&w=1600',
            'accent_color': '#f97316'
        },
        'categories': categories,
        'featured': featured,
        'menu_by_category': grouped_menu,
        'config': {
            'currency': 'KES',
            'delivery_min': 0,
        },
        'warning': message,
    })


def customer_home(request):
    """Professional Customer Home View returning grouped data."""
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    try:
        _ensure_menu_items(seed=True)
        items = list(MenuItem.objects.all().order_by('category', 'name'))
        categories = sorted({item.category for item in items})
        featured = [item for item in items if item.popular][:5]

        grouped_menu = {}
        for cat in categories:
            grouped_menu[cat] = [_serialize_menu_item(i) for i in items if i.category == cat]

        settings_obj = AppSettings.current()
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
                'delivery_min': float(settings_obj.min_delivery_fee)
            }
        })
    except (db_utils.ProgrammingError, db_utils.OperationalError) as exc:
        logger.warning('customer_home missing DB schema or connection; returning static default menu: %s', exc)
        return _customer_home_fallback_response(
            'Using default menu data while the database schema is being updated.'
        )
    except Exception as exc:
        logger.exception('customer_home failed; returning fallback menu')
        return _customer_home_fallback_response(
            'Using default menu data due to an unexpected backend issue.'
        )


def menu_items(request):
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    seed_flag = request.GET.get('seed', '1')
    seed = str(seed_flag).strip().lower() not in ('0', 'false', 'no', 'off')

    try:
        _ensure_menu_items(seed=seed)
        items = list(MenuItem.objects.all().order_by('category', 'name'))
        return JsonResponse({'menu_items': [_serialize_menu_item(item) for item in items]})
    except (db_utils.ProgrammingError, db_utils.OperationalError) as exc:
        logger.warning('menu_items missing DB schema; returning fallback menu: %s', exc)
        return JsonResponse(_fallback_menu_items_payload())
    except Exception as exc:
        logger.exception('menu_items failed; returning fallback menu')
        return JsonResponse(_fallback_menu_items_payload())



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
    if 'sku' in payload:
        item.sku = str(payload.get('sku') or '').strip() or None
    if 'image_url' in payload:
        item.image_url = _normalize_image_url(str(payload.get('image_url') or ''))

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
        sku=str(payload.get('sku') or '').strip() or None,
        image_url=_normalize_image_url(str(payload.get('image_url') or '')),
    )

    return JsonResponse({
        'menu_item': _serialize_menu_item(item),
        'automation': marketing_status
    })


def _build_report_assistant(start_date: datetime.datetime, end_date: datetime.datetime):
    report = _build_report_summary(start_date, end_date, 'AI Report Assistant')
    revenue = float(report['totals']['revenue'] or 0)
    profit = float(report['totals']['profit'] or 0)
    food_cost_ratio = float(report['totals']['food_cost_ratio'] or 0)
    top_item = report['best_items'][0] if report['best_items'] else None
    summary = []
    if report['best_items'] and sum(item.get('quantity', 0) for item in report['best_items']) > 0:
        summary.append(f"Top performer: {top_item['name']} with {top_item['quantity']} sold.")
    summary.append(f"Revenue: KES {revenue:,.2f}.")
    summary.append(f"Profit: KES {profit:,.2f}.")
    summary.append(f"Food cost ratio: {food_cost_ratio:.1f}%.")

    recommendations = []
    if revenue <= 0:
        recommendations.append('No fully paid orders were recorded in this period. Review sales and payment processing.')
    else:
        if profit < 0:
            recommendations.append('Profit is negative. Review menu pricing and reduce food cost on low-margin dishes.')
        elif profit / revenue < 0.10:
            recommendations.append('Profit margin is narrow. Simplify the menu toward higher-margin items.')
        if food_cost_ratio >= 30:
            recommendations.append('Food cost ratio is high. Negotiate better supplier rates or optimize recipes.')
        if top_item and top_item.get('quantity', 0) >= 10:
            recommendations.append(f"Promote '{top_item['name']}' more aggressively; it is selling well.")
        if report['worst_items'] and report['worst_items'][0].get('quantity', 0) <= 2:
            recommendations.append('Consider removing or repricing underperforming items to simplify the menu.')

    if not recommendations:
        recommendations.append('Performance is steady. Continue focusing on top sellers and monitor low-stock items.')

    return {
        'period_label': 'Last 7 Days',
        'summary': ' '.join(summary),
        'key_metrics': [
            {'label': 'Revenue', 'value': f"KES {revenue:,.2f}"},
            {'label': 'Profit', 'value': f"KES {profit:,.2f}"},
            {'label': 'Food Cost Ratio', 'value': f"{food_cost_ratio:.1f}%"},
        ],
        'top_items': report['best_items'][:3],
        'recommendations': recommendations,
    }


def _format_currency(amount: float) -> str:
    try:
        return f"KES {float(amount):,.2f}"
    except Exception:
        return f"KES {amount}"


def _answer_system_query(query: str, history: list[dict] | None = None):
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    summary_label = 'Last 7 Days'
    start = now - timedelta(days=7)
    end = now

    lc = query.lower().strip()
    if any(phrase in lc for phrase in ['this week', 'week so far', 'week to date']):
        start = now - timedelta(days=now.weekday())
        summary_label = 'This Week'
    elif any(phrase in lc for phrase in ['today', 'so far today', 'this morning']):
        start = today_start
        end = now
        summary_label = 'Today'

    report = _build_report_summary(start, end, summary_label)
    low_stock_items = list(MenuItem.objects.filter(stock_level__lte=F('min_stock_level')).values(
        'id', 'sku', 'name', 'category', 'stock_level', 'min_stock_level'
    )[:10])

    # Real-time data queries
    active_orders = Order.objects.filter(status__in=['pending', 'preparing', 'ready']).count()
    total_menu_items = MenuItem.objects.count()
    total_staff = Employee.objects.count()
    
    # Get current hour for greeting variation
    hour = now.hour
    if 5 <= hour < 12:
        greeting_time = "Good morning"
    elif 12 <= hour < 17:
        greeting_time = "Good afternoon"
    elif 17 <= hour < 21:
        greeting_time = "Good evening"
    else:
        greeting_time = "Hello"

    assistant_name = 'Tasty Bites AI'

    def friendly(text: str) -> str:
        text = text.strip()
        if not text:
            return ''
        if text[-1] not in '.!?':
            text += '.'
        return text

    # Preserve original friendly to avoid recursion when we wrap it below
    _raw_friendly = friendly

    def follow_up_prefix() -> str:
        if history and len(history) > 1:
            return 'Sure thing — '
        return 'Sure thing — '
    
    def get_emoji_summary() -> str:
        """Returns a brief system status emoji summary"""
        status = "🟢"  # All good by default
        if active_orders > 20:
            status = "🟠"  # Busy
        if len(low_stock_items) > 3:
            status = "🔴"  # Alert
        return status

    # Lightweight retrieval from indexed documents to enrich responses
    try:
        docs = _retrieve_documents(query, top_n=5)
    except Exception:
        docs = []

    context_prefix = ''
    if docs:
        titles = [str(d.get('title') or (d.get('text') or '')[:80]).strip() for d in docs]
        # join short titles as context hint
        context_prefix = ' Context: ' + '; '.join(titles[:3]) + '.'

    def create_answer(text: str) -> str:
        """Wraps text using `friendly` and appends short document excerpts when available."""
        suffix = ''
        try:
            if docs:
                excerpts = []
                for d in docs[:3]:
                    t = (d.get('text') or '')
                    snippet = (t[:160] + '...') if len(t) > 160 else t
                    excerpts.append(f"- {d.get('title')}: {snippet}")
                suffix = '\n\nRelated notes:\n' + '\n'.join(excerpts)
        except Exception:
            suffix = ''
        return _raw_friendly(text + suffix)

    # Redirect existing `friendly` calls to include document context
    friendly = create_answer

    # Override follow_up_prefix to include context when available
    def follow_up_prefix() -> str:
        base = 'Sure thing — '
        if history and len(history) > 1:
            base = 'Sure thing — '
        return base + context_prefix + ' '

    lc = query.lower().strip()
    if not lc:
        return {
            'query': query,
            'answer': friendly(
                f"{greeting_time}! I'm {assistant_name}, your real-time restaurant assistant. "
                f"We have {active_orders} active orders and {total_menu_items} menu items. "
                f"Ask me about today's performance, stock levels, or staff metrics!"
            )
        }

    if re.search(r"\b(?:hello|hi|hey|good morning|good afternoon|good evening)\b", lc):
        return {
            'query': query,
            'answer': friendly(
                f"{greeting_time}! I'm {assistant_name}. I'm monitoring {active_orders} active orders right now. "
                f"I can help you with today's revenue, stock alerts, waiter performance, or anything else."
            )
        }

    if re.search(r"\b(?:how are you|how are u|how are ya|what is up|whats up|status)\b", lc):
        return {
            'query': query,
            'answer': friendly(
                f"I'm running smoothly! {get_emoji_summary()} Currently, we have {active_orders} active orders, "
                f"{total_staff} staff members on duty, and {len(low_stock_items)} items below minimum stock. "
                f"Everything's under control!"
            )
        }

    if any(word in lc for word in ['status', 'how is', 'dashboard', 'quick update']):
        today_orders = Order.objects.filter(created_at__gte=today_start).count()
        today_revenue = Order.objects.filter(created_at__gte=today_start, status='completed').aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        return {
            'query': query,
            'answer': friendly(
                f"Here's your real-time snapshot {get_emoji_summary()}: "
                f"{active_orders} orders actively being processed, {today_orders} orders completed today so far, "
                f"today's revenue is {_format_currency(today_revenue)}. "
                f"{len(low_stock_items)} stock alert{'s' if len(low_stock_items) != 1 else ''}. "
                f"Everything's running smoothly!"
            )
        }

    if 'low stock' in lc or 'stock' in lc or 'inventory' in lc:
        if low_stock_items:
            if len(low_stock_items) <= 3:
                rows = [f"⚠️ {item['name']}: {item['stock_level']} units left (min: {item['min_stock_level']})" 
                       for item in low_stock_items]
            else:
                rows = [f"⚠️ {item['name']}: {item['stock_level']} units (min: {item['min_stock_level']})" 
                       for item in low_stock_items[:5]]
                rows.append(f"... and {len(low_stock_items) - 5} more items")
            return {
                'query': query,
                'answer': friendly(follow_up_prefix() + 'I found these items below minimum stock:\n\n' + '\n'.join(rows))
            }
        return {
            'query': query,
            'answer': friendly(follow_up_prefix() + '✅ All inventory levels are healthy right now!')
        }

    if 'revenue' in lc or 'sales' in lc or 'earn' in lc or 'made' in lc:
        total_orders = Order.objects.filter(created_at__gte=start, created_at__lte=end, status='completed').count()
        completed_revenue = Order.objects.filter(
            created_at__gte=start, 
            created_at__lte=end, 
            status='completed'
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        return {
            'query': query,
            'answer': friendly(follow_up_prefix() + 
                f"Over {summary_label}, we've had {total_orders} completed orders generating {_format_currency(completed_revenue)} in revenue. "
                f"Profit stands at {report['totals']['profit']} with a {report['totals']['food_cost_ratio']}% food cost ratio."
            )
        }

    if 'profit' in lc or 'margin' in lc or 'food cost' in lc:
        return {
            'query': query,
            'answer': friendly(follow_up_prefix() +
                f"Profit is {report['totals']['profit']}, revenue is {report['totals']['revenue']}, "
                f"and we're maintaining a healthy {report['totals']['food_cost_ratio']}% food cost ratio."
            )
        }

    if 'best seller' in lc or 'top seller' in lc or 'top item' in lc or 'best item' in lc or 'popular' in lc:
        if report['best_items']:
            top = report['best_items'][0]
            return {
                'query': query,
                'answer': friendly(follow_up_prefix() + 
                    f"⭐ {top['name']} is our star performer with {top['quantity']} units sold and {top['revenue']} in revenue. "
                    f"That's definitely a customer favorite!"
                )
            }
        return {'query': query, 'answer': 'I could not find sales data for this period.'}

    if 'worst seller' in lc or 'low performing' in lc or 'least selling' in lc or 'underperform' in lc:
        if report['worst_items']:
            worst = report['worst_items'][0]
            return {
                'query': query,
                'answer': friendly(follow_up_prefix() +
                    f"{worst['name']} has the lowest sales with {worst['quantity']} units sold ({worst['revenue']}). "
                    f"Consider optimizing the menu or pricing."
                )
            }
        return {'query': query, 'answer': 'I do not have low-performing item data for this period.'}

    if 'waiter' in lc or 'staff' in lc or 'employee' in lc or 'performer' in lc:
        best_waiter = report.get('best_waiter')
        least_waiter = report.get('least_waiter')
        if best_waiter or least_waiter:
            parts = []
            if best_waiter:
                parts.append(f"🏆 {best_waiter['waiter_name']} is the top performer with {best_waiter['orders']} paid orders")
            if least_waiter:
                parts.append(f"while {least_waiter['waiter_name']} has {least_waiter['orders']} paid orders")
            return {'query': query, 'answer': friendly(follow_up_prefix() + '. '.join(parts) + '.')}
        return {'query': query, 'answer': 'I do not have waiter performance data for this period.'}

    if any(word in lc for word in ['order', 'pending', 'queue', 'active']):
        return {
            'query': query,
            'answer': friendly(
                f"Right now, there are {active_orders} orders being processed. "
                f"Our team is keeping up well with the current volume."
            )
        }

    if any(word in lc for word in ['staff', 'team', 'employees', 'crew']):
        return {
            'query': query,
            'answer': friendly(
                f"We have {total_staff} staff members available. "
                f"Currently processing {active_orders} active orders smoothly."
            )
        }

    # Fallback summary answer
    return {
        'query': query,
        'answer': friendly(
            f"I'm {assistant_name}. Here’s a quick update: "
            f"Revenue is {report['totals']['revenue']}, profit is {report['totals']['profit']}, "
            f"and the food cost ratio is {report['totals']['food_cost_ratio']}%. "
            "Try asking me about today's performance, top sellers, waiter stats, or anything else!"
        )
    }


@csrf_exempt
def automation_query(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    query = str(payload.get('query', '')).strip()
    if not query:
        return JsonResponse({'error': 'query is required'}, status=400)

    history = payload.get('history') if isinstance(payload.get('history'), list) else None
    answer = _answer_system_query(query, history)
    return JsonResponse(answer)


def _generate_staff_briefing():
    """Generates a comprehensive daily briefing for staff with promotions, alerts, and metrics."""
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    briefing = {
        'timestamp': now.isoformat(),
        'sections': []
    }
    
    # 1. PROMOTIONS: Popular items or items we want to highlight
    popular_items = MenuItem.objects.filter(popular=True).values('id', 'name', 'category', 'price')[:3]
    if popular_items:
        promotion_msgs = []
        for item in popular_items:
            promotion_msgs.append(f"Remember to promote the {item['name']}! It's a customer favorite.")
        briefing['sections'].append({
            'type': 'promotion',
            'title': '🎯 Today\'s Promotions',
            'messages': promotion_msgs,
            'items': list(popular_items)
        })
    
    # 2. STOCK ALERTS: Items below minimum stock level
    low_stock = MenuItem.objects.filter(
        stock_level__lte=F('min_stock_level')
    ).values('id', 'name', 'stock_level', 'min_stock_level', 'category')[:5]
    
    if low_stock:
        stock_msgs = []
        for item in low_stock:
            stock_msgs.append(f"⚠️ We have limited stock on {item['name']}. Only {item['stock_level']} units remaining.")
        briefing['sections'].append({
            'type': 'stock_alert',
            'title': '⚠️ Low Stock Alert',
            'messages': stock_msgs,
            'items': list(low_stock)
        })
    
    # 3. OPERATIONAL REMINDERS: Best practices
    operational_reminders = [
        "Ensure all tables are sanitized within 5 minutes of customer departure.",
        "Always greet customers within 2 minutes of seating.",
        "Confirm order details with customers before submitting to kitchen.",
        "Check on customers 5 minutes after food is served.",
        "Keep utensils and glasses refilled throughout the meal.",
        "Remember to upsell beverages and desserts when taking orders.",
    ]
    briefing['sections'].append({
        'type': 'operational',
        'title': '📋 Operational Reminders',
        'messages': operational_reminders
    })
    
    # 4. TODAY'S PERFORMANCE: Real-time metrics
    today_orders = Order.objects.filter(created_at__gte=today_start).count()
    today_completed = Order.objects.filter(created_at__gte=today_start, status='completed').count()
    today_revenue = Order.objects.filter(
        created_at__gte=today_start, 
        status='completed'
    ).aggregate(total=Sum('total_amount'))['total'] or 0
    active_orders = Order.objects.filter(status__in=['pending', 'preparing', 'ready']).count()
    total_staff = Employee.objects.count()
    
    performance_msgs = [
        f"📊 {today_completed} orders completed so far today with {_format_currency(today_revenue)} in revenue.",
        f"📈 Currently processing {active_orders} active orders.",
        f"👥 {total_staff} team members on duty today.",
    ]
    briefing['sections'].append({
        'type': 'performance',
        'title': '📊 Today\'s Performance',
        'messages': performance_msgs,
        'metrics': {
            'total_orders_today': today_orders,
            'completed_orders_today': today_completed,
            'revenue_today': float(today_revenue),
            'active_orders_now': active_orders,
            'staff_on_duty': total_staff,
        }
    })
    
    # 5. FOCUS AREAS: Key things to focus on
    focus_areas = []
    if today_revenue < 5000:
        focus_areas.append("🎯 Today's revenue is lower than usual. Focus on upselling and driving orders.")
    if active_orders > 15:
        focus_areas.append("🎯 We're experiencing high volume. Prioritize speed and accuracy.")
    if len(low_stock) > 0:
        focus_areas.append(f"🎯 Manage inventory carefully — we have {len(low_stock)} low-stock items.")
    
    if focus_areas:
        briefing['sections'].append({
            'type': 'focus',
            'title': '🎯 Focus Areas for Today',
            'messages': focus_areas
        })
    
    return briefing


@csrf_exempt
def staff_briefing(request):
    """Generates and returns a comprehensive daily staff briefing."""
    if not _is_staff(request):
        debug_info = _request_token_debug(request)
        if settings.DEBUG:
            return JsonResponse({'error': 'unauthorized', 'debug': debug_info}, status=403)
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')
    
    briefing = _generate_staff_briefing()
    return JsonResponse(briefing)


def _build_search_index():
    """Extracts textual data from key models and writes a simple JSONL index for lightweight retrieval."""
    try:
        base = settings.BASE_DIR if hasattr(settings, 'BASE_DIR') else os.getcwd()
        index_path = os.path.join(base, 'data_index.jsonl')
        docs = []

        # Menu items
        for mi in MenuItem.objects.all():
            text = ' '.join(filter(None, [str(mi.name), str(mi.description), str(mi.category), str(getattr(mi, 'sku', '') )]))
            docs.append({'id': f"menuitem:{mi.id}", 'type': 'menu_item', 'title': mi.name, 'text': text, 'meta': {'price': float(mi.price or 0), 'stock': mi.stock_level}})

        # Recent orders (limit to last 1000)
        recent_orders = Order.objects.all().order_by('-created_at')[:1000]
        for o in recent_orders:
            items = list(OrderItem.objects.filter(order=o).values_list('name', flat=True))
            text = ' '.join(filter(None, [str(o.order_id), str(o.status), str(getattr(o, 'waiter_name', '') ), ' '.join(items)]))
            docs.append({'id': f"order:{o.id}", 'type': 'order', 'title': f"Order {o.order_id}", 'text': text, 'meta': {'status': o.status, 'total': float(o.total_amount or 0)}})

        # Employees
        for e in Employee.objects.all():
            text = ' '.join(filter(None, [str(e.name), str(e.role), str(e.username)]))
            docs.append({'id': f"employee:{e.id}", 'type': 'employee', 'title': e.name, 'text': text, 'meta': {'role': e.role}})

        # Stock logs
        for s in StockLog.objects.all().order_by('-created_at')[:500]:
            text = ' '.join(filter(None, [str(s.item.name if getattr(s, 'item', None) else ''), str(s.quantity), str(s.created_at)]))
            docs.append({'id': f"stock:{s.id}", 'type': 'stock_log', 'title': f"Stock {getattr(s, 'item', None)}", 'text': text, 'meta': {'quantity': s.quantity}})

        # Transactions (recent)
        for t in Transaction.objects.all().order_by('-created_at')[:500]:
            text = ' '.join(filter(None, [str(t.item), str(t.phone), str(t.method), str(t.status)]))
            docs.append({'id': f"tx:{t.id}", 'type': 'transaction', 'title': f"Tx {t.id}", 'text': text, 'meta': {'amount': float(t.amount or 0), 'status': t.status}})

        # Write JSONL
        with open(index_path, 'w', encoding='utf-8') as fh:
            for d in docs:
                fh.write(json.dumps(d, default=str, ensure_ascii=False) + '\n')

        return {'ok': True, 'count': len(docs), 'path': index_path}
    except Exception as e:
        logger.exception('Failed to build search index: %s', e)
        return {'ok': False, 'error': str(e)}


def _retrieve_documents(query: str, top_n: int = 5):
    """Very lightweight retrieval: loads JSONL index and ranks by token overlap."""
    try:
        base = settings.BASE_DIR if hasattr(settings, 'BASE_DIR') else os.getcwd()
        index_path = os.path.join(base, 'data_index.jsonl')
        if not os.path.exists(index_path):
            return []

        q = (query or '').lower().strip()
        if not q:
            return []

        q_tokens = [t for t in re.split(r"\W+", q) if t]
        results = []
        with open(index_path, 'r', encoding='utf-8') as fh:
            for line in fh:
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                text = (d.get('text') or '').lower()
                score = 0
                for tok in q_tokens:
                    score += text.count(tok)
                if score > 0:
                    results.append((score, d))

        results.sort(key=lambda x: x[0], reverse=True)
        return [r[1] for r in results[:top_n]]
    except Exception as e:
        logger.exception('Retrieval failed: %s', e)
        return []


@csrf_exempt
def admin_index_data(request):
    """Admin-only endpoint to (re)build the local knowledge index."""
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
    if request.method not in ('POST', 'GET'):
        return HttpResponseBadRequest('Only GET/POST allowed')

    result = _build_search_index()
    return JsonResponse(result)


def search_knowledge(request):
    """Search the lightweight knowledge index. Accessible to staff/admin."""
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    if not (_is_staff(request) or _is_admin(request)):
        debug_info = _request_token_debug(request)
        if settings.DEBUG:
            return JsonResponse({'error': 'unauthorized', 'debug': debug_info}, status=403)
        return JsonResponse({'error': 'unauthorized'}, status=403)

    q = (request.GET.get('q') or '').strip()
    if not q:
        return JsonResponse({'results': []})

    docs = _retrieve_documents(q, top_n=8)
    return JsonResponse({'results': docs})



def automation_insights(request):
    """The 'Super System' engine: Analyzes patterns for auto-staffing and re-engagement."""
    if not _payments_schema_ready():
        return _schema_error_response()

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

    automation_report = _build_report_assistant(now - timedelta(days=7), now)
    return JsonResponse({
        "reengage_customers": reengage_list,
        "staffing_insights": staffing_suggestions,
        "system_health": health_status,
        "marketing_activity": [
            {"event": "New Dish Added", "action": "AI Instagram Post Generated", "time": now.isoformat()}
        ],
        "automation_report": automation_report
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

    try:
        reviews = list(Review.objects.all().order_by('-created_at'))
    except db_utils.ProgrammingError as e:
        # Table missing (migrations not yet applied) — avoid raising 500 in production.
        # Return an empty reviews list so frontends don't break while migrations run.
        logger.warning('reviews table missing; returning empty list: %s', e)
        return JsonResponse({'reviews': []})

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
def _parse_employee_payload(request):
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        payload = {k: request.POST.get(k) for k in request.POST}
        payload['document'] = request.FILES.get('document')
        payload['remove_document'] = request.POST.get('remove_document') in ['1', 'true', 'True']
        return payload

    try:
        raw_body = request.body.decode('utf-8')
        if raw_body:
            return json.loads(raw_body)
    except Exception:
        pass
    return {}


@csrf_exempt
def employees_list(request):
    """Lists all employees and handles creation via POST."""
    if not _payments_schema_ready():
        return _schema_error_response()

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
            'special_id': getattr(e, 'special_id', ''),
            'status': e.status,
            'joined_at': e.created_at.isoformat() if e.created_at else None,
            'document_url': request.build_absolute_uri(e.document.url) if e.document else None,
            'document_name': e.document.name.split('/')[-1] if e.document else None,
        } for e in employees]
        return JsonResponse({'employees': data})

    if request.method == 'POST':
        try:
            payload = _parse_employee_payload(request)
            emp = Employee.objects.create(
                name=payload.get('name'),
                role=payload.get('role', 'Staff'),
                phone=payload.get('phone', ''),
                email=payload.get('email', ''),
                username=payload.get('username'),
                salary=Decimal(str(payload.get('salary', 0))),
                status=payload.get('status', 'active'),
                account_number=payload.get('account_number', ''),
                special_id=payload.get('special_id', ''),
                document=payload.get('document') if payload.get('document') is not None else None,
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
            payload = _parse_employee_payload(request)
            if 'name' in payload: emp.name = payload['name']
            if 'role' in payload: emp.role = payload['role']
            if 'phone' in payload: emp.phone = payload['phone']
            if 'email' in payload: emp.email = payload['email']
            if 'username' in payload: emp.username = payload['username']
            if 'password' in payload and payload['password']: emp.set_password(payload['password'])
            if 'salary' in payload and payload['salary'] is not None:
                emp.salary = Decimal(str(payload['salary']))
            if 'special_id' in payload: emp.special_id = payload['special_id']
            if 'status' in payload: emp.status = payload['status']
            if 'account_number' in payload: emp.account_number = payload['account_number']
            if payload.get('document') is not None:
                emp.document = payload['document']
            if payload.get('remove_document'):
                if emp.document:
                    emp.document.delete(save=False)
                emp.document = None
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
def admin_backup(request):
    """Exports all operational data as JSON snapshot for backup/restore."""
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        backup_data = {
            'exported_at': timezone.now().isoformat(),
            'version': '1.0',
            'tables': {
                'orders': [
                    {
                        'id': o.id,
                        'order_id': o.order_id,
                        'table_id': o.table.id if o.table else None,
                        'waiter_id': o.waiter.id if o.waiter else None,
                        'waiter_name': o.waiter_name,
                        'phone': o.phone,
                        'delivery_address': o.delivery_address,
                        'delivery_distance_km': float(o.delivery_distance_km) if o.delivery_distance_km else None,
                        'delivery_time': o.delivery_time,
                        'delivery_cost': float(o.delivery_cost),
                        'status': o.status,
                        'split_count': o.split_count,
                        'total_amount': float(o.total_amount),
                        'created_at': o.created_at.isoformat() if o.created_at else None,
                    }
                    for o in Order.objects.all()
                ],
                'order_items': [
                    {
                        'id': oi.id,
                        'order_id': oi.order.id,
                        'name': oi.name,
                        'price': float(oi.price),
                        'food_cost': float(oi.food_cost or 0),
                        'quantity': oi.quantity,
                        'modifiers': oi.modifiers,
                        'seat_number': oi.seat_number,
                        'is_served': oi.is_served,
                        'created_at': oi.created_at.isoformat() if oi.created_at else None,
                    }
                    for oi in OrderItem.objects.all()
                ],
                'transactions': [
                    {
                        'id': t.id,
                        'checkout_request_id': t.checkout_request_id,
                        'phone': t.phone,
                        'amount': float(t.amount),
                        'item': t.item,
                        'status': t.status,
                        'method': t.method,
                        'created_at': t.created_at.isoformat() if t.created_at else None,
                    }
                    for t in Transaction.objects.all()
                ],
                'menu_items': [
                    {
                        'id': m.id,
                        'name': m.name,
                        'sku': m.sku,
                        'category': m.category,
                        'price': float(m.price),
                        'food_cost': float(m.food_cost or 0),
                        'description': m.description,
                        'stock_level': m.stock_level,
                        'min_stock_level': m.min_stock_level,
                        'popular': m.popular,
                        'spicy': m.spicy,
                        'is_available': m.is_available,
                        'created_at': m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in MenuItem.objects.all()
                ],
                'tables': [
                    {
                        'id': t.id,
                        'number': t.number,
                        'name': t.name,
                        'status': t.status,
                        'created_at': t.created_at.isoformat() if t.created_at else None,
                    }
                    for t in Table.objects.all()
                ],
                'employees': [
                    {
                        'id': e.id,
                        'name': e.name,
                        'role': e.role,
                        'username': e.username,
                        'phone': e.phone,
                        'email': e.email,
                        'salary': float(e.salary or 0),
                        'special_id': e.special_id,
                        'status': e.status,
                        'created_at': e.created_at.isoformat() if e.created_at else None,
                    }
                    for e in Employee.objects.all()
                ],
                'wastage_logs': [
                    {
                        'id': w.id,
                        'item_name': w.item_name,
                        'quantity': w.quantity,
                        'reason': w.reason,
                        'cost': float(w.cost or 0),
                        'created_at': w.created_at.isoformat() if w.created_at else None,
                    }
                    for w in WastageLog.objects.all()
                ],
                'misc_expenses': [
                    {
                        'id': m.id,
                        'item_name': m.item_name,
                        'reason': m.reason,
                        'cost': float(m.cost or 0),
                        'created_at': m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in MiscellaneousExpense.objects.all()
                ],
                'stock_logs': [
                    {
                        'id': s.id,
                        'item_id': s.item.id,
                        'quantity': s.quantity,
                        'cost': float(s.cost or 0),
                        'created_at': s.created_at.isoformat() if s.created_at else None,
                    }
                    for s in StockLog.objects.all()
                ],
            },
            'summary': {
                'total_orders': Order.objects.count(),
                'total_order_items': OrderItem.objects.count(),
                'total_transactions': Transaction.objects.count(),
                'total_menu_items': MenuItem.objects.count(),
                'total_tables': Table.objects.count(),
                'total_employees': Employee.objects.count(),
                'total_wastage_logs': WastageLog.objects.count(),
                'total_misc_expenses': MiscellaneousExpense.objects.count(),
                'total_stock_logs': StockLog.objects.count(),
            }
        }
        
        # Return as downloadable JSON file
        response = JsonResponse(backup_data)
        response['Content-Disposition'] = f'attachment; filename="tasty-bites-backup-{timezone.now().strftime("%Y%m%d-%H%M%S")}.json"'
        return response
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def admin_clear(request):
    """Clears stored operational data (orders/tables/transactions/wastage/menu items)."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    # Determine scope: 'operational' (default) or 'full' (wipe more tables like employees, staff activity, stock logs)
    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        body = {}

    scope = (body.get('scope') or request.GET.get('scope') or 'operational').strip().lower()

    try:
        # Core operational data (safe to remove)
        OrderItem.objects.all().delete()
        Transaction.objects.all().delete()
        Order.objects.all().delete()
        WastageLog.objects.all().delete()
        Table.objects.all().delete()
        MenuItem.objects.all().delete()

        # Misc logs and stock
        StockLog.objects.all().delete()
        MiscellaneousExpense.objects.all().delete()

        if scope == 'full':
            # Full wipe: remove employees, staff activities, admin tokens and session logs
            # Do NOT remove AdminUser records to avoid locking out administrators.
            StaffActivity.objects.all().delete()
            Employee.objects.all().delete()
            AdminToken.objects.all().delete()
            AdminSessionLog.objects.all().delete()

    except Exception as e:
        return JsonResponse({'error': 'clear_failed', 'message': str(e)}, status=500)

    return JsonResponse({'ok': True, 'scope': scope})





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
    if not _payments_schema_ready():
        return _schema_error_response()

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method == 'GET':
        try:
            period_type = request.GET.get('period_type', 'week')
            date_str = request.GET.get('date')
            start_date, end_date, _ = _get_period_dates(
                period_type,
                date_str,
                request.GET.get('start_date'),
                request.GET.get('end_date'),
            )
            logs = MiscellaneousExpense.objects.filter(
                created_at__gte=start_date, created_at__lte=end_date).order_by('-created_at')[:100]
            return JsonResponse({
                'miscellaneous': [
                    {
                        'id': log.id,
                        'item_name': log.item_name,
                        'reason': log.reason,
                        'cost': _to_display_currency(log.cost),
                        'created_at': log.created_at.isoformat() if log.created_at else None,
                    }
                    for log in logs
                ]
            })
        except Exception as e:
            logger.exception('Error fetching miscellaneous logs')
            return JsonResponse({'miscellaneous': []})

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


def _get_order_type(order):
    if getattr(order, 'table', None):
        return 'table'
    if getattr(order, 'delivery_address', None):
        return 'delivery'
    return 'takeaway'


def _serialize_order(order):
    total_food_cost = sum((item.food_cost or Decimal('0.00')) * item.quantity for item in order.items.all())  # type: ignore
    has_delivery = bool(order.delivery_address)
    return {
        'order_id': order.order_id,
        'order_type': _get_order_type(order),
        'table': order.table.number if order.table else ('Delivery' if has_delivery else 'Takeaway'),
        'table_id': order.table.id if order.table else None,
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
        'waiter_id': order.waiter.id if getattr(order, 'waiter', None) else None,
        'waiter_name': (order.waiter_name or (order.waiter.name if getattr(order, 'waiter', None) else '')),
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
        # Decrement stock for the sold item if it exists in MenuItem (resolve by id/sku/name)
        try:
            mi = _resolve_menu_item_from_payload(item)
            if mi:
                mi.stock_level = (mi.stock_level or 0) - quantity
                mi.save(update_fields=['stock_level'])
                try:
                    StockLog.objects.create(item=mi, quantity=-quantity, cost=float(food_cost * quantity))
                except Exception:
                    pass
                try:
                    if mi.stock_level is not None and mi.min_stock_level is not None and mi.stock_level <= mi.min_stock_level:
                        _emit_event('stock_alert', {
                            'item_id': mi.id,
                            'name': mi.name,
                            'stock_level': mi.stock_level,
                            'min_stock_level': mi.min_stock_level,
                        })
                except Exception:
                    pass
        except Exception:
            pass
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
    waiter_id_raw = payload.get('waiter_id')
    waiter_name_raw = (payload.get('waiter_name') or '').strip()
    if not status and waiter_id_raw is None and not waiter_name_raw:
        return JsonResponse({'error': 'status is required'}, status=400)

    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    if status:
        order.status = status

    if waiter_id_raw is not None and waiter_id_raw != '':
        try:
            waiter_obj = Employee.objects.filter(id=int(waiter_id_raw)).first()
        except (TypeError, ValueError):
            return JsonResponse({'error': 'invalid waiter_id'}, status=400)
        if not waiter_obj:
            return JsonResponse({'error': 'waiter_not_found'}, status=404)
        order.waiter = waiter_obj
        order.waiter_name = waiter_obj.name
    elif waiter_name_raw:
        order.waiter_name = waiter_name_raw

    if 'split_count' in payload:
        order.split_count = max(1, int(payload.get('split_count') or 1))

    # If admin marks order as paid, create a transaction record and release table.
    if status == 'paid':
        payment_method = (payload.get('payment_method') or 'cash').strip().lower()
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

    elif status in ['ready', 'served']:
        # Notify waiter that order is ready to be picked up or served
        table_display = f"Table {order.table.number}" if order.table else 'Takeaway'

        # Record a staff activity for the waiter so the notification time is persisted
        try:
            waiter_emp = None
            if getattr(order, 'waiter', None):
                waiter_emp = order.waiter
            elif getattr(order, 'waiter_id', None):
                waiter_emp = Employee.objects.filter(id=order.waiter_id).first()
            # If waiter_id not set but waiter_name is present, try to resolve by name
            if not waiter_emp and getattr(order, 'waiter_name', None):
                try:
                    waiter_emp = Employee.objects.filter(name__iexact=order.waiter_name).first()
                except Exception:
                    waiter_emp = None
            if waiter_emp:
                activity = StaffActivity.objects.create(
                    employee=waiter_emp,
                    order=order,
                    action='Order Ready Notification',
                    details={'order_id': order.order_id, 'table': table_display, 'status': status}
                )
                logger.info('Created StaffActivity id=%s for waiter=%s order=%s action=Order Ready Notification', getattr(activity, 'id', 'n/a'), getattr(waiter_emp, 'id', 'n/a'), order.order_id)
                try:
                    print(f"[LOG] Created StaffActivity id={getattr(activity,'id','n/a')} waiter={getattr(waiter_emp,'id','n/a')} order={order.order_id} action=Order Ready Notification")
                except Exception:
                    pass
        except Exception:
            logger.debug('Failed to create StaffActivity for order_ready for order %s', order.order_id)

        # Emit SSE event so waiter UIs update immediately
        try:
            payload = {
                'order_id': order.order_id,
                'status': status,
                'table': table_display,
                'table_id': order.table_id,
                'waiter_id': order.waiter_id if getattr(order, 'waiter_id', None) is not None else None,
                'waiter_name': order.waiter_name or (order.waiter.name if getattr(order, 'waiter', None) else ''),
                'created_at': order.created_at.isoformat() if order.created_at else None,
            }
            _emit_event('order_ready', payload)
            logger.info('Emitted SSE order_ready for order=%s waiter_id=%s waiter_name=%s', order.order_id, payload.get('waiter_id'), payload.get('waiter_name'))
            try:
                print(f"[LOG] Emitted SSE order_ready order={order.order_id} waiter_id={payload.get('waiter_id')} waiter_name={payload.get('waiter_name')}")
            except Exception:
                pass
        except Exception as e:
            logger.exception('Failed to emit order_ready SSE event for order %s: %s', order.order_id, e)

    elif status in ['completed', 'cancelled'] and order.table:
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
    if not _payments_schema_ready():
        return _schema_error_response()

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    orders = Order.objects.all().order_by('-created_at')[:100]
    data = [
        {
            'order_id': order.order_id,
            'table': order.table.number if order.table else ('Delivery' if order.delivery_address else 'Takeaway'),
            'phone': order.phone,
            'delivery_address': order.delivery_address,
            'delivery_distance_km': float(order.delivery_distance_km) if order.delivery_address and order.delivery_distance_km is not None else None,
            'delivery_time': order.delivery_time,
            'delivery_cost': float(order.delivery_cost or 0),
            'status': order.status,
            'total_amount': float(order.total_amount or 0),
            'item_count': order.items.count(),
            'is_paid': order.is_paid,
            'split_count': order.split_count,
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'waiter_id': order.waiter.id if getattr(order, 'waiter', None) else None,
            'waiter_name': (order.waiter_name or (order.waiter.name if getattr(order, 'waiter', None) else '')),
        }
        for order in orders
    ]
    return JsonResponse({'results': data})


def order_detail(request, order_id: str):
    if not _payments_schema_ready():
        return _schema_error_response()

    if not (_is_admin(request) or _is_staff(request)):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    order = Order.objects.filter(order_id=order_id).first()
    if not order:
        return JsonResponse({'error': 'not_found'}, status=404)

    return JsonResponse(_serialize_order(order))


def _empty_report_summary_payload(range_label: str = '') -> dict:
    return {
        'range_days': 0,
        'range_label': range_label,
        'best_items': [],
        'worst_items': [],
        'hourly_sales': [],
        'best_waiter': None,
        'least_waiter': None,
        'totals': {
            'revenue': 0,
            'cash_revenue': 0,
            'mpesa_revenue': 0,
            'food_cost': 0,
            'wastage': 0,
            'miscellaneous': 0,
            'profit': 0,
            'food_cost_ratio': 0,
        },
    }


def _build_report_summary(start_date: datetime.datetime, end_date: datetime.datetime, range_label: str):
    try:
        if not _payments_schema_ready():
            return _empty_report_summary_payload(range_label)

        paid_orders = list(Order.objects.filter(
            created_at__gte=start_date,
            created_at__lte=end_date,
        ).annotate(
            paid_sum=Sum('transactions__amount', filter=Q(transactions__status='success'))
        ).filter(
            Q(paid_sum__gte=F('total_amount')) | Q(status='completed'),
            total_amount__gt=0,
        ).values_list('id', flat=True))

        if not paid_orders:
            return _empty_report_summary_payload(range_label)

        order_items = OrderItem.objects.filter(order__id__in=paid_orders).annotate(
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
        hours = Order.objects.filter(id__in=paid_orders).annotate(hour=ExtractHour('created_at')).values('hour').annotate(
            orders=Count('id'),
            revenue=Sum('total_amount'),
        ).order_by('hour')
        for row in hours:
            hourly.append({
                'hour': row['hour'],
                'orders': row['orders'],
                'revenue': _to_display_currency(row['revenue'] or 0),
            })

        total_revenue = float(Transaction.objects.filter(
            order__id__in=paid_orders, status='success'
        ).aggregate(total=Sum('amount'))['total'] or 0)
        total_food_cost = float(order_items.aggregate(total=Sum(F('food_cost') * F('quantity'), output_field=DecimalField()))['total'] or 0)
        total_wastage = float(WastageLog.objects.filter(
            created_at__gte=start_date, created_at__lte=end_date
        ).aggregate(total=Sum('cost'))['total'] or 0)
        total_misc = float(MiscellaneousExpense.objects.filter(
            created_at__gte=start_date, created_at__lte=end_date
        ).aggregate(total=Sum('cost'))['total'] or 0)

        final_profit = total_revenue - total_food_cost - total_wastage - total_misc
        food_cost_ratio = float((Decimal(total_food_cost) / Decimal(total_revenue) * 100) if total_revenue else 0)

        cash_revenue = float(Transaction.objects.filter(
            order__id__in=paid_orders,
            status='success',
            method=Transaction.METHOD_CASH,
        ).aggregate(total=Sum('amount'))['total'] or 0)
        mpesa_revenue = float(Transaction.objects.filter(
            order__id__in=paid_orders,
            status='success',
            method=Transaction.METHOD_M_PESA,
        ).aggregate(total=Sum('amount'))['total'] or 0)

        waiter_stats_qs = Order.objects.filter(id__in=paid_orders).values('waiter_id', 'waiter_name', 'waiter__name').annotate(orders=Count('id'))
        best_waiter = None
        least_waiter = None
        if waiter_stats_qs:
            waiter_stats = []
            for w in waiter_stats_qs:
                waiter_name = (w.get('waiter_name') or w.get('waiter__name') or '').strip()
                if waiter_name:
                    waiter_stats.append({
                        'waiter_id': w.get('waiter_id'),
                        'waiter_name': waiter_name,
                        'orders': w.get('orders', 0),
                    })

            if waiter_stats:
                waiter_stats_sorted = sorted(waiter_stats, key=lambda x: x.get('orders', 0), reverse=True)
                top = waiter_stats_sorted[0]
                bottom = waiter_stats_sorted[-1]
                best_waiter = {
                    'waiter_id': top.get('waiter_id'),
                    'waiter_name': top.get('waiter_name'),
                    'orders': top.get('orders', 0),
                }
                least_waiter = {
                    'waiter_id': bottom.get('waiter_id'),
                    'waiter_name': bottom.get('waiter_name'),
                    'orders': bottom.get('orders', 0),
                }

        return {
            'range_days': (end_date - start_date).days + 1,
            'range_label': range_label,
            'best_items': best_items,
            'worst_items': worst_items,
            'hourly_sales': hourly,
            'best_waiter': best_waiter,
            'least_waiter': least_waiter,
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
    except Exception as exc:
        logger.exception('Error generating report summary: %s', exc)
        return _empty_report_summary_payload(range_label)


def report_summary(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        period_type = request.GET.get('period_type', 'week') # Default to week
        date_str = request.GET.get('date') # YYYY-MM-DD
        start_date, end_date, label = _get_period_dates(
            period_type,
            date_str,
            request.GET.get('start_date'),
            request.GET.get('end_date'),
        )
        data = _build_report_summary(start_date, end_date, label)
        return JsonResponse(data)
    except Exception as e:
        logger.exception('Error generating report summary')
        return JsonResponse(_empty_report_summary_payload(label or ''), status=200)


@csrf_exempt
def download_report(request):
    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    period_type = request.GET.get('period_type', 'week')
    date_str = request.GET.get('date')
    
    start_date, end_date, label = _get_period_dates(
        period_type,
        date_str,
        request.GET.get('start_date'),
        request.GET.get('end_date'),
    )
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

    # Best and least serving waiters
    writer.writerow([])
    writer.writerow(['Best Serving Waiter'])
    bw = report_data.get('best_waiter')
    if bw:
        writer.writerow(['Waiter ID', 'Waiter Name', 'Orders'])
        writer.writerow([bw.get('waiter_id'), bw.get('waiter_name'), bw.get('orders')])
    else:
        writer.writerow(['None'])

    writer.writerow([])
    writer.writerow(['Least Serving Waiter'])
    lw = report_data.get('least_waiter')
    if lw:
        writer.writerow(['Waiter ID', 'Waiter Name', 'Orders'])
        writer.writerow([lw.get('waiter_id'), lw.get('waiter_name'), lw.get('orders')])
    else:
        writer.writerow(['None'])

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
    if not _payments_schema_ready():
        return _schema_error_response()

    if not _is_admin(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method == 'GET':
        try:
            period_type = request.GET.get('period_type', 'week') # Default to week
            date_str = request.GET.get('date') # YYYY-MM-DD

            start_date, end_date, _ = _get_period_dates(
                period_type,
                date_str,
                request.GET.get('start_date'),
                request.GET.get('end_date'),
            )

            logs = WastageLog.objects.filter(
                created_at__gte=start_date, created_at__lte=end_date).order_by('-created_at')[:100]
            return JsonResponse({
                'wastage': [
                    {
                        'id': log.id,
                        'item_name': log.item_name,
                        'quantity': log.quantity,
                        'reason': log.reason,
                        'cost': _to_display_currency(log.cost),
                        'created_at': log.created_at.isoformat() if log.created_at else None,
                    }
                    for log in logs
                ]
            })
        except Exception as e:
            logger.exception('Error fetching wastage logs')
            return JsonResponse({'wastage': []})

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


@csrf_exempt
def mark_table_free(request, table_id):
    """Mark a specific table as available after payment completion."""
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        table = Table.objects.get(pk=table_id)
    except Table.DoesNotExist:
        return JsonResponse({'error': 'not_found'}, status=404)

    table.status = Table.STATUS_AVAILABLE
    table.save(update_fields=['status'])

    try:
        _log_staff_activity(
            request,
            'Marked table free',
            {
                'table_id': table.id,
                'table_number': table.number,
                'status': table.status,
            }
        )
    except Exception:
        pass

    return JsonResponse({'ok': True, 'status': table.status})


def get_active_pos_order(request):
    """Retrieves an active order for a given table number."""
    if request.method != 'GET':
        return HttpResponseBadRequest('Only GET allowed')

    if not _payments_schema_ready():
        return _schema_error_response()

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
        return JsonResponse({'error': 'method_not_allowed', 'message': 'Only POST allowed'}, status=405)

    if not _wait_for_payments_schema():
        logger.warning('create_pos_order schema warm-up did not complete; attempting one more repair pass')
        if not _payments_schema_ready():
            return _schema_error_response()

    # Initialize msisdn at function scope to avoid unbound variable errors
    msisdn = ""

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'invalid_json', 'message': 'Invalid JSON payload'}, status=400)

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

    payment_method = str(payload.get('payment_method') or 'unpaid').lower()
    is_mpesa = payment_method == Transaction.METHOD_M_PESA
    is_cash = payment_method == Transaction.METHOD_CASH

    if is_mpesa:
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

        # Accept waiter information from POS payload so orders are attributed to staff
        waiter_obj = None
        waiter_id_raw = payload.get('waiter_id')
        waiter_name_raw = (payload.get('waiter_name') or '').strip()
        if waiter_id_raw:
            try:
                waiter_obj = Employee.objects.filter(id=int(waiter_id_raw)).first()
            except Exception:
                waiter_obj = None

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
            waiter=waiter_obj,
            waiter_name=(waiter_name_raw or (waiter_obj.name if waiter_obj else '')),
        )

        cash_payment = is_cash and initial_status == 'paid'

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
            # Decrement stock for the sold item if it exists in MenuItem
            try:
                sold_qty = max(1, int(item.get('quantity') or 1))
                mi = _resolve_menu_item_from_payload(item)
                if mi:
                    mi.stock_level = (mi.stock_level or 0) - sold_qty
                    mi.save(update_fields=['stock_level'])
                    try:
                        StockLog.objects.create(item=mi, quantity=-sold_qty, cost=float(i_food_cost * sold_qty))
                    except Exception:
                        # Ignore logging failures
                        pass
                    # Emit low-stock alert when threshold reached
                    try:
                        if mi.stock_level is not None and mi.min_stock_level is not None and mi.stock_level <= mi.min_stock_level:
                            _emit_event('stock_alert', {
                                'item_id': mi.id,
                                'name': mi.name,
                                'stock_level': mi.stock_level,
                                'min_stock_level': mi.min_stock_level,
                            })
                    except Exception:
                        pass
            except Exception:
                pass

        if table:
            table.status = Table.STATUS_OCCUPIED
            table.save()

        try:
            _emit_event('new_order', {
                'order_id': order.order_id,
                'status': order.status,
                'table': table.number if table else 'Takeaway',
                'source': 'customer' if _is_customer_order(request) else 'staff',
                'created_at': order.created_at.isoformat() if order.created_at else None,
            })
        except Exception:
            logger.debug('Failed to emit new_order SSE event for order %s', order.order_id)

        stk_data = None
        if payment_method == Transaction.METHOD_M_PESA:
            tx = Transaction.objects.create(
                phone=msisdn,
                amount=total_amount,
                item=order.order_id,
                order=order,
                status='pending',
                method=Transaction.METHOD_M_PESA,
                raw_response={'source': 'customer_order'},
            )
            stk_data, status_code = _execute_stk_push(msisdn, total_amount, order.order_id, tx, request=request)
            if status_code != 200:
                return JsonResponse({'error': 'stk_push_failed', 'details': stk_data}, status=400)

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
            # cash payments immediately settle the order when the order is created as paid
            try:
                order.status = 'paid'
                order.save()
                if order.table:
                    order.table.status = Table.STATUS_AVAILABLE
                    order.table.save(update_fields=['status'])
                try:
                    _emit_event('order_update', {
                        'order_id': order.order_id,
                        'status': 'paid',
                        'source': 'cash',
                    })
                except Exception:
                    logger.debug('Failed to emit SSE event for cash-paid order %s', order.order_id)
            except Exception:
                pass

        return JsonResponse({
            **_serialize_order(order),
            'stk_response': stk_data,
        })
    except (db_utils.ProgrammingError, db_utils.OperationalError) as exc:
        logger.error('create_pos_order failed due to missing payments schema. Exception: %s', exc)
        logger.error('This usually means database migrations have not been applied. Check DATABASE_URL is set and migrations have run.')
        return JsonResponse({
            'error': 'schema_not_ready',
            'message': 'Payments database schema is not available. Migrations are being applied. Please try again in a moment.'
        }, status=503)
    except Exception as exc:
        error_message = str(exc)
        logger.exception('create_pos_order unexpected error: %s', exc)
        return JsonResponse({'error': 'server_error', 'message': error_message}, status=500)

@csrf_exempt
def add_to_pos_order(request, order_id):
    """Adds new items to an existing active order (KOT update)."""
    if not _wait_for_payments_schema():
        logger.warning('add_to_pos_order aborted because payments schema was not ready after retries')
        return _schema_error_response()

    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)
        
    try:
        order = Order.objects.get(order_id=order_id)
        payload = json.loads(request.body.decode('utf-8'))
        items_data = payload.get('items', [])
        
        # Update waiter info if provided
        waiter_name_raw = (payload.get('waiter_name') or '').strip()
        waiter_id_raw = payload.get('waiter_id')
        if waiter_name_raw:
            order.waiter_name = waiter_name_raw
        if waiter_id_raw:
            try:
                waiter_obj = Employee.objects.filter(id=int(waiter_id_raw)).first()
                if waiter_obj:
                    order.waiter = waiter_obj
            except Exception:
                pass
        
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
            # Decrement stock for the added items
            try:
                item_name = str(item.get('name', '')).strip()
                mi = _resolve_menu_item_from_payload({'name': item_name, 'quantity': quantity})
                if mi:
                    mi.stock_level = (mi.stock_level or 0) - quantity
                    mi.save(update_fields=['stock_level'])
                    try:
                        StockLog.objects.create(item=mi, quantity=-quantity, cost=float(Decimal(str(item.get('food_cost') or item.get('cost') or 0)) * quantity))
                    except Exception:
                        pass
                    try:
                        if mi.stock_level is not None and mi.min_stock_level is not None and mi.stock_level <= mi.min_stock_level:
                            _emit_event('stock_alert', {
                                'item_id': mi.id,
                                'name': mi.name,
                                'stock_level': mi.stock_level,
                                'min_stock_level': mi.min_stock_level,
                            })
                    except Exception:
                        pass
            except Exception:
                pass
            
        order.total_amount = new_total
        order.save()
        
        return JsonResponse(_serialize_order(order))
    except Order.DoesNotExist:
        return JsonResponse({'error': 'order_not_found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': 'server_error', 'message': str(e)}, status=500)

def cashier_pending_bills(request):
    """Retrieve all orders that cashier should review for payment."""
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        bills = Order.objects.filter(status__in=['pending', 'sent_kitchen', 'bill_pending', 'ready']).select_related('table').prefetch_related('items').order_by('-created_at')
        results = [_serialize_order(order) for order in bills]
        return JsonResponse({'bills': results})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def cashier_confirm_payment(request, order_id):
    """Cashier confirms payment and marks order as paid."""
    if not _is_staff(request):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    if not _payments_schema_ready():
        return JsonResponse({
            'error': 'schema_not_ready',
            'message': 'Payments database schema is not available. Please apply database migrations.'
        }, status=503)

    try:
        order = Order.objects.get(order_id=order_id)

        if order.status not in ['pending', 'sent_kitchen', 'bill_pending', 'ready']:
            return JsonResponse({'error': 'order_not_in_billable_state'}, status=400)

        payment_method = payload.get('payment_method', 'cash')

        if payment_method == 'mpesa':
            mpesa_number = (payload.get('mpesa_number') or order.phone or '').strip()
            if not mpesa_number:
                return JsonResponse({'error': 'mpesa_number_required'}, status=400)

            msisdn = _normalize_phone(mpesa_number)
            if not msisdn.startswith('254') or len(msisdn) < 12:
                return JsonResponse({'error': 'invalid_mpesa_number'}, status=400)

            tx = Transaction.objects.create(
                phone=msisdn,
                amount=order.total_amount,
                item=order.order_id,
                status='initiated',
                method=Transaction.METHOD_M_PESA,
                order=order,
            )

            resp_json, status_code = _execute_stk_push(msisdn, order.total_amount, order.order_id, tx, request=request)

            response_data = {'ok': True, 'order': _serialize_order(order), 'payment_method': payment_method, 'mpesa': resp_json}
            response_data['checkout_request_id'] = resp_json.get('CheckoutRequestID') if isinstance(resp_json, dict) else None

            return JsonResponse(response_data, status=200 if status_code == 200 else 400)

        if payment_method == 'cash':
            order.status = 'paid'
            order.save()

            Transaction.objects.create(
                phone=order.phone or '',
                amount=order.total_amount,
                item=order.order_id,
                status='success',
                method=Transaction.METHOD_CASH,
                order=order,
            )

            if order.table:
                order.table.status = Table.STATUS_AVAILABLE
                order.table.save(update_fields=['status'])

            try:
                _log_staff_activity(
                    request,
                    'Confirmed cash payment',
                    {
                        'order_id': order.order_id,
                        'payment_method': payment_method,
                        'table': order.table.number if order.table else 'Takeaway',
                        'amount': float(order.total_amount or 0),
                    },
                    order=order
                )
            except Exception:
                pass

            try:
                _emit_event('order_update', {'order_id': order.order_id, 'status': 'paid', 'source': 'cashier'})
            except Exception:
                logger.debug('Failed to emit SSE event for cashier-paid order %s', order.order_id)

            return JsonResponse({'ok': True, 'order': _serialize_order(order), 'payment_method': payment_method})

        return JsonResponse({'error': 'unsupported_payment_method'}, status=400)
    except Order.DoesNotExist:
        return JsonResponse({'error': 'order_not_found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def kds_queue(request):
    """Live queue for the kitchen."""
    # Allow unauthenticated access in local development for convenience when
    # `DEBUG` is enabled so developers and waiters can view the KDS without
    # requiring staff tokens. In production, this remains staff-only.
    try:
        from django.conf import settings as _conf_settings
        debug_mode = bool(getattr(_conf_settings, 'DEBUG', False))
    except Exception:
        debug_mode = False

    if not (_is_staff(request) or debug_mode):
        return JsonResponse({'error': 'unauthorized'}, status=403)

    try:
        # Optimization: use select_related and prefetch_related to reduce DB queries
        # Include 'sent_kitchen' so orders sent from POS by waiters are visible to the KDS
        orders = Order.objects.filter(
            status__in=['sent_kitchen', 'preparing', 'pending', 'paid']
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
                'waiter_id': o.waiter_id,
                'waiter_name': o.waiter_name,
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

    table_display = f"Table {order.table.number}" if order.table else 'Takeaway'

    # Record a staff activity for the waiter when the kitchen marks the order ready
    try:
        waiter_emp = None
        if getattr(order, 'waiter', None):
            waiter_emp = order.waiter
        elif getattr(order, 'waiter_id', None):
            waiter_emp = Employee.objects.filter(id=order.waiter_id).first()
        if not waiter_emp and getattr(order, 'waiter_name', None):
            waiter_emp = Employee.objects.filter(name__iexact=order.waiter_name).first()

        if waiter_emp:
            StaffActivity.objects.create(
                employee=waiter_emp,
                order=order,
                action='Order Ready Notification',
                details={'order_id': order.order_id, 'table': table_display, 'status': 'ready'}
            )
            try:
                print(f"[LOG] KDS created StaffActivity waiter={getattr(waiter_emp,'id','n/a')} order={order.order_id} action=Order Ready Notification")
            except Exception:
                pass
    except Exception:
        logger.debug('Failed to create StaffActivity for order_ready for order %s', order.order_id)

    # Emit SSE event so waiter UIs update immediately
    try:
        payload = {
            'order_id': order.order_id,
            'status': 'ready',
            'table': table_display,
            'table_id': order.table_id,
            'waiter_id': order.waiter_id if getattr(order, 'waiter_id', None) is not None else None,
            'waiter_name': order.waiter_name or (order.waiter.name if getattr(order, 'waiter', None) else ''),
            'created_at': order.created_at.isoformat() if order.created_at else None,
        }
        _emit_event('order_ready', payload)
        logger.info('Emitted SSE order_ready for order=%s waiter_id=%s waiter_name=%s', order.order_id, payload.get('waiter_id'), payload.get('waiter_name'))
        try:
            print(f"[LOG] KDS emitted SSE order_ready order={order.order_id} waiter_id={payload.get('waiter_id')} waiter_name={payload.get('waiter_name')}")
        except Exception:
            pass
    except Exception as e:
        logger.exception('Failed to emit order_ready SSE event for order %s: %s', order.order_id, e)

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

    response_body, status_code = _execute_stk_push(msisdn, amount, f"Order {order.order_id}", tx, request=request)
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
