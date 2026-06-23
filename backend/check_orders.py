import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
django.setup()

from payments.models import Order
print(f'Total orders: {Order.objects.count()}')
print(f'Completed orders: {Order.objects.filter(status="completed").count()}')
for o in Order.objects.all()[:5]:
    print(f'  Order {o.id}: {o.total_amount} KES, status={o.status}, created={o.created_at}')
