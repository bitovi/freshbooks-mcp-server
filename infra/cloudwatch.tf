# ── CloudWatch Log Group ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "app" {
  name              = "/freshbooks-mcp-server/app"
  retention_in_days = 14

  tags = {
    Name = "freshbooks-mcp-server-logs"
  }
}
