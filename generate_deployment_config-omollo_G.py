d#!/usr/bin/env python3
"""
Sevalla Deployment Configuration Generator
Generates necessary environment variables and verifies deployment readiness
"""

import secrets
import json
from pathlib import Path

def generate_secret_key():
    """Generate a Django SECRET_KEY"""
    return f"django-insecure-{secrets.token_urlsafe(50)}"

def generate_admin_token():
    """Generate a secure admin token"""
    return secrets.token_urlsafe(32)

def main():
    print("=" * 70)
    print("SEVALLA DEPLOYMENT CONFIGURATION")
    print("=" * 70)
    
    config = {
        "SECRET_KEY": generate_secret_key(),
        "MPESA_ADMIN_TOKEN": generate_admin_token(),
    }
    
    print("\n1. Generated Django SECRET_KEY:")
    print(f"   {config['SECRET_KEY']}")
    
    print("\n2. Generated MPESA_ADMIN_TOKEN:")
    print(f"   {config['MPESA_ADMIN_TOKEN']}")
    
    print("\n3. Required Environment Variables for Sevalla Dashboard:")
    print("-" * 70)
    print("""
    DEBUG=False
    SECRET_KEY=<copy generated SECRET_KEY above>
    ALLOWED_HOSTS=yourapp.sevalla.app,yourdomain.com
    DATABASE_URL=postgresql://user:password@host:5432/dbname
    CORS_ALLOWED_ORIGINS=https://yourapp.sevalla.app
    CSRF_TRUSTED_ORIGINS=https://yourapp.sevalla.app
    SESSION_COOKIE_SECURE=True
    SESSION_COOKIE_HTTPONLY=True
    CSRF_COOKIE_SECURE=True
    SECURE_SSL_REDIRECT=True
    
    MPESA_CONSUMER_KEY=<from M-Pesa dashboard>
    MPESA_CONSUMER_SECRET=<from M-Pesa dashboard>
    MPESA_SHORTCODE=<your M-Pesa shortcode>
    MPESA_EXPRESS_SHORTCODE=<your M-Pesa shortcode>
    MPESA_PASSKEY=<from M-Pesa dashboard>
    MPESA_ENVIRONMENT=production
    MPESA_CALLBACK_URL=https://yourapp.sevalla.app/api/payments/callback/
    MPESA_ADMIN_TOKEN=<copy generated MPESA_ADMIN_TOKEN above>
    MPESA_TO_KES_RATE=1
    """)
    
    print("\n4. Build Command for Sevalla:")
    print("-" * 70)
    print("""
    If using Docker:
    (Dockerfile will handle frontend build and static files)
    
    If using native Python:
    cd backend/tastybites && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --no-input
    """)
    
    print("\n5. Start Command for Sevalla:")
    print("-" * 70)
    print("""
    gunicorn tastybites.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 30
    """)
    
    print("\n6. Health Check Endpoint:")
    print("-" * 70)
    print("""
    GET https://yourapp.sevalla.app/api/payments/config/
    Should return: {"base_currency": "KES", "display_currency": "KES", ...}
    """)
    
    print("\n" + "=" * 70)
    print("Next Steps:")
    print("=" * 70)
    print("""
    1. Create PostgreSQL database on Sevalla
    2. Set all environment variables in Sevalla dashboard
    3. Deploy the application
    4. Monitor logs for any errors
    5. Test the payment flow with M-Pesa test numbers
    """)
    
    # Save config to file for reference
    config_file = Path(__file__).parent / "sevalla_config.json"
    with open(config_file, "w") as f:
        json.dump({"timestamp": "Generated during deployment setup", **config}, f, indent=2)
    
    print(f"\nConfiguration saved to: {config_file}")
    print("(Keep this file secure - it contains sensitive tokens)")

if __name__ == "__main__":
    main()
