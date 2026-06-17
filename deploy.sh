#!/usr/bin/env bash
# Jivdani Vegetable Suppliers — Quick re-deploy script
# Run on the VPS from /opt/jvsapp after updating code
set -euo pipefail

echo "=== Pulling latest changes ==="
git pull origin main

if [ ! -f .env ]; then
  echo "ERROR: .env file not found!"
  echo "Copy .env.example to .env and fill in your values, then re-run."
  exit 1
fi

echo "=== Building & restarting containers ==="
DOCKER_BUILDKIT=1 docker compose up -d --build --remove-orphans

echo "=== Container status ==="
docker compose ps

echo "=== Backend startup logs ==="
docker compose logs backend | grep -E "Seeded|startup complete|ERROR" | tail -10

echo ""
echo "=== Done! Visit https://$(grep SITE_ADDRESS .env | cut -d= -f2) ==="
