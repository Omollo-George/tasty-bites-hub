Plan (approved with user intent)

Information gathered
- Admin UI pages exist: src/pages/Admin/{Home,Orders,Menu,Reports,Settings}.
- Admin Menu page currently supports:
  - Table create/delete
  - Mark KDS order ready
  - Fetch POS tables, KDS queue, and menu items
  - Update menu item price (prompt-based)
- Backend (tastybites/payments/views.py) currently supports:
  - GET /menu-items/ (seeds default menu items if none exist)
  - POST /menu-items/<id>/update-price/ (admin-only)
  - POS tables, KDS queue, order status updates, receipts, reports, wastage log
- Data models (tastybites/payments/models.py):
  - Operational: Table, Order, OrderItem, Transaction, WastageLog, MenuItem
  - Admin auth: AdminUser, AdminToken
  - Settings: AppSettings

Goal
- Add a “Clear All Data” admin button that clears operational data including orders and all foods available, and allows admin to insert new food types (categories) and set their prices.

Edit plan (code-level)
1) Backend: add admin-only clear endpoint
   - Implement view clear_operational_data(request)
   - Delete in correct dependency order:
     - OrderItem (cascade, but explicit delete is safer)
     - Transaction
     - Order
     - WastageLog
     - Table
     - MenuItem
   - Keep AdminUser/AdminToken and AppSettings untouched.
   - Route example: POST /api/payments/admin/clear/ (admin token auth)

2) Backend: add endpoint to create new menu items (admin-only)
   - Implement POST /api/payments/menu-items/create/ accepting:
     - name, price, food_cost, description, category, popular, spicy
   - Create MenuItem row.
   - Keep category as a free-text string (serves as “food type”).

3) Frontend: add Clear All Data button in Admin Menu page
   - Add button with confirmation dialog.
   - Calls POST /api/payments/admin/clear/
   - After success, refresh tables/queue/menu items.

4) Frontend: add “Add Food Type” UI (category + first item)
   - Add a small form on Admin Menu page:
     - category (text)
     - item name
     - item price
     - food cost
     - description
     - popular/spicy checkboxes
   - On submit call POST /api/payments/menu-items/create/
   - Then refresh menu items and let admin update prices later.

5) Testing
   - Run backend + frontend.
   - Verify menu seeding: current GET /menu-items/ seeds default items if none exist.
   - After clear, menu GET should reseed unless we adjust seeding behavior.
     - Desired behavior per user: “clear… all foods available and allowing admin to insert new food types”.
     - Therefore, we must disable/alter _ensure_menu_items() seeding after clear OR add a flag param to prevent seeding.
     - Best: modify _ensure_menu_items(only_if_empty=True, allow_seed=True) driven by request query param like ?seed=0.
     - Then clear endpoint should set seed mode off when frontend fetches.

Dependent files to edit
- tastybites/payments/views.py
- tastybites/payments/urls.py
- src/pages/Admin/Menu.tsx

Follow-up steps
- Run Django migrations if needed (likely none if we only add endpoints).
- Start dev server and manually test:
  - Clear button deletes orders/foods.
  - Add food type/category and item appears in menu.


