import logging
import dramatiq
from dramatiq.brokers.redis import RedisBroker
from app.core.config import settings

logger = logging.getLogger(__name__)

if not settings.REDIS_URL:
    raise RuntimeError("REDIS_URL must be set to run background workers")

redis_broker = RedisBroker(url=settings.REDIS_URL)
dramatiq.set_broker(redis_broker)
