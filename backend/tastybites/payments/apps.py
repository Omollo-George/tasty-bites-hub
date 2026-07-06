from django.apps import AppConfig
from django.conf import settings
import threading
import time
import logging
import os
import sys


class PaymentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'payments'

    def _should_skip_auto_repair(self):
        management_commands = {
            'migrate', 'makemigrations', 'test', 'shell', 'check', 'collectstatic',
            'createsuperuser', 'flush', 'loaddata', 'showmigrations', 'dbshell'
        }
        command = (sys.argv[1] if len(sys.argv) > 1 else '').strip().lower()
        return command in management_commands or os.environ.get('PAYMENTS_SKIP_AUTO_REPAIR') == '1'

    def ready(self):
        logger = logging.getLogger(__name__)

        # Only run the worker in the actual server process, not in the autoreloader parent.
        autoreload_active = os.environ.get('RUN_MAIN') == 'true' or os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
        if self._should_skip_auto_repair():
            logger.info('Payments auto-repair skipped for management command: %s', sys.argv[1:])
            return
        if settings.DEBUG and not autoreload_active:
            return

        # Skip index worker completely on initial app startup - too many DB dependency issues
        # with migration ordering and Nile DB compatibility
        def _start_auto_repair():
            try:
                # Delay slightly to allow DB connections to settle
                time.sleep(2)
                logger.info('Payments auto-repair: starting')
                from . import views as payments_views
                try:
                    payments_views._ensure_required_tables()
                except Exception:
                    logger.exception('Payments auto-repair: ensure tables failed')
                try:
                    payments_views._ensure_required_columns()
                except Exception:
                    logger.exception('Payments auto-repair: ensure columns failed')
                try:
                    ready = payments_views._payments_schema_ready()
                    logger.info('Payments auto-repair: schema_ready=%s', ready)
                except Exception:
                    logger.exception('Payments auto-repair: final schema check failed')
            except Exception:
                logger.exception('Payments auto-repair thread error')

        # Start auto-repair thread once per process
        if not os.environ.get('_PAYMENTS_APP_INITIALIZED'):
            logger.info('Payments app initialization - starting auto-repair and skipping search index worker')
            os.environ['_PAYMENTS_APP_INITIALIZED'] = '1'
            t = threading.Thread(target=_start_auto_repair, name='payments-auto-repair', daemon=True)
            t.start()
            return

        logger.info('Starting search index worker')
