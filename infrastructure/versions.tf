# Terraform + provider version constraints.
# Pinned to the Google provider v6.x line (current major) for reproducible plans.
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}
