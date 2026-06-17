#!/usr/bin/env bash
# Run this ONCE on your VPS as root to set up the deployment environment.
# Usage:  bash vps_setup.sh
# VPS IP: 45.196.196.114
# Domain: app.mmpf.in
set -euo pipefail

DOMAIN="app.mmpf.in"
VPS_IP="45.196.196.114"
APP_DIR="/opt/jvsapp"
REPO_URL="https://github.com/shubhamshirve/JVSapp.git"

echo "=== 1. Installing Docker & Docker Compose plugin ==="
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git ufw
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
apt-get install -y docker-compose-plugin

echo "=== 2. Enabling Docker BuildKit (faster image builds) ==="
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "features": { "buildkit": true },
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
EOF
systemctl restart docker

echo "=== 3. Opening firewall ports ==="
ufw allow 22/tcp   || true
ufw allow 80/tcp   || true
ufw allow 443/tcp  || true
ufw --force enable || true

echo "=== 4. Cloning repository ==="
mkdir -p "$APP_DIR"
cd "$APP_DIR"
if [ -d ".git" ]; then
  echo "Repo already cloned — pulling latest."
  git pull origin main
else
  git clone "$REPO_URL" .
fi

echo "=== 5. Creating .env file ==="
if [ ! -f .env ]; then
  cp .env.example .env
  # Auto-fill safe defaults
  sed -i "s|CHANGE_ME_generate_with_openssl_rand_-hex_32|$(openssl rand -hex 32)|" .env
  echo ""
  echo "===================================================="
  echo " .env created from .env.example."
  echo " IMPORTANT: Edit /opt/jvsapp/.env to set:"
  echo "   ADMIN_PASSWORD  — a strong password"
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
echo " To build & start the app:"
echo "   cd $APP_DIR"
echo "   docker compose up -d --build"
echo ""
echo " For GitHub Actions CI/CD (zero-downtime deploys):"
echo "   Add secrets VPS_HOST, VPS_USER, SSH_PRIVATE_KEY"
echo "   to your GitHub repo settings."
echo "======================================================"
