#!/bin/bash
set -euo pipefail
exec > /var/log/user-data.log 2>&1

echo ">>> Starting FreshBooks MCP Server bootstrap..."

# ── System packages ──────────────────────────────────────────────────────────
dnf update -y
dnf install -y git jq

# ── Node.js 22 ───────────────────────────────────────────────────────────────
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs

# ── PM2 ──────────────────────────────────────────────────────────────────────
npm install -g pm2

# ── CloudWatch Agent ─────────────────────────────────────────────────────────
dnf install -y amazon-cloudwatch-agent

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'CWCONFIG'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/srv/freshbooks-mcp/logs/out.log",
            "log_group_name": "/freshbooks-mcp-server/app",
            "log_stream_name": "{instance_id}/out",
            "retention_in_days": 14
          },
          {
            "file_path": "/srv/freshbooks-mcp/logs/error.log",
            "log_group_name": "/freshbooks-mcp-server/app",
            "log_stream_name": "{instance_id}/error",
            "retention_in_days": 14
          },
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "/freshbooks-mcp-server/app",
            "log_stream_name": "{instance_id}/user-data",
            "retention_in_days": 14
          }
        ]
      }
    }
  }
}
CWCONFIG

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# ── Clone & build the app ────────────────────────────────────────────────────
APP_DIR="/srv/freshbooks-mcp"

git clone --branch "${BRANCH}" --single-branch https://github.com/bitovi/freshbooks-mcp-server.git "$$APP_DIR"
cd "$$APP_DIR"
npm ci
npm run build
mkdir -p logs

# ── Pull secrets from Secrets Manager → .env ─────────────────────────────────
REGION=$$(ec2-metadata --availability-zone | awk '{print $$2}' | sed 's/[a-z]$$//')

aws secretsmanager get-secret-value \
  --secret-id "${SECRET_NAME}" \
  --region "$$REGION" \
  --query 'SecretString' \
  --output text | jq -r 'to_entries[] | "\(.key)=\(.value)"' > "$$APP_DIR/.env"

chmod 600 "$$APP_DIR/.env"
echo ">>> .env written"

# ── Session storage directory ────────────────────────────────────────────────
mkdir -p /home/ec2-user/.freshbooks-mcp
chown ec2-user:ec2-user /home/ec2-user/.freshbooks-mcp

# ── Start with PM2 ──────────────────────────────────────────────────────────
cd "$$APP_DIR"
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

echo ">>> FreshBooks MCP Server bootstrap complete!"
