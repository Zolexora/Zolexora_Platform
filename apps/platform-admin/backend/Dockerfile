# Stage 1: install Python packages into a virtualenv
FROM python:3.12-slim AS builder

RUN python -m venv /opt/venv
COPY apps/platform-admin/backend/requirements.txt /tmp/requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

# Stage 2: minimal runtime image, non-root
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    ADMIN_DATA_DIR=/data \
    INFISICAL_CONFIG=/config/infisical.json \
    PLATFORM_ADMIN_IN_DOCKER=1 \
    PATH="/opt/venv/bin:$PATH"

RUN useradd --system --uid 1001 admin && mkdir /data && chown admin /data

COPY --from=builder /opt/venv /opt/venv
COPY apps/platform-admin/backend/app ./app

USER admin
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
