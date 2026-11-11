#!/bin/bash
set -e

# ==============================================================================
# Zolexora AppSuite — Automated VM Production Setup Script
# Target OS: Ubuntu 22.04 / 24.04 LTS or Debian 11 / 12
# ==============================================================================

echo "=================================================================="
echo "🚀 Zolexora AppSuite Production VM Provisioning"
echo "=================================================================="

# Check root or sudo permissions
if [ "$(id -u)" -ne 0 ]; then
  echo "⚠️  Please run this script with sudo or as root."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APPSUITE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APPSUITE_DIR/../../.." && pwd)"

echo "📂 AppSuite Directory: $APPSUITE_DIR"

# 1. Install Docker & Docker Compose if missing
if ! command -v docker >/dev/null 2>&1; then
  echo "📦 Installing Docker Engine & Docker Compose plugin..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo "✅ Docker installed successfully."
fi

# 2. Secrets come only from Infisical (machine identity); no .env file is written.
: "${INFISICAL_TOKEN:?export INFISICAL_TOKEN (Infisical machine identity) before running}"
export APPSUITE_PORT=80 APPSUITE_SSL_PORT=443 INFISICAL_ENV="${INFISICAL_ENV:-prod}"

docker compose -f "$APPSUITE_DIR/compose.yaml" pull  # images are built only in GitHub CI

# 4. Create Systemd Service for Auto-Restart on Boot
SERVICE_FILE="/etc/systemd/system/zolexora-appsuite.service"
echo "⚙️  Configuring systemd service at $SERVICE_FILE..."

cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Zolexora AppSuite Docker Compose Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APPSUITE_DIR
Environment=APPSUITE_PORT=80 APPSUITE_SSL_PORT=443 INFISICAL_ENV=$INFISICAL_ENV
ExecStart=/bin/bash $REPO_ROOT/scripts/setup/with-infisical.sh $APPSUITE_DIR /usr/bin/docker compose -f $APPSUITE_DIR/compose.yaml up -d
ExecStop=/usr/bin/docker compose -f $APPSUITE_DIR/compose.yaml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Only the Infisical machine-identity token is stored on disk (root-only); app secrets are fetched at start.
mkdir -p "$SERVICE_FILE.d"
printf '[Service]\nEnvironment=INFISICAL_TOKEN=%s\n' "$INFISICAL_TOKEN" > "$SERVICE_FILE.d/infisical.conf"
chmod 600 "$SERVICE_FILE.d/infisical.conf"

systemctl daemon-reload
systemctl enable zolexora-appsuite.service
echo "✅ systemd service enabled."

# 5. Launch the Stack
echo "🚀 Booting Zolexora AppSuite stack..."
systemctl start zolexora-appsuite.service

# 6. Verify Health
echo "⏳ Waiting 10s for services to stabilize..."
sleep 10

if curl -s http://127.0.0.1:80/healthz | grep -q "healthy"; then
  echo "✅ Nginx Gateway is HEALTHY."
else
  echo "⚠️  Nginx Gateway healthcheck failed. Check 'docker compose -f $APPSUITE_DIR/compose.yaml logs'."
fi

echo "=================================================================="
echo "🎉 Zolexora AppSuite is LIVE on this VM!"
echo "   - Gateway Status:   systemctl status zolexora-appsuite"
echo "   - View Logs:        docker compose -f $APPSUITE_DIR/compose.yaml logs -f"
echo "   - HTTP Port:        80"
echo "   - HTTPS Port:       443"
echo "=================================================================="
