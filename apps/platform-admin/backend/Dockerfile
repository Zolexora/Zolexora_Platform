# Stage 1: Build & install Python packages
FROM python:3.12-slim AS builder

WORKDIR /app

COPY apps/platform-admin/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Minimal runtime image
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    PATH="/root/.local/bin:$PATH"

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application source code
COPY apps/platform-admin/backend/app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
