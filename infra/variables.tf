variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Root domain name (must have a Route53 hosted zone)"
  type        = string
  default     = "bitovi-ai.com"
}

variable "subdomain" {
  description = "Subdomain for the MCP server"
  type        = string
  default     = "freshbooks-mcp"
}

variable "secrets_manager_name" {
  description = "Name of the AWS Secrets Manager secret containing env vars"
  type        = string
  default     = "freshbooks-mcp-server-env"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "app_port" {
  description = "Port the Node.js app listens on"
  type        = number
  default     = 3000
}

variable "github_repo" {
  description = "GitHub repository URL"
  type        = string
  default     = "https://github.com/bitovi/freshbooks-mcp-server.git"
}

variable "github_branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "deploy"
}
