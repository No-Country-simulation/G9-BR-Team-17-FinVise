FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODELS_DIR=/app/models \
    TRANSACTION_MODEL_PATH=/app/models/transaction-classifier \
    PROFILE_MODEL_PATH=/app/models/profile-classifier \
    TRANSACTION_MODEL_VERSION=1.1.0-bootstrap.1 \
    PROFILE_MODEL_VERSION=1.0.0-bootstrap.1 \
    REQUIRE_ACTIVE_MODELS=true

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml requirements.lock ./
RUN pip install -r requirements.lock

COPY app ./app
COPY training ./training
COPY evaluation ./evaluation
COPY data/samples ./data/samples
COPY tests ./tests

RUN pip install --no-deps -e . && \
    AI_SERVICE_TOKEN=build-time-model-provision-token-000000000000 \
    python -m training.provision_models \
      --source-dir /app/data/samples \
      --output-dir /app/models

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
