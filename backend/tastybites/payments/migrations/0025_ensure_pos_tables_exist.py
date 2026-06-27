from django.db import migrations, connection


def _ensure_pos_tables_exist(apps, schema_editor):
    with connection.cursor() as cursor:
        existing_tables = set(connection.introspection.table_names())
        vendor = connection.vendor

        if 'payments_table' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_table (
                    id bigserial PRIMARY KEY,
                    number varchar(32) NOT NULL UNIQUE,
                    name varchar(128) NOT NULL,
                    status varchar(32) NOT NULL,
                    created_at timestamp with time zone NOT NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_table (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    number varchar(32) NOT NULL UNIQUE,
                    name varchar(128) NOT NULL,
                    status varchar(32) NOT NULL,
                    created_at datetime NOT NULL
                )
                ''')

        if 'payments_order' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_order (
                    id bigserial PRIMARY KEY,
                    order_id varchar(64) NOT NULL UNIQUE,
                    phone varchar(32) NOT NULL,
                    status varchar(32) NOT NULL,
                    split_count integer NOT NULL,
                    total_amount decimal NOT NULL,
                    created_at timestamp with time zone NOT NULL,
                    table_id bigint NULL REFERENCES payments_table(id) DEFERRABLE INITIALLY DEFERRED
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_order (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    order_id varchar(64) NOT NULL UNIQUE,
                    phone varchar(32) NOT NULL,
                    status varchar(32) NOT NULL,
                    split_count integer NOT NULL,
                    total_amount decimal NOT NULL,
                    created_at datetime NOT NULL,
                    table_id integer NULL REFERENCES payments_table(id)
                )
                ''')

        if 'payments_orderitem' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_orderitem (
                    id bigserial PRIMARY KEY,
                    name varchar(255) NOT NULL,
                    price decimal NOT NULL,
                    quantity integer NOT NULL,
                    modifiers json NULL,
                    seat_number integer NOT NULL,
                    created_at timestamp with time zone NOT NULL,
                    order_id bigint NOT NULL REFERENCES payments_order(id) DEFERRABLE INITIALLY DEFERRED
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_orderitem (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    name varchar(255) NOT NULL,
                    price decimal NOT NULL,
                    quantity integer NOT NULL,
                    modifiers text NULL,
                    seat_number integer NOT NULL,
                    created_at datetime NOT NULL,
                    order_id integer NOT NULL REFERENCES payments_order(id)
                )
                ''')

        if 'payments_transaction' in existing_tables:
            try:
                description = connection.introspection.get_table_description(cursor, 'payments_transaction')
                existing_columns = {col.name for col in description}
            except Exception:
                existing_columns = set()

            if 'order_id' not in existing_columns:
                if vendor == 'postgresql':
                    cursor.execute(
                        '''
                        ALTER TABLE payments_transaction
                        ADD COLUMN order_id bigint NULL REFERENCES payments_order(id) DEFERRABLE INITIALLY DEFERRED
                        '''
                    )
                else:
                    cursor.execute(
                        'ALTER TABLE payments_transaction ADD COLUMN order_id integer NULL'
                    )


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0024_remove_order_order_type_remove_order_payment_method_and_more'),
    ]

    operations = [
        migrations.RunPython(_ensure_pos_tables_exist, reverse_code=migrations.RunPython.noop),
    ]
