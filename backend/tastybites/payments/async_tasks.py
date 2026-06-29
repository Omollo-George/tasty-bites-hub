"""
Async background task handlers for order processing operations.
These operations don't need to block the HTTP response.

Without Celery, we use Django signals and database queuing for async-like behavior.
"""

import logging
import json
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from .models import Order, OrderItem, StaffActivity, StockLog
from .utils import _emit_event, _resolve_menu_item_from_payload

logger = logging.getLogger(__name__)


def process_deferred_order_operations(order_id, operations):
    """
    Process deferred operations for an order asynchronously.
    
    Args:
        order_id: The order ID to process
        operations: Dict with keys 'stock_updates', 'logs', 'events'
    """
    try:
        order = Order.objects.get(order_id=order_id)
    except Order.DoesNotExist:
        logger.error("Order %s not found for deferred operations", order_id)
        return

    # Process stock updates
    if operations.get('stock_updates'):
        _process_stock_updates(operations['stock_updates'], order)

    # Process activity logs
    if operations.get('logs'):
        _process_staff_activity_logs(operations['logs'], order)

    # Process SSE events
    if operations.get('events'):
        _process_sse_events(operations['events'])


def _process_stock_updates(stock_updates, order):
    """Batch process stock updates for order items."""
    try:
        for item_update in stock_updates:
            try:
                item_name = item_update.get('name')
                quantity = item_update.get('quantity', 1)
                cost = item_update.get('cost', '0')

                mi = _resolve_menu_item_from_payload({'name': item_name})
                if not mi:
                    continue

                # Update stock level
                mi.stock_level = (mi.stock_level or 0) - quantity
                mi.save(update_fields=['stock_level'])

                # Log the stock transaction
                try:
                    StockLog.objects.create(
                        item=mi,
                        quantity=-quantity,
                        cost=float(Decimal(str(cost or 0)))
                    )
                except Exception as e:
                    logger.warning("Failed to create StockLog for %s: %s", item_name, e)

                # Emit low-stock alert if needed
                try:
                    if (mi.stock_level is not None and mi.min_stock_level is not None
                            and mi.stock_level <= mi.min_stock_level):
                        _emit_event('stock_alert', {
                            'item_id': mi.id,
                            'name': mi.name,
                            'stock_level': mi.stock_level,
                            'min_stock_level': mi.min_stock_level,
                        })
                except Exception as e:
                    logger.debug("Failed to emit stock alert: %s", e)

            except Exception as e:
                logger.warning("Error processing stock update for item: %s", e)
                continue

    except Exception as e:
        logger.error("Error in _process_stock_updates: %s", e)


def _process_staff_activity_logs(logs, order):
    """Batch process staff activity logs."""
    try:
        for log_entry in logs:
            try:
                StaffActivity.objects.create(
                    order=order,
                    action=log_entry.get('action'),
                    staff_id=log_entry.get('staff_id'),
                    details=json.dumps(log_entry.get('details', {}))
                )
            except Exception as e:
                logger.warning("Failed to create StaffActivity log: %s", e)

    except Exception as e:
        logger.error("Error in _process_staff_activity_logs: %s", e)


def _process_sse_events(events):
    """Batch process SSE event emissions."""
    try:
        for event in events:
            try:
                _emit_event(event.get('type'), event.get('data', {}))
            except Exception as e:
                logger.debug("Failed to emit SSE event '%s': %s", event.get('type'), e)

    except Exception as e:
        logger.error("Error in _process_sse_events: %s", e)


def prepare_deferred_stock_operations(items_data):
    """
    Prepare stock update operations for async processing.
    
    Args:
        items_data: List of order items with name, quantity, cost
        
    Returns:
        List of stock update operations
    """
    stock_ops = []
    try:
        for item in items_data:
            try:
                quantity = max(1, int(item.get('quantity', 1)))
                cost = item.get('food_cost', item.get('cost', '0'))
                
                stock_ops.append({
                    'name': str(item.get('name', '')).strip(),
                    'quantity': quantity,
                    'cost': cost,
                })
            except Exception as e:
                logger.debug("Error preparing stock operation: %s", e)
                continue
    except Exception as e:
        logger.error("Error in prepare_deferred_stock_operations: %s", e)

    return stock_ops


def emit_order_created_event(order):
    """Emit order creation event asynchronously."""
    try:
        from django.core.cache import cache
        
        event_data = {
            'order_id': order.order_id,
            'status': order.status,
            'table': order.table.number if order.table else 'Takeaway',
            'source': 'staff',
            'created_at': order.created_at.isoformat() if order.created_at else None,
        }
        
        _emit_event('new_order', event_data)
        
    except Exception as e:
        logger.debug("Failed to emit order_created event: %s", e)


def emit_order_updated_event(order_id, status, details=None):
    """Emit order update event asynchronously."""
    try:
        event_data = {
            'order_id': order_id,
            'status': status,
        }
        
        if details:
            event_data.update(details)
        
        _emit_event('order_update', event_data)
        
    except Exception as e:
        logger.debug("Failed to emit order_updated event: %s", e)
