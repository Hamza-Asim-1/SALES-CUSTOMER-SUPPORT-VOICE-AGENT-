FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt lives inside the app/ sub-directory
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The uvicorn entry point is main:app inside the app/ sub-directory
WORKDIR /app/app

EXPOSE 6000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "6000"]
