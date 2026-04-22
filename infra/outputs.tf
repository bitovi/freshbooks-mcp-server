output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.app.dns_name
}

output "app_url" {
  description = "Full application URL"
  value       = "https://${var.subdomain}.${var.domain_name}"
}

output "sse_endpoint" {
  description = "SSE endpoint for claude.ai integration"
  value       = "https://${var.subdomain}.${var.domain_name}/sse"
}

output "oauth_callback" {
  description = "OAuth callback URI to add in FreshBooks developer console"
  value       = "https://${var.subdomain}.${var.domain_name}/oauth/callback"
}

output "instance_id" {
  description = "EC2 instance ID (for SSM and deployments)"
  value       = aws_instance.app.id
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.app.name
}
