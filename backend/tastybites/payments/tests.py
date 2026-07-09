import importlib
import json
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from django.db.utils import OperationalError
from django.test import Client, RequestFactory, TestCase
from django.utils import timezone

from decimal import Decimal
from datetime import timedelta

from .views import admin_signin, _build_mpesa_callback_url, _ensure_required_tables, _payments_schema_ready, order_detail, order_status_update, report_summary, create_pos_order, menu_items, cashier_pending_bills, claim_order
from .models import AdminToken, AdminUser, Employee, MiscellaneousExpense, Order, OrderItem, StaffActivity, StaffToken, Transaction, WastageLog


class SchemaCleanupMixin:
    def drop_table_if_exists(self, table_name):
        with connection.cursor() as cursor:
            cursor.execute(f'DROP TABLE IF EXISTS {table_name}')


class AdminSigninSchemaTests(SchemaCleanupMixin, TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_builds_mpesa_callback_url_for_api_endpoint(self):
        request = self.factory.get('/checkout', secure=True)
        request.META['HTTP_HOST'] = 'example.com'

        callback_url = _build_mpesa_callback_url(request)

        self.assertEqual(callback_url, 'https://example.com/api/payments/callback/')

    def test_callback_endpoint_accepts_public_tunnel_host(self):
        client = Client(HTTP_HOST='tastybites-hub-local.loca.lt')

        response = client.get('/api/payments/callback/')

        self.assertEqual(response.status_code, 400)
        self.assertContains(response, 'Only POST allowed')

    def test_settings_loads_backend_env_file_for_mpesa_config(self):
        import tastybites.settings as settings_module

        with patch.object(settings_module, 'load_dotenv') as mock_load_dotenv:
            importlib.reload(settings_module)

        loaded_env_paths = [call.args[0] for call in mock_load_dotenv.call_args_list]
        self.assertIn(settings_module.BASE_DIR.parent / '.env', loaded_env_paths)

    def test_runserver_forces_sqlite_fallback_when_database_url_is_missing(self):
        import os
        import sys
        import tastybites.settings as settings_module

        with patch.dict(os.environ, {'DJANGO_DEBUG': 'False', 'DATABASE_URL': ''}, clear=False):
            with patch.object(sys, 'argv', ['manage.py', 'runserver']):
                reloaded_settings = importlib.reload(settings_module)

        self.assertTrue(reloaded_settings.DEBUG)
        self.assertEqual(reloaded_settings.DATABASES['default']['ENGINE'], 'django.db.backends.sqlite3')

    def test_create_pos_order_retries_when_schema_check_is_transient(self):
        employee = Employee.objects.create(name='Waiter Mike', role='Waiter', status='on_shift')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))

        request = self.factory.post(
            '/api/payments/pos/create-order/',
            data=json.dumps({
                'order_type': 'table',
                'table_number': '7',
                'status': 'sent_kitchen',
                'payment_method': 'unpaid',
                'waiter_id': employee.id,
                'waiter_name': employee.name,
                'items': [
                    {'name': 'Fries', 'price': 250, 'quantity': 1, 'modifiers': [], 'seat_number': 1}
                ],
            }),
            content_type='application/json',
        )
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        with patch('payments.views._payments_schema_ready', side_effect=[False, True]):
            response = create_pos_order(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['status'], 'sent_kitchen')
        self.assertEqual(payload['waiter_name'], employee.name)

    def test_cashier_pending_bills_orders_oldest_first(self):
        older_order = Order.objects.create(
            status='pending',
            total_amount=Decimal('100.00'),
            created_at=timezone.now() - timedelta(minutes=10),
        )
        newer_order = Order.objects.create(
            status='pending',
            total_amount=Decimal('200.00'),
            created_at=timezone.now() - timedelta(minutes=2),
        )

        request = self.factory.get('/api/payments/cashier/pending-bills/')

        with patch('payments.views._is_staff', return_value=True):
            response = cashier_pending_bills(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        order_ids = [bill['order_id'] for bill in payload['bills']]
        self.assertEqual(order_ids, [older_order.order_id, newer_order.order_id])

    def test_kds_queue_includes_order_type(self):
        Order.objects.create(status='sent_kitchen', total_amount=Decimal('100.00'))

        request = self.factory.get('/api/payments/kds/queue/')

        with patch('payments.views._is_staff', return_value=True):
            response = kds_queue(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['queue'][0]['order_type'], 'takeaway')

    def test_report_summary_returns_empty_payload_when_report_tables_are_broken(self):
        self.drop_table_if_exists('payments_orderitem')
        with connection.cursor() as cursor:
            cursor.execute('''
                CREATE TABLE payments_orderitem (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    price NUMERIC NOT NULL,
                    quantity INTEGER NOT NULL,
                    created_at DATETIME NOT NULL
                )
            ''')

        request = self.factory.get(
            '/api/payments/reports/summary/',
            {'period_type': 'week', 'date': '2026-06-27', 'admin_token': 'dev-admin-token'},
        )
        response = report_summary(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['totals']['revenue'], 0)
        self.assertEqual(payload['best_items'], [])
        self.assertEqual(payload['hourly_sales'], [])

    def test_report_summary_includes_wastage_and_miscellaneous_logs(self):
        WastageLog.objects.create(item_name='Tomato', quantity=2, reason='Spoilage', cost=Decimal('40'))
        MiscellaneousExpense.objects.create(item_name='Fuel', reason='Delivery', cost=Decimal('10'))

        request = self.factory.get(
            '/api/payments/reports/summary/',
            {'period_type': 'week', 'date': timezone.now().date().isoformat(), 'admin_token': 'dev-admin-token'},
        )
        response = report_summary(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(len(payload['wastage']), 1)
        self.assertEqual(payload['wastage'][0]['item_name'], 'Tomato')
        self.assertEqual(len(payload['miscellaneous']), 1)
        self.assertEqual(payload['miscellaneous'][0]['item_name'], 'Fuel')

    def test_admin_signin_returns_safe_payload_when_auth_tables_are_missing(self):
        for table_name in ['payments_admintoken', 'payments_adminsessionlog', 'payments_adminuser']:
            self.drop_table_if_exists(table_name)

        request = self.factory.post(
            '/api/payments/admin/signin/',
            data=json.dumps({'username': 'admin', 'password': 'secret'}),
            content_type='application/json',
        )

        response = admin_signin(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertIn('admin authentication tables', payload['error'])

    def test_schema_repair_recreates_missing_tables(self):
        self.drop_table_if_exists('payments_orderitem')

        self.assertTrue(_payments_schema_ready())

    def test_schema_repair_returns_false_when_database_backend_is_not_ready(self):
        with patch('payments.views.connection.introspection.table_names', side_effect=ImproperlyConfigured('ENGINE missing')):
            self.assertFalse(_ensure_required_tables())

    def test_schema_repair_adds_missing_orderitem_columns(self):
        self.drop_table_if_exists('payments_orderitem')
        with connection.cursor() as cursor:
            cursor.execute('''
                CREATE TABLE payments_orderitem (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    price NUMERIC NOT NULL,
                    quantity INTEGER NOT NULL,
                    created_at DATETIME NOT NULL
                )
            ''')

        from .views import _ensure_required_columns

        self.assertTrue(_ensure_required_columns())
        with connection.cursor() as cursor:
            columns = {col.name for col in connection.introspection.get_table_description(cursor, 'payments_orderitem')}

        self.assertIn('food_cost', columns)
        self.assertIn('is_served', columns)

    def test_schema_repair_adds_missing_transaction_columns(self):
        self.drop_table_if_exists('payments_transaction')
        with connection.cursor() as cursor:
            cursor.execute('''
                CREATE TABLE payments_transaction (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    phone VARCHAR(32) NOT NULL,
                    amount NUMERIC NOT NULL,
                    item VARCHAR(255) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    method VARCHAR(32) NOT NULL,
                    raw_response TEXT,
                    created_at DATETIME NOT NULL
                )
            ''')

        from .views import _ensure_required_columns

        self.assertTrue(_ensure_required_columns())
        with connection.cursor() as cursor:
            columns = {col.name for col in connection.introspection.get_table_description(cursor, 'payments_transaction')}

        self.assertIn('checkout_request_id', columns)
        self.assertIn('quantity', columns)
        self.assertIn('order_id', columns)

    def test_create_pos_order_recovers_when_schema_check_reports_unavailable(self):
        self.drop_table_if_exists('payments_order')
        self.drop_table_if_exists('payments_orderitem')

        employee = Employee.objects.create(name='Waiter Recovery', role='Waiter', status='on_shift')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))

        request = self.factory.post(
            '/api/payments/pos/create-order/',
            data=json.dumps({
                'order_type': 'table',
                'table_number': '19',
                'status': 'sent_kitchen',
                'payment_method': 'unpaid',
                'waiter_id': employee.id,
                'waiter_name': employee.name,
                'items': [
                    {'name': 'Fries', 'price': 250, 'quantity': 1, 'modifiers': [], 'seat_number': 1}
                ],
            }),
            content_type='application/json',
        )
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        with patch('payments.views._wait_for_payments_schema', return_value=False):
            response = create_pos_order(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['error'], 'schema_not_ready')
        self.assertIn('schema', payload['message'].lower())

    def test_create_pos_order_returns_safe_payload_when_database_create_fails(self):
        employee = Employee.objects.create(name='Waiter DB Fallback', role='Waiter', status='on_shift')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))

        request = self.factory.post(
            '/api/payments/pos/create-order/',
            data=json.dumps({
                'order_type': 'table',
                'table_number': '21',
                'status': 'sent_kitchen',
                'payment_method': 'unpaid',
                'waiter_id': employee.id,
                'waiter_name': employee.name,
                'items': [
                    {'name': 'Fries', 'price': 250, 'quantity': 1, 'modifiers': [], 'seat_number': 1}
                ],
            }),
            content_type='application/json',
        )
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        with patch('payments.views._wait_for_payments_schema', return_value=True), \
             patch('payments.views.Order.objects.create', side_effect=OperationalError('db unavailable')):
            response = create_pos_order(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['error'], 'schema_not_ready')

    def test_menu_items_returns_fallback_when_schema_is_missing(self):
        self.drop_table_if_exists('payments_menuitem')

        request = self.factory.get('/api/payments/menu-items/')
        response = menu_items(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertIn('menu_items', payload)
        self.assertGreaterEqual(len(payload['menu_items']), 1)

    def test_config_returns_defaults_when_appsettings_table_is_missing(self):
        self.drop_table_if_exists('payments_appsettings')

        from .views import config
        request = self.factory.get('/api/payments/config/')
        response = config(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['base_currency'], 'KES')
        self.assertEqual(payload['conversion_rate'], 1.0)

    def test_staff_activities_repair_creates_missing_staffactivity_table(self):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('DROP TABLE IF EXISTS payments_staffactivity')

        self.assertTrue(_payments_schema_ready())
        with connection.cursor() as cursor:
            existing_tables = set(connection.introspection.table_names(cursor))
        self.assertIn('payments_staffactivity', existing_tables)

    def test_order_status_update_paid_without_order_payment_method_field(self):
        admin_user = AdminUser.objects.create(username='testadmin', password_hash='testhash')
        admin_token = AdminToken.objects.create(user=admin_user)
        order = Order.objects.create(order_id='test-order-100', total_amount=Decimal('100.00'), status='pending')
        OrderItem.objects.create(order=order, name='Test Meal', price=Decimal('100.00'), food_cost=Decimal('0.00'), quantity=1)

        request = self.factory.post(
            f'/api/payments/orders/{order.order_id}/update/',
            data=json.dumps({'status': 'paid', 'payment_method': 'cash'}),
            content_type='application/json',
        )
        request.headers = {'Authorization': f'Bearer {admin_token.token}', 'X-ADMIN-TOKEN': admin_token.token}

        response = order_status_update(request, order.order_id)
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['status'], 'paid')
        self.assertEqual(payload['order_id'], order.order_id)
        self.assertTrue(Transaction.objects.filter(order=order, status='success').exists())

    def test_cashier_pending_bills_reports_outstanding_amount_from_transactions(self):
        employee = Employee.objects.create(name='Cashier Jane', role='Cashier', status='active')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))
        order = Order.objects.create(order_id='cashier-bill-2', total_amount=Decimal('300.00'), status='pending')
        OrderItem.objects.create(order=order, name='Burger', price=Decimal('150.00'), food_cost=Decimal('80.00'), quantity=2)
        Transaction.objects.create(
            order=order,
            phone='254700000000',
            amount=Decimal('120.00'),
            item=order.order_id,
            status='success',
            method=Transaction.METHOD_CASH,
        )

        request = self.factory.get('/api/payments/cashier/pending-bills/')
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        response = cashier_pending_bills(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertGreaterEqual(len(payload['bills']), 1)
        bill = payload['bills'][0]
        self.assertEqual(bill['order_id'], order.order_id)
        self.assertEqual(bill['outstanding_amount'], 180.0)
        self.assertEqual(bill['amount_paid'], 120.0)

    def test_cashier_pending_bills_returns_items_and_order_type(self):
        employee = Employee.objects.create(name='Cashier Jane', role='Cashier', status='active')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))
        order = Order.objects.create(order_id='cashier-bill-1', total_amount=Decimal('300.00'), status='pending')
        OrderItem.objects.create(order=order, name='Burger', price=Decimal('150.00'), food_cost=Decimal('80.00'), quantity=2)

        request = self.factory.get('/api/payments/cashier/pending-bills/')
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        response = cashier_pending_bills(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertGreaterEqual(len(payload['bills']), 1)
        bill = payload['bills'][0]
        self.assertEqual(bill['order_id'], order.order_id)
        self.assertEqual(bill['order_type'], 'takeaway')
        self.assertGreaterEqual(len(bill['items']), 1)
        self.assertEqual(bill['items'][0]['name'], 'Burger')

    def test_staff_can_access_order_detail(self):
        employee = Employee.objects.create(name='Waiter Jane', role='Waiter', status='on_shift')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))
        order = Order.objects.create(order_id='staff-order-100', total_amount=Decimal('120.00'), status='pending')
        OrderItem.objects.create(order=order, name='Sandwich', price=Decimal('120.00'), food_cost=Decimal('0.00'), quantity=1)

        request = self.factory.get(f'/api/payments/orders/{order.order_id}/')
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        response = order_detail(request, order.order_id)
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['order_id'], order.order_id)
        self.assertEqual(payload['status'], 'pending')

    def test_create_pos_order_allows_unpaid_staff_orders(self):
        employee = Employee.objects.create(name='Waiter Mike', role='Waiter', status='on_shift')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))

        request = self.factory.post(
            '/api/payments/pos/create-order/',
            data=json.dumps({
                'order_type': 'table',
                'table_number': '7',
                'status': 'sent_kitchen',
                'payment_method': 'unpaid',
                'waiter_id': employee.id,
                'waiter_name': employee.name,
                'items': [
                    { 'name': 'Fries', 'price': 250, 'quantity': 1, 'modifiers': [], 'seat_number': 1 }
                ],
            }),
            content_type='application/json',
        )
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        response = create_pos_order(request)
        self.assertEqual(response.status_code, 200)

        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['status'], 'sent_kitchen')
        self.assertEqual(payload['waiter_name'], employee.name)
        self.assertEqual(payload['table'], '7')
        self.assertEqual(len(payload['items']), 1)
        self.assertEqual(payload['items'][0]['name'], 'Fries')

    def test_create_pos_order_normalizes_staff_kitchen_orders_for_kds(self):
        employee = Employee.objects.create(name='Waiter Sam', role='Waiter', status='on_shift')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))

        request = self.factory.post(
            '/api/payments/pos/create-order/',
            data=json.dumps({
                'order_type': 'table',
                'table_number': '8',
                'status': 'preparing',
                'payment_method': 'unpaid',
                'waiter_id': employee.id,
                'waiter_name': employee.name,
                'items': [
                    {'name': 'Burger', 'price': 300, 'quantity': 1, 'modifiers': [], 'seat_number': 1}
                ],
            }),
            content_type='application/json',
        )
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        response = create_pos_order(request)
        self.assertEqual(response.status_code, 200)

        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['status'], 'sent_kitchen')
        self.assertEqual(payload['waiter_name'], employee.name)

    def test_claim_order_marks_order_as_claimed(self):
        employee = Employee.objects.create(name='Chef Claim', role='Chef', status='on_shift')
        staff_token = StaffToken.objects.create(employee=employee, expires_at=timezone.now() + timedelta(hours=8))
        order = Order.objects.create(order_id='claim-order-1', status='sent_kitchen', total_amount=Decimal('100.00'))
        OrderItem.objects.create(order=order, name='Tea', price=Decimal('100.00'), food_cost=Decimal('0.00'), quantity=1)

        request = self.factory.post(f'/api/payments/kds/claim/{order.order_id}/')
        request.headers = {'Authorization': f'Bearer {staff_token.token}', 'X-STAFF-TOKEN': staff_token.token}

        response = claim_order(request, order.order_id)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertTrue(payload['ok'])
        self.assertEqual(payload['claimed_by_name'], employee.name)

        order.refresh_from_db()
        self.assertEqual(order.claimed_by, employee)
        self.assertEqual(order.claimed_by_name, employee.name)

    def test_create_pos_order_creates_staff_notification_activities_for_cashier_and_chef(self):
        cashier = Employee.objects.create(name='Cashier Jane', role='Cashier', status='active')
        chef = Employee.objects.create(name='Chef Mike', role='Chef', status='active')

        request = self.factory.post(
            '/api/payments/pos/create-order/',
            data=json.dumps({
                'order_type': 'table',
                'table_number': '12',
                'status': 'sent_kitchen',
                'payment_method': 'unpaid',
                'items': [
                    {'name': 'Fries', 'price': 250, 'quantity': 1, 'modifiers': [], 'seat_number': 1}
                ],
            }),
            content_type='application/json',
        )

        response = create_pos_order(request)
        self.assertEqual(response.status_code, 200)

        payload = json.loads(response.content.decode('utf-8'))
        self.assertTrue(StaffActivity.objects.filter(order__order_id=payload['order_id'], employee=cashier).exists())
        self.assertTrue(StaffActivity.objects.filter(order__order_id=payload['order_id'], employee=chef).exists())
        activities = StaffActivity.objects.filter(order__order_id=payload['order_id']).values_list('action', flat=True)
        self.assertTrue(any('cashier' in action.lower() for action in activities))
        self.assertTrue(any('chef' in action.lower() or 'kitchen' in action.lower() for action in activities))
