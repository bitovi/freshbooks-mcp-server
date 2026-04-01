#!/bin/bash
# Idempotent application setup — safe to run multiple times.
# Called by the GitHub Actions pipeline after pushing code via S3.
set -euo pipefail

APP_DIR="/srv/freshbooks-mcp"
cd "$APP_DIR"

echo ">>> Installing dependencies..."
npm ci

echo ">>> Building..."
npm run build

echo ">>> Creating log directory..."
mkdir -p "$APP_DIR/logs"

echo ">>> Pulling secrets from Secrets Manager..."
REGION=$(ec2-metadata --availability-zone | awk '{print $2}' | sed 's/[a-z]$//')
aws secretsmanager get-secret-value \
  --secret-id freshbooks-mcp-server-env \
  --region "$REGION" \
  --query 'SecretString' \
  --output text | jq -r 'to_entries[] | "\(.key)=\(.value)"' > "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
echo ">>> .env written"

echo ">>> Setting up session storage..."
mkdir -p /home/ec2-user/.freshbooks-mcp
chown ec2-user:ec2-user /home/ec2-user/.freshbooks-mcp

echo ">>> Starting/reloading PM2..."
pm2 reload ecosystem.config.cjs 2>/dev/null || pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

echo ">>> Setup complete!"
