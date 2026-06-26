import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
os.environ.setdefault('DATABASE_URL', 'postgres://019ef885-7192-7408-867b-53b34d349cf0:2a2a89d2-b73b-4e5d-bb4a-b56c1b33f267@us-west-2.db.thenile.dev/nile_gray_prism?sslmode=require')

django.setup()
from payments.models import AdminUser

username = 'admin'
password = 'Admin123!'

user = AdminUser.objects.filter(username=username).first()
if user:
    print('Admin user already exists:', username)
else:
    user = AdminUser(username=username)
    user.set_password(password)
    user.save()
    print('Created admin user:')
    print('  username:', username)
    print('  password:', password)
