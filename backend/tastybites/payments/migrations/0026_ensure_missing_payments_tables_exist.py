from django.db import migrations, connection


def _ensure_missing_payments_tables_exist(apps, schema_editor):
    with connection.cursor() as cursor:
        existing_tables = set(connection.introspection.table_names())
        vendor = connection.vendor

        if 'payments_menuitem' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_menuitem (
                    id bigserial PRIMARY KEY,
                    name varchar(255) NOT NULL UNIQUE,
                    category varchar(64) NOT NULL DEFAULT 'All',
                    sku varchar(64),
                    price numeric NOT NULL,
                    food_cost numeric NOT NULL DEFAULT 0.00,
                    description text NOT NULL DEFAULT '',
                    popular boolean NOT NULL DEFAULT false,
                    spicy boolean NOT NULL DEFAULT false,
                    stock_level integer NOT NULL DEFAULT 0,
                    min_stock_level integer NOT NULL DEFAULT 10,
                    image_url varchar(512) NOT NULL DEFAULT '',
                    is_available boolean NOT NULL DEFAULT true,
                    created_at timestamp with time zone NOT NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_menuitem (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    name varchar(255) NOT NULL UNIQUE,
                    category varchar(64) NOT NULL DEFAULT 'All',
                    sku varchar(64),
                    price numeric NOT NULL,
                    food_cost numeric NOT NULL DEFAULT 0.00,
                    description text NOT NULL DEFAULT '',
                    popular integer NOT NULL DEFAULT 0,
                    spicy integer NOT NULL DEFAULT 0,
                    stock_level integer NOT NULL DEFAULT 0,
                    min_stock_level integer NOT NULL DEFAULT 10,
                    image_url varchar(512) NOT NULL DEFAULT '',
                    is_available integer NOT NULL DEFAULT 1,
                    created_at datetime NOT NULL
                )
                ''')

        if 'payments_review' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_review (
                    id bigserial PRIMARY KEY,
                    customer_name varchar(255),
                    rating integer NOT NULL,
                    comment text,
                    created_at timestamp with time zone NOT NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_review (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    customer_name varchar(255),
                    rating integer NOT NULL,
                    comment text,
                    created_at datetime NOT NULL
                )
                ''')

        if 'payments_wastagelog' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_wastagelog (
                    id bigserial PRIMARY KEY,
                    item_name varchar(255) NOT NULL,
                    quantity integer NOT NULL DEFAULT 1,
                    reason varchar(512) NOT NULL DEFAULT '',
                    cost numeric NOT NULL DEFAULT 0.00,
                    created_at timestamp with time zone NOT NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_wastagelog (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    item_name varchar(255) NOT NULL,
                    quantity integer NOT NULL DEFAULT 1,
                    reason varchar(512) NOT NULL DEFAULT '',
                    cost numeric NOT NULL DEFAULT 0.00,
                    created_at datetime NOT NULL
                )
                ''')

        if 'payments_miscellaneousexpense' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_miscellaneousexpense (
                    id bigserial PRIMARY KEY,
                    item_name varchar(255) NOT NULL,
                    reason varchar(512) NOT NULL DEFAULT '',
                    cost numeric NOT NULL DEFAULT 0.00,
                    created_at timestamp with time zone NOT NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_miscellaneousexpense (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    item_name varchar(255) NOT NULL,
                    reason varchar(512) NOT NULL DEFAULT '',
                    cost numeric NOT NULL DEFAULT 0.00,
                    created_at datetime NOT NULL
                )
                ''')

        if 'payments_stocklog' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_stocklog (
                    id bigserial PRIMARY KEY,
                    item_id bigint NOT NULL REFERENCES payments_menuitem(id) DEFERRABLE INITIALLY DEFERRED,
                    quantity integer NOT NULL,
                    cost numeric NOT NULL,
                    created_at timestamp with time zone NOT NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_stocklog (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    item_id integer NOT NULL,
                    quantity integer NOT NULL,
                    cost numeric NOT NULL,
                    created_at datetime NOT NULL
                )
                ''')


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0025_ensure_pos_tables_exist'),
    ]

    operations = [
        migrations.RunPython(_ensure_missing_payments_tables_exist, reverse_code=migrations.RunPython.noop),
    ]
