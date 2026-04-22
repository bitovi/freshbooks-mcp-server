---
name: deploy
description: How to manage deployments of the FreshBooks MCP Server to AWS EC2
---

# FreshBooks MCP Server — Deployment Management

## Architecture

```
Client → Route53 (freshbooks-mcp.bitovi-ai.com)
       → ALB (HTTPS:443, ACM cert, 3600s idle timeout)
       → EC2:3000 (Node.js + PM2, Amazon Linux 2023)
```

- **TLS**: Terminated at the ALB via ACM certificate (DNS-validated through Route53)
- **App**: Runs plain HTTP on port 3000 behind the ALB (`HTTPS=false` in app config)
- **Sessions**: Stored on disk at `~/.freshbooks-mcp/sessions.json`
- **Secrets**: Pulled from AWS Secrets Manager (`freshbooks-mcp-server-env`) at deploy time
- **Logs**: Shipped to CloudWatch via the CloudWatch Agent
- **Access**: AWS SSM Session Manager (no SSH keys needed)

## Triggering a Deployment

Push to the `deploy` branch:

```bash
git checkout deploy
git merge main    # or make changes directly
git push origin deploy
```

The GitHub Actions workflow will:
1. Provision/update infrastructure via Terraform
2. Deploy the latest code via SSM Run Command
3. Output a rich job summary with URLs and setup instructions

## Monitoring

### CloudWatch Logs

```bash
# Tail live logs
aws logs tail /freshbooks-mcp-server/app --follow --region us-east-1 \
  --profile 767397775295_AdministratorAccess

# Search for errors
aws logs filter-log-events \
  --log-group-name /freshbooks-mcp-server/app \
  --filter-pattern "ERROR" \
  --region us-east-1 \
  --profile 767397775295_AdministratorAccess
```

### Health Check

```bash
curl https://freshbooks-mcp.bitovi-ai.com/health
# Expected: {"status":"ok","server":"freshbooks-mcp-server"}
```

### PM2 Status (via SSM)

```bash
# Connect to the instance
INSTANCE_ID=$(cd infra && terraform output -raw instance_id)
aws ssm start-session --target $INSTANCE_ID --region us-east-1

# On the instance:
pm2 status
pm2 logs freshbooks-mcp
```

## Connecting via AWS Session Manager

No SSH keys needed. Requires the AWS CLI and the Session Manager plugin.

```bash
# Install the Session Manager plugin (macOS)
brew install --cask session-manager-plugin

# Connect
INSTANCE_ID=$(cd infra && terraform output -raw instance_id)
aws ssm start-session --target $INSTANCE_ID --region us-east-1 \
  --profile 767397775295_AdministratorAccess
```

## Updating Secrets

Secrets are stored in AWS Secrets Manager as JSON:

```bash
# View current secrets
aws secretsmanager get-secret-value \
  --secret-id freshbooks-mcp-server-env \
  --region us-east-1 \
  --profile 767397775295_AdministratorAccess \
  --query SecretString --output text | jq .

# Update a secret value
aws secretsmanager put-secret-value \
  --secret-id freshbooks-mcp-server-env \
  --region us-east-1 \
  --profile 767397775295_AdministratorAccess \
  --secret-string '{"FRESHBOOKS_CLIENT_ID":"...","FRESHBOOKS_CLIENT_SECRET":"...","MODE":"http","HTTPS":"false","SERVER_URL":"https://freshbooks-mcp.bitovi-ai.com"}'
```

After updating secrets, trigger a redeploy to pull the new values:

```bash
git commit --allow-empty -m "redeploy: refresh secrets"
git push origin deploy
```

## Manual Deployment (without CI)

```bash
cd infra

# Using local AWS profile
export AWS_PROFILE=767397775295_AdministratorAccess
export AWS_DEFAULT_REGION=us-east-1

terraform init
terraform plan
terraform apply

# Deploy app code via SSM
INSTANCE_ID=$(terraform output -raw instance_id)
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /srv/freshbooks-mcp && git pull && npm ci && npm run build && pm2 reload ecosystem.config.cjs"]'
```

## Tearing Down

```bash
cd infra
export AWS_PROFILE=767397775295_AdministratorAccess
export AWS_DEFAULT_REGION=us-east-1

terraform destroy
```

This removes: EC2 instance, ALB, ACM certificate, Route53 record, security groups, IAM role, and CloudWatch log group.

The S3 state bucket (`freshbooks-mcp-server-terraform-state`) and Secrets Manager secret are NOT destroyed — they're managed outside Terraform.

## Troubleshooting

### App not responding after deploy
1. Check CloudWatch logs for errors
2. SSM into the instance and run `pm2 status` / `pm2 logs`
3. Verify `.env` exists: `cat /srv/freshbooks-mcp/.env`
4. Check if the app port is listening: `ss -tlnp | grep 3000`

### ALB returning 502/503
1. Target group health check may be failing — check ALB target group in AWS Console
2. App may still be bootstrapping — user_data takes ~3-5 minutes on first launch
3. Check `pm2 logs` for startup errors

### SSE connections dropping
The ALB idle timeout is set to 3600s (1 hour). If SSE connections drop sooner, check:
1. Client-side keepalive settings
2. ALB access logs for timeout indicators

### Certificate issues
The ACM certificate is DNS-validated via Route53. If validation fails:
1. Check Route53 for the CNAME validation record
2. Run `terraform apply` again — it will wait for validation
