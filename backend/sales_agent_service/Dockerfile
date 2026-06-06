FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    graphviz \
    && rm -rf /var/lib/apt/lists/*

COPY src/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

WORKDIR /app/src

EXPOSE 8000

# Imports use `calling_agent.*` and `sales_agent.*` — run from src/ (same as local dev).
# Override CMD in docker-compose to run the Celery worker instead.
CMD ["python", "-m", "calling_agent.main"]
