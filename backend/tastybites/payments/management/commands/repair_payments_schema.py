from django.core.management.base import BaseCommand
from django.db import connection

from payments.views import _ensure_required_tables, _ensure_required_columns, _payments_schema_ready


class Command(BaseCommand):
    help = 'Attempt to repair payments schema and print diagnostic information.'

    def handle(self, *args, **options):
        self.stdout.write('Starting payments schema repair...')
        try:
            self.stdout.write('Ensuring tables...')
            tables_ok = _ensure_required_tables()
            self.stdout.write(f'tables_ok: {tables_ok}')

            self.stdout.write('Ensuring columns...')
            cols_ok = _ensure_required_columns()
            self.stdout.write(f'columns_ok: {cols_ok}')

            ready = _payments_schema_ready()
            self.stdout.write(f'schema_ready: {ready}')

            # Print current tables and key table columns
            with connection.cursor() as cursor:
                tables = connection.introspection.table_names(cursor)
                self.stdout.write('Existing tables: ' + ','.join(sorted(tables)))
                if 'payments_transaction' in tables:
                    try:
                        cols = [getattr(c, 'name', c[0]) for c in connection.introspection.get_table_description(cursor, 'payments_transaction')]
                        self.stdout.write('payments_transaction columns: ' + ','.join(cols))
                    except Exception as e:
                        self.stdout.write('Could not introspect payments_transaction: ' + str(e))

        except Exception as exc:
            self.stderr.write('Schema repair failed: ' + str(exc))
            raise
