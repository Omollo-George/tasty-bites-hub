from django.db import migrations, connection


def _repair_admin_auth_tables(apps, schema_editor):
    with connection.cursor() as cursor:
        existing_tables = set(connection.introspection.table_names())
        vendor = connection.vendor

        if 'payments_adminuser' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_adminuser (
                    id bigserial PRIMARY KEY,
                    username varchar(150) NOT NULL UNIQUE,
                    password_hash varchar(256) NOT NULL,
                    failed_login_attempts smallint NOT NULL DEFAULT 0,
                    lockout_until timestamp with time zone NULL,
                    created_at timestamp with time zone NOT NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_adminuser (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    username varchar(150) NOT NULL UNIQUE,
                    password_hash varchar(256) NOT NULL,
                    failed_login_attempts smallint NOT NULL DEFAULT 0,
                    lockout_until datetime NULL,
                    created_at datetime NOT NULL
                )
                '''
            )

        if 'payments_adminsessionlog' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_adminsessionlog (
                    id bigserial PRIMARY KEY,
                    user_id bigint NOT NULL REFERENCES payments_adminuser(id) ON DELETE CASCADE,
                    login_time timestamp with time zone NOT NULL DEFAULT now(),
                    logout_time timestamp with time zone NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_adminsessionlog (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    user_id integer NOT NULL REFERENCES payments_adminuser(id) ON DELETE CASCADE,
                    login_time datetime NOT NULL,
                    logout_time datetime NULL
                )
                '''
            )

        if 'payments_admintoken' not in existing_tables:
            cursor.execute(
                '''
                CREATE TABLE payments_admintoken (
                    id bigserial PRIMARY KEY,
                    user_id bigint NOT NULL REFERENCES payments_adminuser(id) ON DELETE CASCADE,
                    token varchar(64) NOT NULL UNIQUE,
                    session_log_id bigint NULL REFERENCES payments_adminsessionlog(id) ON DELETE SET NULL,
                    created_at timestamp with time zone NOT NULL,
                    expires_at timestamp with time zone NULL
                )
                ''' if vendor == 'postgresql' else
                '''
                CREATE TABLE payments_admintoken (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    user_id integer NOT NULL REFERENCES payments_adminuser(id) ON DELETE CASCADE,
                    token varchar(64) NOT NULL UNIQUE,
                    session_log_id integer NULL REFERENCES payments_adminsessionlog(id) ON DELETE SET NULL,
                    created_at datetime NOT NULL,
                    expires_at datetime NULL
                )
                '''
            )


class Migration(migrations.Migration):
    dependencies = [
        ('payments', '0026_ensure_missing_payments_tables_exist'),
    ]

    operations = [
        migrations.RunPython(_repair_admin_auth_tables, reverse_code=migrations.RunPython.noop),
    ]
