#!/usr/bin/env bash
# Run this ONCE on your VPS as root to set up the deployment environment.
# Usage:  bash scripts/vps_setup.sh
# VPS IP: 45.196.196.114
# Domain: app.mmpf.in
set -euo pipefail

DOMAIN="app.mmpf.in"
APP_DIR="/opt/jvsapp"

echo "=== 1. Installing Docker & Docker Compose plugin ==="
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git ufw openssl
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
apt-get install -y docker-compose-plugin

echo "=== 2. Enabling Docker BuildKit (faster image builds) ==="
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DOCKEREOF'
{
  "features": { "buildkit": true },
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
DOCKEREOF
systemctl restart docker

echo "=== 3. Opening firewall ports ==="
ufw allow 22/tcp   || true
ufw allow 80/tcp   || true
ufw allow 443/tcp  || true
ufw --force enable || true

echo "=== 4. Setting up app directory ==="
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# If already a git repo, just pull
if [ -d .git ]; then
  echo "Repo already exists — pulling latest..."
  git pull origin main
fi

echo "=== 5. Creating .env file ==="
if [ ! -f .env ]; then
  # Auto-generate a secure secret
  JWT=$(openssl rand -hex 32)

  cat > .env <<ENVEOF
# =========================================================
# Jivdani Vegetable Suppliers - Production Environment
# =========================================================

# Domain (Caddy fetches TLS cert automatically via Let\'s Encrypt)
SITE_ADDRESS=${DOMAIN}
SITE_URL=https://${DOMAIN}

# Database
DB_NAME=jivdani

# Security (auto-generated - do NOT change after first run)
JWT_SECRET=${JWT}

# Admin account (created on first startup)
ADMIN_EMAIL=admin@jivdani.com
ADMIN_PASSWORD=CHANGE_ME_before_starting
ENVEOF

  echo ""
  echo "===================================================="
  echo " .env created at $APP_DIR/.env"
  echo " ⚠̈  Edit ADMIN_PASSWORD before starting!"
  echo "   nano $APP_DIR/.env"
  echo "===================================================="
else
  echo ".env already exists — skipping creation."
fi

echo ""
echo "======================================================"
echo " VPS setup complete!"
echo "======================================================"
echo " Domain  : https://$DOMAIN"
echo " App dir : $APP_DIR"
echo ""
echo " Next steps:"
echo "   1. Copy your project files into $APP_DIR"
echo "      Example using git:"
echo "        cd $APP_DIR"
echo "        git init && git remote add origin <your-repo-url>"
echo "        git pull origin main"
echo ""
echo "   2. Edit the admin password:"
echo "      nano $APP_DIR/.env"
echo ""
echo "   3. Build and start:"
echo "      cd $APP_DIR && DOCKER_BUILDKIT=1 docker compose up -d --build"
echo ""
echo "   Ensure DNS A record for $DOMAIN points to this server's IP."
echo "======================================================"
