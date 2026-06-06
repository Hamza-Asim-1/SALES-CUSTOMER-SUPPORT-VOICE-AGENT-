import os
import ssl

from celery import Celery

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=redis_url,
    backend=redis_url,
    include=["src.worker.tasks"],
)

conf = {
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
}

if redis_url.startswith("rediss://"):
    conf["broker_use_ssl"] = {"ssl_cert_reqs": ssl.CERT_NONE}
    conf["redis_backend_use_ssl"] = {"ssl_cert_reqs": ssl.CERT_NONE}

celery_app.conf.update(conf)
