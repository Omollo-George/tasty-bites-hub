from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail, BadHeaderError
from django.conf import settings
from payments.models import Employee


class Command(BaseCommand):
    help = 'Send test emails to employees to verify mail configuration. Use --all or --ids.'

    def add_arguments(self, parser):
        parser.add_argument('--all', action='store_true', help='Send to all employees with email addresses')
        parser.add_argument('--ids', nargs='+', type=int, help='List of employee IDs to email')
        parser.add_argument('--message', '-m', type=str, default='This is a test email from Tasty Bites.', help='Message body')
        parser.add_argument('--subject', '-s', type=str, default='Tasty Bites - Test Email', help='Email subject')

    def handle(self, *args, **options):
        send_to_all = options['all']
        ids = options.get('ids') or []
        subject = options['subject']
        message = options['message']

        if not send_to_all and not ids:
            raise CommandError('Provide --all or --ids <id1> <id2> to select recipients')

        if send_to_all:
            qs = Employee.objects.exclude(email__isnull=True).exclude(email='')
        else:
            qs = Employee.objects.filter(id__in=ids).exclude(email__isnull=True).exclude(email='')

        recipients = list(qs.values_list('email', flat=True))
        if not recipients:
            self.stdout.write(self.style.WARNING('No recipients found (no employees with valid email addresses).'))
            return

        self.stdout.write(f'Using EMAIL_BACKEND={getattr(settings, "EMAIL_BACKEND", None)}')
        self.stdout.write(f'EMAIL_HOST={getattr(settings, "EMAIL_HOST", None)}')
        self.stdout.write(f'EMAIL_PORT={getattr(settings, "EMAIL_PORT", None)}')
        self.stdout.write(f'EMAIL_USE_TLS={getattr(settings, "EMAIL_USE_TLS", None)}')
        self.stdout.write(f'EMAIL_HOST_USER_SET={bool(getattr(settings, "EMAIL_HOST_USER", None))}')
        self.stdout.write(f'Sending to {len(recipients)} recipient(s)')

        # Try to open a connection first for clearer diagnostics
        from django.core.mail import get_connection
        conn = get_connection()
        try:
            conn.open()
            self.stdout.write(self.style.SUCCESS('Successfully opened mail connection'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Could not open mail connection: {e}'))
            return
        successes = 0
        for r in recipients:
            try:
                send_mail(subject, message, getattr(settings, 'DEFAULT_FROM_EMAIL', None), [r], fail_silently=False)
                self.stdout.write(self.style.SUCCESS(f'Sent to {r}'))
                successes += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Failed {r}: {e}'))

        self.stdout.write('')
        self.stdout.write(self.style.NOTICE(f'Total attempted: {len(recipients)}, Sent: {successes}'))