# ── EC2 Instance ─────────────────────────────────────────────────────────────

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  vpc_security_group_ids = [aws_security_group.ec2.id]

  # Place in the first default subnet
  subnet_id                   = data.aws_subnets.default.ids[0]
  associate_public_ip_address = true

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user_data.sh", {
    BRANCH      = var.github_branch
    SECRET_NAME = var.secrets_manager_name
  })

  user_data_replace_on_change = false

  tags = {
    Name = "freshbooks-mcp-server"
  }

  # Wait for user_data to complete before marking as created
  lifecycle {
    create_before_destroy = true
  }
}
