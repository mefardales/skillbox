---
name: terraform
description: >
  Terraform Infrastructure as Code best practices for provisioning and managing
  cloud resources. Covers project structure, state management, module design,
  variable handling, and CI/CD integration. Use this skill when writing or
  reviewing Terraform configurations across AWS, GCP, or Azure.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: devops
  tags: terraform, iac, infrastructure, cloud, modules
---

# Terraform Best Practices

## Project Structure

Separate reusable modules from environment-specific configurations. Do not use Terraform workspaces to separate environments -- directory separation gives clearer isolation and independent state locks.

```
infra/
  modules/
    vpc/
      main.tf
      variables.tf
      outputs.tf
  environments/
    staging/
      main.tf
      terraform.tfvars
      backend.tf
    production/
      main.tf
      terraform.tfvars
      backend.tf
```

## State Management

Always use a remote backend with state locking. Never store state locally or commit `terraform.tfstate` to version control.

```hcl
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "production/vpc/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

Use a dedicated, versioned bucket. Enable encryption at rest. Restrict access to CI/CD service accounts and a small group of operators.

## Module Design

Write modules that do one thing well. Prefer composition -- combine small modules in the environment layer rather than building monolithic modules with feature flags.

```hcl
module "vpc" {
  source = "../../modules/vpc"
  cidr   = var.vpc_cidr
  azs    = var.availability_zones
}

module "rds" {
  source     = "../../modules/rds"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
}
```

Pin remote module versions exactly. Do not use ranges:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"
}
```

## Variables and tfvars

Define every variable with `description` and `type`. Use `validation` blocks to catch bad input early.

```hcl
variable "instance_type" {
  description = "EC2 instance type for the application server"
  type        = string

  validation {
    condition     = can(regex("^t3\\.", var.instance_type))
    error_message = "Only t3 instance types are allowed."
  }
}
```

Do not set `default` for values that must differ between environments. Never commit `.tfvars` files containing secrets -- use `TF_VAR_` environment variables or a secrets manager data source.

## Resource Naming Conventions

Use `locals` to compute a prefix once and reference it everywhere:

```hcl
locals {
  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_security_group" "app" {
  name   = "${local.name_prefix}-app-sg"
  vpc_id = var.vpc_id
}
```

## Data Sources and Outputs

Use data sources to reference external resources. Do not hardcode AMI IDs, account IDs, or ARNs.

```hcl
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}
```

Export meaningful outputs from every module:

```hcl
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.main.id
}
```

## Importing Existing Infrastructure

Use `import` blocks (Terraform 1.5+) to bring existing resources under management:

```hcl
import {
  to = aws_s3_bucket.assets
  id = "mycompany-assets-bucket"
}
```

Run `terraform plan -generate-config-out=generated.tf` to scaffold the initial configuration, then adjust until the plan shows no changes.

## Plan/Apply Workflow with CI/CD

Run `terraform plan` on every pull request. Apply only after merge. Store the plan file as a CI artifact.

```yaml
- name: Terraform Plan
  run: terraform plan -out=tfplan -input=false
- name: Upload Plan
  uses: actions/upload-artifact@v4
  with:
    name: tfplan
    path: tfplan
```

Use `-input=false` so Terraform never prompts interactively. Set `TF_IN_AUTOMATION=true`. Always run `terraform fmt -check`, `terraform validate`, and `tflint` before planning.
