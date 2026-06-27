import json

from django.db import connection
from django.test import RequestFactory, TestCase

from .views import admin_signin


class AdminSigninSchemaTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_admin_signin_returns_service_unavailable_when_auth_tables_are_missing(self):
        with connection.schema_editor() as schema_editor:
            for table_name in ['payments_admintoken', 'payments_adminsessionlog', 'payments_adminuser']:
                schema_editor.execute(f'DROP TABLE IF EXISTS {table_name}')

        request = self.factory.post(
            '/api/payments/admin/signin/',
            data=json.dumps({'username': 'admin', 'password': 'secret'}),
            content_type='application/json',
        )

        response = admin_signin(request)

        self.assertEqual(response.status_code, 503)
        self.assertIn('admin authentication tables', response.json()['error'])
