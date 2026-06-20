from __future__ import annotations
from decimal import Decimal
import uuid
from typing import TYPE_CHECKING

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone

if TYPE_CHECKING:
    from django.db.models.manager import Manager
    from .models import OrderItem, Transaction as TransactionModel



def generate_uuid_hex():
    return uuid.uuid4().hex


class Transaction(models.Model):
    METHOD_M_PESA = 'mpesa'
    METHOD_CASH = 'cash'
    METHOD_CHOICES = [
        (METHOD_M_PESA, 'M-Pesa'),
        (METHOD_CASH, 'Cash'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_INITIATED = 'initiated'
    STATUS_SUCCESS = 'success'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_INITIATED, 'Initiated'),
        (STATUS_SUCCESS, 'Success'),
        (STATUS_FAILED, 'Failed'),
    ]

    merchant_request_id = models.CharField(max_length=128, blank=True, null=True)
    checkout_request_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    phone = models.CharField(max_length=32)
    quantity = models.PositiveIntegerField(default=1)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    item = models.CharField(max_length=255, blank=True, null=True)
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    method = models.CharField(max_length=32, choices=METHOD_CHOICES, default=METHOD_M_PESA)
    raw_response = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def __str__(self):
        return f"{self.phone} {self.amount} {self.status}"


class Table(models.Model):
    STATUS_AVAILABLE = 'available'
    STATUS_OCCUPIED = 'occupied'
    STATUS_CLEANING = 'cleaning'
    STATUS_RESERVED = 'reserved'
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, '🟢 Available'),
        (STATUS_OCCUPIED, '🔴 Occupied'),
        (STATUS_CLEANING, '🧹 Cleaning'),
        (STATUS_RESERVED, '🟡 Reserved'),
    ]

    number = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def __str__(self):
        return self.name or f"Table {self.number}"


class Order(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_BILL_PENDING = 'bill_pending'
    STATUS_READY = 'ready'
    STATUS_PAID = 'paid'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_BILL_PENDING, 'Bill Pending'),
        (STATUS_READY, 'Ready'),
        (STATUS_PAID, 'Paid'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    order_id = models.CharField(max_length=64, unique=True, default=generate_uuid_hex, editable=False)
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    waiter = models.ForeignKey('Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    waiter_name = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=32, blank=True)
    delivery_address = models.CharField(max_length=512, blank=True, default='')
    delivery_distance_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    delivery_time = models.CharField(max_length=128, blank=True, default='')
    delivery_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    split_count = models.PositiveIntegerField(default=1)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int
        items: Manager[OrderItem]
        transactions: Manager[TransactionModel]

    def __str__(self):
        return f"Order {self.order_id}"

    @property
    def is_paid(self):
        # Sum all successful transactions for this order
        paid_sum = sum(t.amount for t in self.transactions.filter(status='success'))
        return paid_sum >= self.total_amount and self.total_amount > 0

    def amount_remaining(self):
        paid_sum = sum(t.amount for t in self.transactions.filter(status='success'))
        return max(0, self.total_amount - paid_sum)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    food_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    quantity = models.PositiveIntegerField(default=1)
    modifiers = models.JSONField(blank=True, null=True, default=list)
    seat_number = models.PositiveIntegerField(default=1)
    is_served = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    @property
    def subtotal(self):
        return self.price * self.quantity

    @property
    def cost_total(self):
        return self.food_cost * self.quantity

    def __str__(self):
        return f"{self.quantity}x {self.name}"


class MenuItem(models.Model):
    name = models.CharField(max_length=255, unique=True)
    category = models.CharField(max_length=64, default='All')
    sku = models.CharField(max_length=64, blank=True, null=True, db_index=True, help_text='Optional stock-keeping unit')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    food_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    description = models.TextField(blank=True, default='')
    popular = models.BooleanField(default=False)
    spicy = models.BooleanField(default=False)
    stock_level = models.IntegerField(default=0)
    min_stock_level = models.IntegerField(default=10)
    image_url = models.URLField(max_length=512, blank=True, default='')
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def __str__(self):
        return self.name


class WastageLog(models.Model):
    item_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    reason = models.CharField(max_length=512, blank=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def __str__(self):
        return f"{self.quantity}x {self.item_name} wasted on {self.created_at.date()}"

class MiscellaneousExpense(models.Model):
    item_name = models.CharField(max_length=255)
    reason = models.CharField(max_length=512, blank=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def __str__(self):
        return f"{self.item_name} - {self.cost} on {self.created_at.date()}"


class AdminSessionLog(models.Model):
    user = models.ForeignKey('AdminUser', on_delete=models.CASCADE, related_name='session_logs')
    login_time = models.DateTimeField(auto_now_add=True)
    logout_time = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.login_time}"


class StaffActivity(models.Model):
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='activities')
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_activities')
    action = models.CharField(max_length=255)
    details = models.JSONField(blank=True, null=True, default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def __str__(self):
        return f"{self.employee.name} - {self.action} @ {self.created_at}"


class StockLog(models.Model):
    item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='stock_logs')
    quantity = models.IntegerField()
    cost = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Added {self.quantity} to {self.item.name} at {self.created_at}"


class AdminUser(models.Model):
    username = models.CharField(max_length=150, unique=True)
    password_hash = models.CharField(max_length=256)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    lockout_until = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def set_password(self, raw_password: str):
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password_hash)

    def __str__(self):
        return self.username


class AdminToken(models.Model):
    user = models.ForeignKey(AdminUser, on_delete=models.CASCADE, related_name='tokens')
    token = models.CharField(max_length=64, unique=True, default=generate_uuid_hex, editable=False)
    session_log = models.OneToOneField(AdminSessionLog, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    if TYPE_CHECKING:
        id: int

    def is_valid(self) -> bool:
        return self.expires_at is None or self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.user.username} - {self.token}"


class AppSettings(models.Model):
    default_phone = models.CharField(max_length=32, blank=True, default='')
    conversion_rate = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('1.00'))
    delivery_rate_per_km = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('100.00'))
    min_delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('50.00'))
    base_currency = models.CharField(max_length=8, default='KES')
    display_currency = models.CharField(max_length=8, default='KES')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return "Tasty Bites Settings"

    @classmethod
    def current(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Employee(models.Model):
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=100, default='Staff')
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    password_hash = models.CharField(max_length=256, null=True, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    account_number = models.CharField(max_length=100, blank=True, default='')
    special_id = models.CharField(max_length=50, blank=True, default='', help_text='Special waiter ID number')
    document = models.FileField(upload_to='employee-documents/', blank=True, null=True)
    status = models.CharField(max_length=32, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def set_password(self, raw_password: str):
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password(raw_password, self.password_hash)

    def __str__(self):
        return f"{self.name} ({self.role})"


class Review(models.Model):
    customer_name = models.CharField(max_length=255, blank=True, null=True)
    rating = models.PositiveSmallIntegerField(choices=[(i, str(i)) for i in range(1, 6)]) # 1 to 5 stars
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    if TYPE_CHECKING:
        id: int

    def __str__(self):
        return f"Review by {self.customer_name or 'Anonymous'} - {self.rating} stars"


class StaffToken(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='tokens')
    token = models.CharField(max_length=64, unique=True, default=generate_uuid_hex, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    def is_valid(self) -> bool:
        return self.expires_at is None or self.expires_at > timezone.now()
