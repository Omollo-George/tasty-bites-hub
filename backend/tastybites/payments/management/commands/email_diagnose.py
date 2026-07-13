from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.mail import get_connection
import smtplib


class Command(BaseCommand):
    help = 'Diagnose email configuration and test SMTP connection for the app.'

    def handle(self, *args, **options):
        self.stdout.write('Email configuration diagnostics')
        self.stdout.write('---------------------------------')
        self.stdout.write(f'EMAIL_BACKEND = {getattr(settings, "EMAIL_BACKEND", None)}')
        self.stdout.write(f'EMAIL_HOST = {getattr(settings, "EMAIL_HOST", None)}')
        self.stdout.write(f'EMAIL_PORT = {getattr(settings, "EMAIL_PORT", None)}')
        self.stdout.write(f'EMAIL_USE_TLS = {getattr(settings, "EMAIL_USE_TLS", None)}')
        self.stdout.write(f'EMAIL_HOST_USER = {getattr(settings, "EMAIL_HOST_USER", None)}')
        pw_set = bool(getattr(settings, 'EMAIL_HOST_PASSWORD', ''))
        self.stdout.write(f'EMAIL_HOST_PASSWORD_SET = {pw_set}')

        if not getattr(settings, 'EMAIL_HOST', None):
            self.stderr.write('EMAIL_HOST is not configured. Set EMAIL_HOST in your environment or .env file.')
            return

        try:
            conn = get_connection()
            conn.open()
            self.stdout.write(self.style.SUCCESS('SMTP connection successful (connection opened).'))
            conn.close()
        except smtplib.SMTPAuthenticationError as e:
            self.stderr.write('SMTP authentication failed: check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD (Gmail requires an app password).')
            self.stderr.write(str(e))
        except Exception as e:
            self.stderr.write('Failed to connect to SMTP server:')
            self.stderr.write(str(e))
            self.stderr.write('If you are using Gmail, ensure 2-Step Verification is enabled and you generated an App Password. Also check account security alerts for blocked sign-ins.')
