# ── IAM Role for EC2 ──────────────────────────────────────────────────────────
# Grants: SSM Session Manager, Secrets Manager read, CloudWatch Logs

resource "aws_iam_role" "ec2" {
  name = "freshbooks-mcp-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

# SSM Session Manager (for AWS CloudShell / console connect)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# CloudWatch Logs
resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Secrets Manager read access (scoped to our secret)
resource "aws_iam_role_policy" "secrets" {
  name = "freshbooks-mcp-secrets-read"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      Resource = [data.aws_secretsmanager_secret.env.arn]
    }]
  })
}

# S3 read access (to download app tarball pushed by GHA)
resource "aws_iam_role_policy" "s3_deploy" {
  name = "freshbooks-mcp-s3-deploy-read"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject"
      ]
      Resource = ["arn:aws:s3:::freshbooks-mcp-server-terraform-state/deploy/*"]
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "freshbooks-mcp-ec2-profile"
  role = aws_iam_role.ec2.name
}
