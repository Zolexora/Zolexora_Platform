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
REPO_ROOT="$(cd "$APPSUITE_DIR/../.." && pwd)"

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

# 2. Configure Production .env
ENV_FILE="$APPSUITE_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "📝 Generating production .env file..."
  cp "$APPSUITE_DIR/.env.example" "$ENV_FILE"

  # Generate secure random password
  SECURE_PASS=$(openssl rand -hex 16)
  sed -i "s/replace_with_strong_random_db_password/$SECURE_PASS/g" "$ENV_FILE"
  sed -i "s/APPSUITE_PORT=3070/APPSUITE_PORT=80/g" "$ENV_FILE"
  sed -i "s/APPSUITE_SSL_PORT=3443/APPSUITE_SSL_PORT=443/g" "$ENV_FILE"

  echo "🔐 Generated strong PostgreSQL password and bound Nginx to 80/443."
else
  echo "ℹ️  Existing .env found at $ENV_FILE, skipping overwrite."
fi

# 3. Pull Prebuilt Production Images from GHCR
echo "📥 Pulling latest prebuilt images from GHCR..."
docker compose -f "$APPSUITE_DIR/compose.yaml" --env-file "$ENV_FILE" pull --ignore-pull-failures || true

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
ExecStart=/usr/bin/docker compose -f $APPSUITE_DIR/compose.yaml --env-file $ENV_FILE up -d
ExecStop=/usr/bin/docker compose -f $APPSUITE_DIR/compose.yaml --env-file $ENV_FILE down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

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
