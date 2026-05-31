import os
import sys

# ensure project root and inner project package are on path
ROOT = os.path.dirname(os.path.dirname(__file__))
INNER = os.path.join(ROOT, 'tastybites')
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if INNER not in sys.path:
    sys.path.insert(0, INNER)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

username = 'omollo'
email = 'omollogeorge096@gmail.com'
password = 'George8736!'

if User.objects.filter(username=username).exists():
    print('superuser already exists')
else:
    User.objects.create_superuser(username=username, email=email, password=password)
    print('superuser created')
