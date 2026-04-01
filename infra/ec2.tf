# ── EC2 Instance ─────────────────────────────────────────────────────────────

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  vpc_security_group_ids = [aws_security_group.ec2.id]

  # Place in a subnet that supports the instance type (us-east-1e lacks t3)
  subnet_id                   = data.aws_subnets.compatible.ids[0]
  associate_public_ip_address = true

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = file("${path.module}/user_data.sh")

  user_data_replace_on_change = true

  tags = {
    Name = "freshbooks-mcp-server"
  }

  # Wait for user_data to complete before marking as created
  lifecycle {
    create_before_destroy = true
  }
}
