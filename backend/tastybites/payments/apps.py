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
        if not os.environ.get('_PAYMENTS_APP_INITIALIZED'):
            logger.info('Payments app initialization - skipping search index worker')
            os.environ['_PAYMENTS_APP_INITIALIZED'] = '1'
            return

        logger.info('Starting search index worker')
