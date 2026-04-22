#!/bin/bash
# Minimal bootloader — installs system prerequisites only.
# Application code is pushed via S3 by the GitHub Actions pipeline.
set -euo pipefail
exec > /var/log/user-data.log 2>&1

echo ">>> Starting system bootstrap..."

# ── System packages ──────────────────────────────────────────────────────────
dnf update -y
dnf install -y jq

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

# ── Prepare app directory ────────────────────────────────────────────────────
mkdir -p /srv/freshbooks-mcp/logs
mkdir -p /home/ec2-user/.freshbooks-mcp
chown ec2-user:ec2-user /home/ec2-user/.freshbooks-mcp

# ── Signal ready ─────────────────────────────────────────────────────────────
touch /var/lib/bootstrap-complete
echo ">>> System bootstrap complete — ready for application deployment"
