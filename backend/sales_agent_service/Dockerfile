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

EXPOSE 8000

# Default: run the Flask voice/demo API (used by the browser /voice-demo and
# optionally SignalWire for outbound calls when fully configured).
# Override CMD in docker-compose to run the Celery worker or FastAPI instead.
CMD ["python", "-m", "src.calling_agent.main"]
