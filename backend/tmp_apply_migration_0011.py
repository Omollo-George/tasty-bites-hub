import os
import sys

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_DIR = os.path.join(BASE_DIR, 'tastybites')
os.chdir(PROJECT_DIR)
sys.path.insert(0, PROJECT_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
os.environ['DATABASE_URL'] = 'postgres://019ef885-7192-7408-867b-53b34d349cf0:2a2a89d2-b73b-4e5d-bb4a-b56c1b33f267@us-west-2.db.thenile.dev/nile_gray_prism?sslmode=require'

import django
from django.core.management import call_command

django.setup()
call_command('migrate', 'payments', '0011', fake=True)
