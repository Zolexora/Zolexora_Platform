import logging
import sys
from pythonjsonlogger import jsonlogger
from contextvars import ContextVar

request_id_context = ContextVar("request_id", default="-")

class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_context.get()
        return True

def setup_logging():
    logHandler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s')
    logHandler.setFormatter(formatter)
    
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers = [logHandler]
    root_logger.addFilter(CorrelationIdFilter())
