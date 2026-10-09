FROM python:3.14-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    cron \
    supervisor \
    mariadb-client \
    postgresql-client \
    redis-tools \
    wkhtmltopdf \
    build-essential \
    python3-dev \
    libffi-dev \
    libssl-dev \
    gcc \
    pkg-config \
    default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

# Install nodejs & yarn
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g yarn

# Install bench globally
RUN pip install frappe-bench

# Create frappe user and switch
RUN useradd -ms /bin/bash frappe
USER frappe
WORKDIR /home/frappe/frappe-bench

# We will manually construct the bench directory
RUN mkdir -p apps sites config/pids logs \
    && echo "{}" > sites/common_site_config.json \
    && touch sites/apps.txt

# Create Python virtualenv
RUN python -m venv env \
    && ./env/bin/pip install --upgrade pip setuptools wheel

# Copy all local apps into the apps directory
COPY --chown=frappe:frappe backend/ apps/
COPY --chown=frappe:frappe sites/apps.txt sites/apps.txt

# Install all apps in order
RUN ./env/bin/pip install -e apps/frappe \
    && ./env/bin/pip install -e apps/erpnext \
    && ./env/bin/pip install -e apps/payments \
    && ./env/bin/pip install -e apps/zolexora_core \
    && ./env/bin/pip install -e apps/zolexora_branding \
    && ./env/bin/pip install -e apps/zolexora_platform \
    && ./env/bin/pip install -e apps/zolexora_integrations

# Build front-end assets
# Frappe 15/16 uses bench build
# RUN bench build
RUN echo '{\n\
    "db_host": "zolexora-erp-db",\n\
    "db_port": 3306,\n\
    "redis_cache": "redis://zolexora-erp-redis-cache:6379",\n\
    "redis_queue": "redis://zolexora-erp-redis-queue:6379",\n\
    "redis_socketio": "redis://zolexora-erp-redis-queue:6379",\n\
    "serve_default_site": true\n\
}' > sites/common_site_config.json

# Install node dependencies manually because bench expects .git folders for apps which don't exist here
RUN cd apps/frappe && yarn install && cd ../erpnext && yarn install \
    && cd ../.. && bench build
