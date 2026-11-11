# Built only by GitHub CI (zolexora-ims-docker.yml) with the repo root as context.
# ------------------------------------------------------------------------------
# Stage 1: Build & Runtime Base for Zolexora IMS User Backend
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=4050 \
    DATABASE_PATH=/data/ims.db

WORKDIR /app

# Install system dependencies & curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY products/zolexora-ims/services/user-api/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY products/zolexora-ims/services/user-api/ .

# Create a non-root user for container security
# The SQLite database lives in /data: mount a persistent disk or volume there on any host.
RUN useradd -m -u 1001 appuser && mkdir -p /data && chown -R appuser:appuser /app /data
USER appuser

EXPOSE 4050

# Health check against active FastAPI /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f "http://localhost:${PORT}/health" || exit 1

# Listens on $PORT (default 4050) so hosts that assign a port (Render, Fly, …) can run the same image.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
