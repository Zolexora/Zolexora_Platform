FROM frappe/erpnext:version-16

# Keep application assets and custom app code in sync
WORKDIR /home/frappe/frappe-bench

USER frappe

USER root
RUN curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh && \
    bash /tmp/nodesource_setup.sh && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    corepack enable && \
    corepack prepare yarn@1.22.19 --activate && \
    printf '#!/bin/sh\nexec corepack yarn "$@"\n' > /usr/local/bin/yarn && \
    chmod +x /usr/local/bin/yarn && \
    rm -rf /var/lib/apt/lists/* /tmp/nodesource_setup.sh
ARG INSTALL_PAYMENTS=0
COPY ./apps /home/frappe/frappe-bench/apps
RUN mkdir -p /home/frappe/frappe-bench/sites && \
    echo "frappe" > /home/frappe/frappe-bench/sites/apps.txt && \
    echo "erpnext" >> /home/frappe/frappe-bench/sites/apps.txt && \
    if [ "$INSTALL_PAYMENTS" = "1" ] && { [ -f apps/payments/setup.py ] || [ -f apps/payments/pyproject.toml ]; }; then echo "payments" >> /home/frappe/frappe-bench/sites/apps.txt; fi && \
    echo "zolexora_core" >> /home/frappe/frappe-bench/sites/apps.txt && \
    echo "zolexora_branding" >> /home/frappe/frappe-bench/sites/apps.txt && \
    echo "zolexora_platform" >> /home/frappe/frappe-bench/sites/apps.txt && \
    echo "zolexora_integrations" >> /home/frappe/frappe-bench/sites/apps.txt
COPY ./compose /home/frappe/frappe-bench/compose
COPY ./scripts/configure-common-site.sh /usr/local/bin/configure-common-site

ENV PIP_NO_CACHE_DIR=1
USER root
RUN chown -R frappe:frappe /home/frappe/frappe-bench
RUN chmod +x /usr/local/bin/configure-common-site

USER frappe

# Install vendored Payments and Zolexora custom applications in dependency order.
RUN if [ "$INSTALL_PAYMENTS" = "1" ] && { [ -f apps/payments/setup.py ] || [ -f apps/payments/pyproject.toml ]; }; then /home/frappe/frappe-bench/env/bin/pip install -e apps/payments; fi && \
    /home/frappe/frappe-bench/env/bin/pip install -e apps/zolexora_core && \
    /home/frappe/frappe-bench/env/bin/pip install -e apps/zolexora_branding && \
    /home/frappe/frappe-bench/env/bin/pip install -e apps/zolexora_platform && \
    /home/frappe/frappe-bench/env/bin/pip install -e apps/zolexora_integrations

CMD ["bench", "start", "--port", "8000"]
