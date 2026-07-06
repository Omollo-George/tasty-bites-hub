from django.apps import AppConfig
from django.conf import settings
import threading
import time
import logging
import os


class PaymentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'payments'

    def ready(self):
        # Only run the worker in the actual server process, not in the autoreloader parent.
        autoreload_active = os.environ.get('RUN_MAIN') == 'true' or os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
        if settings.DEBUG and not autoreload_active:
            return

        logger = logging.getLogger(__name__)

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
