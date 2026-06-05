import os
from celery import Celery

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=redis_url,     # Redis as message broker
    backend=redis_url,    # Redis as result backend
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)

