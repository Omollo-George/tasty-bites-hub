import json

from django.db import connection
from django.test import RequestFactory, TestCase

from .views import admin_signin, _payments_schema_ready, report_summary


class SchemaCleanupMixin:
    def drop_table_if_exists(self, table_name):
        with connection.cursor() as cursor:
            cursor.execute(f'DROP TABLE IF EXISTS {table_name}')


class AdminSigninSchemaTests(SchemaCleanupMixin, TestCase):
    def setUp(self):
        self.factory = RequestFactory()

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

    def test_admin_signin_returns_service_unavailable_when_auth_tables_are_missing(self):
        for table_name in ['payments_admintoken', 'payments_adminsessionlog', 'payments_adminuser']:
            self.drop_table_if_exists(table_name)

        request = self.factory.post(
            '/api/payments/admin/signin/',
            data=json.dumps({'username': 'admin', 'password': 'secret'}),
            content_type='application/json',
        )

        response = admin_signin(request)

        self.assertEqual(response.status_code, 503)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertIn('admin authentication tables', payload['error'])

    def test_schema_repair_recreates_missing_tables(self):
        self.drop_table_if_exists('payments_orderitem')

        self.assertTrue(_payments_schema_ready())

    def test_config_returns_defaults_when_appsettings_table_is_missing(self):
        self.drop_table_if_exists('payments_appsettings')

        from .views import config
        request = self.factory.get('/api/payments/config/')
        response = config(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode('utf-8'))
        self.assertEqual(payload['base_currency'], 'KES')
        self.assertEqual(payload['conversion_rate'], 1.0)
