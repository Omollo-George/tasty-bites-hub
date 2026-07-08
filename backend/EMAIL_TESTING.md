Mail testing guide
===================

Use MailHog for local testing (recommended):

1. Start MailHog with Docker:

    docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

2. Configure environment for Django (example):

    export FORCE_CONSOLE_EMAIL=0
    export EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
    export EMAIL_HOST=127.0.0.1
    export EMAIL_PORT=1025
    export EMAIL_USE_TLS=False

3. Restart Django dev server and run the management command to send test emails:

    python manage.py runserver
    python manage.py send_test_emails --all --message "Hello from MailHog test"

4. Open MailHog UI at http://127.0.0.1:8025 to view delivered messages.

Troubleshooting real SMTP
-------------------------

- Ensure `EMAIL_HOST`, `EMAIL_PORT`, and TLS/SSL settings match your provider.
- For Gmail, use an App Password and `EMAIL_USE_TLS=True`, port 587.
- Check server logs for exceptions — the bulk-email endpoint will return a JSON error with details now.
