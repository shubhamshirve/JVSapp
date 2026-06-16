#!/usr/bin/env bash
# Run this manually on VPS when you want a deep disk cleanup.
# Safe: never touches named Docker volumes (your MongoDB data is safe).
#
# Usage: bash /opt/jvsapp/scripts/cleanup.sh
set -euo pipefail

echo "========================================"
echo "  Jivdani VPS — Docker Disk Cleanup"
echo "========================================"
echo ""

echo "--- Before cleanup ---"
df -h /
docker system df
echo ""

echo "==> Removing stopped containers..."
docker container prune -f

echo "==> Removing ALL unused images (keeps only running ones)..."
docker image prune -a -f

echo "==> Removing unused build cache..."
docker builder prune -a -f

echo "==> Removing unused networks..."
docker network prune -f

# Logs cleanup — truncate container logs older than 7 days
echo "==> Truncating container log files > 50 MB..."
find /var/lib/docker/containers/ -name "*.log" -size +50M \
  -exec truncate -s 0 {} \; -print 2>/dev/null || true

echo ""
echo "--- After cleanup ---"
df -h /
docker system df
echo ""
echo "========================================"
echo "  Cleanup complete!"
echo "========================================"
