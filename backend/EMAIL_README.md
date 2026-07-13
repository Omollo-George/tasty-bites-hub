Email configuration and secure local development
------------------------------------------------

This file explains how to configure SMTP credentials for local development without committing secrets.

- Do NOT commit real passwords into any `*.env` files that are tracked by git.
- Use `backend/env.example` as a template for required variables.
- For local development create `backend/.env.local` (or set OS environment variables) and add real secrets there. `backend/.env` is ignored by git by default.

Gmail specific notes:
- Use a Gmail App Password (16-character) if your account has 2-Step Verification enabled.
- If you previously exposed an app password, rotate it immediately: https://myaccount.google.com/security

To test SMTP connectivity locally (PowerShell):
```powershell
Set-Location backend\tastybites
$env:EMAIL_HOST_PASSWORD='your-16-char-app-password'
python manage.py email_diagnose
python manage.py send_test_emails --all --message "Local test"
```
