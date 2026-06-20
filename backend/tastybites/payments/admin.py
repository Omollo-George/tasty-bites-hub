from django.contrib import admin
from .models import Transaction, Table, Order, OrderItem, WastageLog, AdminUser, AdminToken, AppSettings, MiscellaneousExpense, MenuItem

# Register your models here.

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('checkout_request_id', 'phone', 'amount', 'item', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('checkout_request_id', 'phone', 'item')

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0 # Don't show extra empty forms
    readonly_fields = ('get_subtotal',)

    @admin.display(description='Subtotal')
    def get_subtotal(self, obj):
        return obj.subtotal

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('number', 'name', 'status')
    list_filter = ('status', 'created_at')
    search_fields = ('number', 'name')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'table', 'phone', 'total_amount', 'get_is_paid', 'status', 'created_at')
    list_filter = ('status', 'created_at', 'table')
    search_fields = ('order_id', 'phone', 'table__number', 'table__name')
    readonly_fields = ('order_id', 'created_at', 'get_is_paid', 'total_amount')
    inlines = [OrderItemInline]

    @admin.display(boolean=True, description='Paid')
    def get_is_paid(self, obj):
        return obj.is_paid

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'category', 'price', 'stock_level', 'popular', 'is_available', 'image_url')
    list_filter = ('category', 'popular', 'is_available')
    search_fields = ('name', 'description', 'sku')
    list_editable = ('price', 'stock_level', 'is_available', 'image_url')

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'name', 'quantity', 'price', 'seat_number', 'get_subtotal')
    list_filter = ('order__table', 'seat_number')
    search_fields = ('name', 'order__order_id')
    readonly_fields = ('get_subtotal',)

    @admin.display(description='Subtotal')
    def get_subtotal(self, obj):
        return obj.subtotal

@admin.register(WastageLog)
class WastageLogAdmin(admin.ModelAdmin):
    list_display = ('item_name', 'quantity', 'cost', 'reason', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('item_name', 'reason')
    readonly_fields = ('created_at',)

@admin.register(MiscellaneousExpense)
class MiscellaneousExpenseAdmin(admin.ModelAdmin):
    list_display = ('item_name', 'cost', 'reason', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('item_name', 'reason')
    readonly_fields = ('created_at',)

@admin.register(AdminUser)
class AdminUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'created_at')
    search_fields = ('username',)

@admin.register(AdminToken)
class AdminTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'created_at', 'expires_at', 'get_is_valid')
    list_filter = ('created_at', 'expires_at')
    search_fields = ('user__username', 'token')
    readonly_fields = ('token', 'created_at', 'get_is_valid')

    @admin.display(boolean=True, description='Valid')
    def get_is_valid(self, obj):
        return obj.is_valid()

@admin.register(AppSettings)
class AppSettingsAdmin(admin.ModelAdmin):
    list_display = ('default_phone', 'conversion_rate', 'delivery_rate_per_km', 'min_delivery_fee', 'base_currency', 'display_currency', 'updated_at')
    def has_add_permission(self, request):
        return not AppSettings.objects.exists()