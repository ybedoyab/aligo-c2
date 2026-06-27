# ---------------------------------------------------------------------------
# Input variables for the Aligo Mission Ledger C2 GCP deployment.
# Copy terraform.tfvars.example -> terraform.tfvars and fill in `project_id`.
# ---------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID to deploy into."
  type        = string
}

variable "region" {
  description = "GCP region for the static IP and (default) resources."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for the Compute Engine VM."
  type        = string
  default     = "us-central1-a"
}

variable "enable_apis" {
  description = "Enable the Compute Engine API automatically (handy for fresh projects)."
  type        = bool
  default     = true
}

# --- VM sizing -------------------------------------------------------------

variable "machine_type" {
  description = "Compute Engine machine type. The VM builds all Docker images on boot, so it needs some headroom (>= 2 vCPU / 8 GB recommended)."
  type        = string
  default     = "e2-standard-2"
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in GB."
  type        = number
  default     = 30
}

variable "boot_disk_image" {
  description = "Boot disk image. Debian 12 ships a recent kernel that runs Docker cleanly."
  type        = string
  default     = "debian-cloud/debian-12"
}

# --- Source code -----------------------------------------------------------

variable "repo_url" {
  description = "Git URL the VM clones to build the stack. Must be reachable from the VM (public, or supply a PAT/deploy key out of band)."
  type        = string
  default     = "https://github.com/ybedoyab/aligo-c2.git"
}

variable "repo_branch" {
  description = "Branch (or tag) to deploy. Push your latest code to this branch before applying."
  type        = string
  default     = "main"
}

# --- Application config -----------------------------------------------------

variable "node_shared_token" {
  description = "Shared token nodes present to the C2 server on registration (lab auth, not production-grade)."
  type        = string
  default     = "change-me-lab-token"
  sensitive   = true
}

variable "blockchain_private_key" {
  description = "Private key the server uses to sign on-chain ledger transactions. Defaults to the well-known Hardhat account #0 key (LAB ONLY)."
  type        = string
  default     = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  sensitive   = true
}

variable "enable_agent" {
  description = "Also run the AI orchestrator (agent) service. Requires anthropic_api_key. Off by default so the core demo runs without an API key."
  type        = bool
  default     = false
}

variable "anthropic_api_key" {
  description = "Anthropic API key for the AI agent's chat path. Only used when enable_agent = true."
  type        = string
  default     = ""
  sensitive   = true
}

# --- Networking / access ----------------------------------------------------

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to SSH (port 22). Restrict to your IP for safety, e.g. [\"203.0.113.4/32\"]."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "app_source_ranges" {
  description = "CIDR ranges allowed to reach the app ports (frontend 5173, API 8000, agent 8100)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "name_prefix" {
  description = "Prefix applied to all created resource names."
  type        = string
  default     = "aligo-c2"
}
