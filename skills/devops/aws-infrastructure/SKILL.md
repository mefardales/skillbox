---
name: aws-infrastructure
description: >
  AWS infrastructure patterns for deploying and operating web applications at
  scale. Covers VPC networking, compute (EC2/ECS), databases, storage, CDN,
  load balancing, IAM, DNS, and monitoring. Use this skill when designing or
  reviewing AWS architectures and configurations.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: devops
  tags: aws, cloud, infrastructure, ec2, s3
---

# AWS Infrastructure Patterns

## VPC Design

Use a dedicated VPC per environment. Place load balancers in public subnets, app servers in private subnets, databases in isolated subnets with no internet access. Use a `/16` CIDR with `/24` subnets across 3 AZs for public, private, and database tiers. Use a NAT Gateway per AZ in production; a single NAT Gateway is acceptable in non-production.

## EC2 Best Practices

Use `t3` for burstable, `m6i` for steady compute, `r6i` for memory-intensive workloads. Do not use previous-generation instances for new deployments. Use SSM Session Manager instead of SSH -- it opens no inbound ports.

### Security Groups

Reference other security groups instead of CIDR blocks. Do not open port 22 to `0.0.0.0/0`.

```hcl
resource "aws_security_group" "app" {
  name_prefix = "app-"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

## ECS/Fargate

Use Fargate when you do not want to manage EC2 instances. Separate the execution role (pulls images, writes logs) from the task role (application permissions).

```hcl
resource "aws_ecs_task_definition" "app" {
  family                   = "my-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions    = jsonencode([{
    name         = "app"
    image        = "${aws_ecr_repository.app.repository_url}:latest"
    portMappings = [{ containerPort = 8080, protocol = "tcp" }]
    logConfiguration = { logDriver = "awslogs", options = {
      "awslogs-group" = "/ecs/my-app", "awslogs-region" = "us-east-1"
    }}
  }])
}
```

## RDS Setup

Use Multi-AZ in production. Always enable `storage_encrypted`, `deletion_protection`, and `performance_insights_enabled`. Set `backup_retention_period` to at least 7 days and `max_allocated_storage` for autoscaling.

```hcl
resource "aws_db_instance" "main" {
  identifier           = "myapp-production"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.r6g.large"
  allocated_storage    = 100
  max_allocated_storage = 500
  storage_encrypted    = true
  multi_az             = true
  deletion_protection  = true
  performance_insights_enabled = true
}
```

## S3 for Static Assets and Backups

Block all public access by default. Enable versioning. Use lifecycle rules to transition old versions to Glacier. Use CloudFront OAC for controlled public access.

```hcl
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id
  block_public_acls = true
  block_public_policy = true
  ignore_public_acls = true
  restrict_public_buckets = true
}
```

## CloudFront CDN

Use Origin Access Control (OAC), not legacy OAI. Always set `viewer_protocol_policy` to `redirect-to-https`. Use managed cache policies instead of custom forwarding configurations.

```hcl
resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = ["app.example.com"]
  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "s3-assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }
  default_cache_behavior {
    target_origin_id       = "s3-assets"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }
  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.app.arn
    ssl_support_method  = "sni-only"
  }
}
```

## IAM Roles and Policies

Follow least privilege. Do not use wildcard `*` in the Resource field. Do not attach `AdministratorAccess` to application roles.

```hcl
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "s3-assets-access"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "${aws_s3_bucket.assets.arn}/*"
    }]
  })
}
```

## ALB Load Balancer

Use ALB for HTTP/HTTPS with path-based routing. Use NLB for TCP/UDP or static IPs. Enable `drop_invalid_header_fields` on the ALB. Use a TLS 1.3 security policy on HTTPS listeners.

```hcl
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.app.arn
  default_action { type = "forward", target_group_arn = aws_lb_target_group.app.arn }
}
```

## Route 53 DNS

Use alias records for AWS resources instead of CNAMEs -- they are free and resolve faster. Set `evaluate_target_health = true`.

```hcl
resource "aws_route53_record" "app" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.example.com"
  type    = "A"
  alias {
    name                   = aws_lb.app.dns_name
    zone_id                = aws_lb.app.zone_id
    evaluate_target_health = true
  }
}
```

## CloudWatch Monitoring

Monitor CPU, memory, 5xx error rate, and latency at minimum. Always include `ok_actions` so you get notified when alarms resolve. Send alarms to an SNS topic routing to PagerDuty, Slack, or email.

```hcl
resource "aws_cloudwatch_metric_alarm" "high_5xx" {
  alarm_name          = "myapp-high-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 50
  dimensions          = { LoadBalancer = aws_lb.app.arn_suffix }
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}
```
