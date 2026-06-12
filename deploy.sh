#!/bin/bash
# Jivdani Vegetable Suppliers App Deploy Script

echo "=== Pulling latest changes from Git ==="
git pull origin main

if [ ! -f .env ]; then
  echo "WARNING: .env file not found! Copying .env.example to .env..."
  cp .env.example .env
  echo "Please edit the .env file with your production values and run this script again."
  exit 1
fi

echo "=== Restarting Docker Compose containers with build ==="
docker-compose down
docker-compose up -d --build

echo "=== Checking container statuses ==="
docker-compose ps

echo "=== Checking backend logs for seeding ==="
docker-compose logs backend | grep -E "Seeded admin user|Seeded default vegetables"
