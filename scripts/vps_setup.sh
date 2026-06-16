#!/usr/bin/env bash
# Run this ONCE on your VPS as root to set up the deployment environment.
# Usage: bash vps_setup.sh
set -euo pipefail

VPS_IP="45.196.196.114"
APP_DIR="/opt/jvsapp"
REPO_URL="https://github.com/shubhamshirve/JVSapp.git"

echo "=== 1. Installing Docker ==="
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "=== 2. Installing Docker Compose plugin ==="
apt-get install -y docker-compose-plugin

echo "=== 3. Cloning repository ==="
mkdir -p "$APP_DIR"
cd "$APP_DIR"
if [ -d ".git" ]; then
  echo "Repo already cloned — pulling latest."
  git pull origin main
else
  git clone "$REPO_URL" .
fi

echo "=== 4. Creating .env file ==="
cat > .env << EOF
VPS_IP=${VPS_IP}
ADMIN_EMAIL=admin@jivdani.com
ADMIN_PASSWORD=Jivdani@2026
JWT_SECRET=$(openssl rand -hex 32)
EOF
echo ".env created. Change ADMIN_PASSWORD and JWT_SECRET before going live!"

echo "=== 5. Opening firewall port 80 ==="
ufw allow 80/tcp || true
ufw allow 22/tcp || true

echo ""
echo "======================================================"
echo " VPS setup complete!"
echo "======================================================"
echo " Next: docker compose -f docker-compose.prod.yml up --build -d"
echo "======================================================"
