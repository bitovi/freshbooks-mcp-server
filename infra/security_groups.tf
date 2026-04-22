# ── ALB Security Group ────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "freshbooks-mcp-alb-sg"
  description = "Allow HTTPS inbound to ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP for redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "freshbooks-mcp-alb-sg"
  }
}

# ── EC2 Security Group ───────────────────────────────────────────────────────

resource "aws_security_group" "ec2" {
  name        = "freshbooks-mcp-ec2-sg"
  description = "Allow traffic from ALB only"
  vpc_id      = data.aws_vpc.default.id

  # App port from ALB only
  ingress {
    description     = "App traffic from ALB"
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "freshbooks-mcp-ec2-sg"
  }
}
