import json
from unittest.mock import patch

from django.db import connection
from django.db.utils import OperationalError
from django.test import RequestFactory, TestCase
from django.utils import timezone

from decimal import Decimal
from datetime import timedelta

from .views import admin_signin, _payments_schema_ready, order_detail, order_status_update, report_summary, create_pos_order, menu_items
from .models import AdminToken, AdminUser, Employee, MiscellaneousExpense, Order, OrderItem, StaffToken, Transaction, WastageLog


class SchemaCleanupMixin:
    def drop_table_if_exists(self, table_name):
        with connection.cursor() as cursor:
            cursor.execute(f'DROP TABLE IF EXISTS {table_name}')


class AdminSigninSchemaTests(SchemaCleanupMixin, TestCase):
    def setUp(self):
        self.factory = RequestFactory()

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
