from django.urls import path
from . import views

urlpatterns = [
    path('stk/', views.stk_push, name='stk_push'),
    path('callback/', views.stk_callback, name='stk_callback'),
    path('status/', views.payment_status, name='payment_status'),
    path('config/', views.config, name='payments_config'),
    path('admin/signup/', views.admin_signup, name='admin_signup'),
    path('admin/signin/', views.admin_signin, name='admin_signin'),
    path('admin/signout/', views.admin_signout, name='admin_signout'),
    path('admin/touch/', views.admin_touch, name='admin_touch'),
    path('admin/session-logs/', views.admin_session_logs, name='admin_session_logs'),
    path('admin/me/', views.admin_me, name='admin_me'),
    path('admin/settings/', views.admin_settings, name='admin_settings'),
    path('admin/users/', views.admin_users, name='admin_users'),
    path('admin/users/<str:username>/', views.admin_user_detail, name='admin_user_detail'),
    path('orders/', views.orders_list, name='orders_list'),
    path('orders/<str:order_id>/', views.order_detail, name='order_detail'),
    path('orders/<str:order_id>/update/', views.order_status_update, name='order_update'),
    path('orders/<str:order_id>/item/<int:item_id>/update-price/', views.order_item_price_update, name='order_item_price_update'),
    path('menu-items/', views.menu_items, name='menu_items'),
    path('menu-items/create/', views.menu_item_create, name='menu_item_create'),
    path('menu-items/<int:item_id>/update-price/', views.menu_item_update, name='menu_item_update'),
    path('menu-items/<int:item_id>/update-stock/', views.menu_item_stock_update, name='menu_item_stock_update'),
    path('menu-items/<int:item_id>/delete/', views.menu_item_delete, name='menu_item_delete'),
    path('admin/clear/', views.admin_clear, name='admin_clear'),

    path('reports/summary/', views.report_summary, name='report_summary'),
    path('reports/download/', views.download_report, name='download_report'),
    path('reports/wastage/', views.wastage_log, name='wastage_log'),

    # Stock Management
    path('stock/most-consumed/', views.most_consumed_stock, name='most_consumed_stock'),
    path('admin/stock/add/', views.admin_add_stock, name='admin_add_stock'),

    path('admin/employees/', views.employees_list, name='employees_list'),
    path('admin/employees/<int:employee_id>/', views.employee_detail, name='employee_detail'),
    path('admin/employees/<int:employee_id>/email/', views.send_employee_email, name='send_employee_email'),
    
    # POS & KDS Endpoints
    path('pos/tables/', views.table_list, name='table_list'),
    path('pos/tables/<int:table_id>/', views.table_update, name='table_update'),
    path('pos/create-order/', views.create_pos_order, name='create_pos_order'),
    path('kds/queue/', views.kds_queue, name='kds_queue'),
    path('kds/complete/<str:order_id>/', views.order_complete, name='order_complete'),
    path('pos/split-payment/', views.initiate_split_payment, name='initiate_split_payment'),
    path('pos/receipt/<str:order_id>/', views.get_receipt_data, name='get_receipt_data'),
]
