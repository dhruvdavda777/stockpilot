terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.60"
    }
  }

  # Remote state (recommended for teams/CI). Create the bucket once, then uncomment:
  # backend "s3" {
  #   bucket       = "stockpilot-tfstate-<account-id>"
  #   key          = "stockpilot/terraform.tfstate"
  #   region       = "ap-south-1"
  #   encrypt      = true
  #   use_lockfile = true   # native S3 state locking (Terraform >= 1.10), no DynamoDB needed
  # }
}
