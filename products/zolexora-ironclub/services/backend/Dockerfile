# Build context: repo root (docker build -f products/zolexora-ironclub/services/backend/Dockerfile .)
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY products/zolexora-ironclub/services/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY products/zolexora-ironclub/services/backend/ .

EXPOSE 4060

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:4060/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4060"]
