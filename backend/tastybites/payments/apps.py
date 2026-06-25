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

        # Start a background thread to periodically rebuild the local knowledge index.
        # Runs every 10 minutes. Daemon thread so it won't block shutdown.
        logger = logging.getLogger(__name__)

        # If the DB tables for the payments app aren't present yet (migrations pending),
        # skip starting the background index worker to avoid startup-time errors.
        try:
            from django.db import connection, utils as db_utils
            with connection.cursor() as cur:
                try:
                    cur.execute('SELECT 1 FROM payments_menuitem LIMIT 1')
                except db_utils.ProgrammingError:
                    logger.info('payments_menuitem table not present yet; skipping index worker startup')
                    return
        except Exception:
            # If DB is not reachable or other errors occur, avoid starting the worker.
            logger.exception('DB check failed; skipping index worker startup')
            return

        def _index_worker():
            try:
                from . import views
            except Exception as e:
                logger.exception('Failed to import views for index worker: %s', e)
                return
            while True:
                try:
                    logger.info('Periodic index rebuild: starting')
                    views._build_search_index()
                    logger.info('Periodic index rebuild: completed')
                except Exception:
                    logger.exception('Periodic index rebuild failed')
                time.sleep(60 * 10)

        t = threading.Thread(target=_index_worker, daemon=True, name='payments-index-worker')
        t.start()
