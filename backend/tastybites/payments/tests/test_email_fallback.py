import json
from django.test import TestCase
from unittest.mock import Mock, patch

from payments.models import Employee
from tastybites import settings as tasty_settings


class EmployeeEmailFallbackTests(TestCase):
    def setUp(self):
        self.employee = Employee.objects.create(
            name='Test Employee',
            email='test@example.com',
            role='Waiter',
            username='testemployee',
        )
        self.employee.set_password('testpass')
        self.employee.save(update_fields=['password_hash'])

    @patch('payments.views.send_mail')
    @patch('payments.views._is_admin', return_value=True)
    def test_send_employee_email_uses_console_backend_when_explicitly_requested(self, mock_is_admin, mock_send_mail):
        with patch.object(tasty_settings, 'EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend'), patch.object(tasty_settings, 'EMAIL_HOST', ''), patch.object(tasty_settings, 'EMAIL_HOST_USER', ''), patch.object(tasty_settings, 'EMAIL_HOST_PASSWORD', ''):
            response = self.client.post(
                f'/payments/admin/employees/{self.employee.id}/email/',
                data=json.dumps({'message': 'hello', 'subject': 'Test'}),
                content_type='application/json',
                HTTP_AUTHORIZATION='Bearer dev-admin-token',
                follow=True,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['mode'], 'console')
        mock_send_mail.assert_called_once()

    @patch('django.core.mail.get_connection')
    @patch('payments.views.send_mail')
    @patch('payments.views._is_admin', return_value=True)
    def test_send_employee_email_uses_local_smtp_fallback_in_debug(self, mock_is_admin, mock_send_mail, mock_get_connection):
        mock_conn = Mock()
        mock_get_connection.return_value = mock_conn

        with patch.object(tasty_settings, 'EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend'), patch.object(tasty_settings, 'EMAIL_HOST', ''), patch.object(tasty_settings, 'EMAIL_PORT', 1025), patch.object(tasty_settings, 'EMAIL_USE_TLS', False), patch.object(tasty_settings, 'EMAIL_HOST_USER', ''), patch.object(tasty_settings, 'EMAIL_HOST_PASSWORD', ''), patch.object(tasty_settings, 'DEBUG', True):
            response = self.client.post(
                f'/payments/admin/employees/{self.employee.id}/email/',
                data=json.dumps({'message': 'hello', 'subject': 'Test'}),
                content_type='application/json',
                HTTP_AUTHORIZATION='Bearer dev-admin-token',
                follow=True,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['mode'], 'smtp')
        mock_get_connection.assert_called_once_with(
            host='127.0.0.1',
            port=1025,
            username=None,
            password=None,
            use_tls=False,
            use_ssl=False,
        )
        mock_send_mail.assert_called_once()
