#!/usr/bin/env python
"""
Script to fix food_cost values in OrderItem records.
Maps OrderItem names to MenuItem.food_cost values and updates them.
"""
import os
import sys
import django
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tastybites.settings')
sys.path.insert(0, 'tastybites')

try:
    django.setup()
except Exception as e:
    print(f"Django setup error: {e}")
    sys.exit(1)

from payments.models import OrderItem, MenuItem

def fix_order_item_food_costs():
    """Update all OrderItem records with correct food_cost from MenuItem."""
    
    # Build a map of menu item names to food costs
    menu_items = MenuItem.objects.all().values('name', 'food_cost')
    food_cost_map = {item['name']: Decimal(str(item['food_cost'] or '0')) for item in menu_items}
    
    print(f"Loaded {len(food_cost_map)} menu items")
    print(f"Sample menu items: {list(food_cost_map.items())[:5]}")
    
    # Find all OrderItems with incorrect food_cost (0 or 5)
    incorrect_items = OrderItem.objects.filter(
        food_cost__in=[Decimal('0'), Decimal('5')]
    ).select_related('order')
    
    print(f"\nFound {incorrect_items.count()} OrderItems with incorrect food costs (0 or 5)")
    
    updated_count = 0
    skipped_count = 0
    
    for order_item in incorrect_items:
        correct_cost = food_cost_map.get(order_item.name, Decimal('0'))
        
        if correct_cost > 0:
            print(f"  Updating: {order_item.name} - {order_item.food_cost} → {correct_cost}")
            order_item.food_cost = correct_cost
            order_item.save(update_fields=['food_cost'])
            updated_count += 1
        else:
            print(f"  Skipping: {order_item.name} - Not found in menu")
            skipped_count += 1
    
    print(f"\n✓ Updated {updated_count} OrderItems")
    print(f"⚠ Skipped {skipped_count} OrderItems (item not in current menu)")
    
    # Show summary of what remains
    remaining = OrderItem.objects.filter(food_cost__in=[Decimal('0'), Decimal('5')])
    print(f"\nRemaining OrderItems with cost 0 or 5: {remaining.count()}")
    
    # Show distinct food cost values now
    print("\nDistinct food_cost values in OrderItem after fix:")
    distinct_costs = OrderItem.objects.values_list('food_cost', flat=True).distinct().order_by('food_cost')
    for cost in distinct_costs[:20]:
        count = OrderItem.objects.filter(food_cost=cost).count()
        print(f"  {cost}: {count} items")

if __name__ == '__main__':
    try:
        fix_order_item_food_costs()
        print("\n✓ Fix complete!")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
