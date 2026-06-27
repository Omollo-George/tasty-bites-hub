import json

from django.db import connection
from django.test import RequestFactory, TestCase

from .views import admin_signin, _payments_schema_ready


class SchemaCleanupMixin:
    def drop_table_if_exists(self, table_name):
        with connection.cursor() as cursor:
            cursor.execute(f'DROP TABLE IF EXISTS {table_name}')


class AdminSigninSchemaTests(SchemaCleanupMixin, TestCase):
    def setUp(self):
        self.factory = RequestFactory()

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
