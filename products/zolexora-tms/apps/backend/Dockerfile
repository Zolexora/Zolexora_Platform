# Stage 1: Build virtualenv with dependencies using pre-compiled uv binary
FROM python:3.12-slim AS builder

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1

# Use prebuilt uv binary - zero apt/pip overhead
COPY --from=ghcr.io/astral-sh/uv:0.4.25 /uv /bin/uv

# Copy dependency specifications first to leverage Docker layer caching
COPY pyproject.toml uv.lock README.md ./

# Install production dependencies into /app/.venv
RUN uv sync --no-dev --frozen --no-install-project

# Stage 2: Minimal runtime image
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=4030 \
    PATH="/app/.venv/bin:$PATH"

# Create non-root app user for container security
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser

# Copy virtual environment from builder
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv

# Copy application source code and migrations
COPY --chown=appuser:appgroup app ./app
COPY --chown=appuser:appgroup alembic ./alembic
COPY --chown=appuser:appgroup alembic.ini ./
COPY --chown=appuser:appgroup init_db.py ./

USER appuser
EXPOSE 4030

# Run the app from the virtual environment
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4030"]
