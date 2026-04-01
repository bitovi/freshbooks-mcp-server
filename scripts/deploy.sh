#!/bin/bash
# Deploy script — run on the EC2 instance via SSM
# Usage: /srv/freshbooks-mcp/scripts/deploy.sh
set -euo pipefail

APP_DIR="/srv/freshbooks-mcp"
cd "$APP_DIR"

echo ">>> Pulling latest code..."
git fetch origin deploy
git reset --hard origin/deploy

echo ">>> Installing dependencies..."
npm ci

echo ">>> Building..."
npm run build

echo ">>> Refreshing secrets from Secrets Manager..."
REGION=$(ec2-metadata --availability-zone | awk '{print $2}' | sed 's/[a-z]$//')
aws secretsmanager get-secret-value \
  --secret-id freshbooks-mcp-server-env \
  --region "$REGION" \
  --query 'SecretString' \
  --output text | jq -r 'to_entries[] | "\(.key)=\(.value)"' > "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

echo ">>> Restarting PM2..."
pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs
pm2 save

echo ">>> Deploy complete!"
