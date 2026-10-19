# Stage 1: Build virtualenv with dependencies
FROM python:3.12-slim AS builder

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast package management
RUN pip install --no-cache-dir uv

# Copy dependency specifications first to leverage Docker layer caching
COPY pyproject.toml uv.lock README.md ./

# Install dependencies into /app/.venv
RUN uv sync --no-dev --frozen --no-install-project

# Stage 2: Minimal runtime image
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=4030 \
    PATH="/app/.venv/bin:$PATH"

# Install only minimal runtime shared libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application source code and migrations
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY init_db.py ./

EXPOSE 4030

# Run the app from the virtual environment
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4030"]
