#!/usr/bin/env python3
"""
Script to generate secrets for Render deployment configuration.
Run this once and copy the output to your Render dashboard environment variables.
"""

import secrets
import string

def generate_django_secret():
    """Generate a secure Django SECRET_KEY"""
    try:
        from django.core.management.utils import get_random_secret_key
        return get_random_secret_key()
    except ImportError:
        # Fallback if django isn't installed
        chars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)'
        return ''.join(secrets.choice(chars) for _ in range(50))

def generate_admin_token():
    """Generate a secure admin token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(32))

def main():
    print("=" * 60)
    print("RENDER DEPLOYMENT SECRETS GENERATOR")
    print("=" * 60)
    print()
    
    print("Add these environment variables to your Render services:")
    print()
    
    django_secret = generate_django_secret()
    admin_token = generate_admin_token()
    
    print("📋 BACKEND SERVICE (Web Service) Environment Variables:")
    print("-" * 60)
    print(f"DJANGO_SECRET_KEY={django_secret}")
    print(f"MPESA_ADMIN_TOKEN={admin_token}")
    print()
    
    print("⚠️  NOTE: Also configure these on Render dashboard:")
    print("-" * 60)
    print("DJANGO_DEBUG=False")
    print("ALLOWED_HOSTS=*.onrender.com,localhost")
    print("CORS_ALLOWED_ORIGINS=<your-frontend-url>")
    print("MPESA_CALLBACK_URL=<your-backend-url>/api/payments/callback/")
    print("EMAIL_HOST_USER=<your-email>")
    print("EMAIL_HOST_PASSWORD=<your-app-password>")
    print()
    
    print("📦 FRONTEND SERVICE (Static Site) Environment Variables:")
    print("-" * 60)
    print("VITE_API_URL=<your-backend-url>/api")
    print()

if __name__ == '__main__':
    main()
