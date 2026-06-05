FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Default: run the FastAPI web server.
# Override CMD in docker-compose to run the Celery worker instead.
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "5000"]
