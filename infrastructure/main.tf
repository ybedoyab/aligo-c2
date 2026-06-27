# ---------------------------------------------------------------------------
# Aligo Mission Ledger C2 — single-VM deployment on Google Compute Engine.
#
# The whole stack already runs as a docker-compose project (blockchain, C2
# server, frontend, nodes, + optional AI agent). Rather than fight Cloud Run's
# statelessness (the Hardhat chain holds state in memory, the nodes are
# long-lived WebSocket clients, and the server speaks WebSockets), we provision
# one VM, install Docker, and run that same compose project via a startup
# script. This keeps the deployed topology identical to local/dev.
# ---------------------------------------------------------------------------

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

locals {
  # Frontend (nginx) is published on 5173, the C2 API/WebSocket on 8000, and
  # the agent (when enabled) on 8100. 8545 (Hardhat RPC) stays internal to the
  # compose network and is intentionally not exposed.
  app_ports = var.enable_agent ? ["5173", "8000", "8100"] : ["5173", "8000"]

  startup_script = templatefile("${path.module}/startup.sh.tftpl", {
    repo_url               = var.repo_url
    repo_branch            = var.repo_branch
    external_ip            = google_compute_address.this.address
    node_shared_token      = var.node_shared_token
    blockchain_private_key = var.blockchain_private_key
    enable_agent           = var.enable_agent
    anthropic_api_key      = var.anthropic_api_key
  })
}

# --- Enable required APIs ---------------------------------------------------

resource "google_project_service" "compute" {
  count              = var.enable_apis ? 1 : 0
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

# --- Network ---------------------------------------------------------------

resource "google_compute_network" "this" {
  name                    = "${var.name_prefix}-net"
  auto_create_subnetworks = true

  depends_on = [google_project_service.compute]
}

resource "google_compute_firewall" "ssh" {
  name    = "${var.name_prefix}-allow-ssh"
  network = google_compute_network.this.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = [var.name_prefix]
}

resource "google_compute_firewall" "app" {
  name    = "${var.name_prefix}-allow-app"
  network = google_compute_network.this.name

  allow {
    protocol = "tcp"
    ports    = local.app_ports
  }

  source_ranges = var.app_source_ranges
  target_tags   = [var.name_prefix]
}

# --- Static external IP ----------------------------------------------------
# Reserved so the frontend's baked-in API URL and CORS origin stay valid
# across VM reboots/recreates.

resource "google_compute_address" "this" {
  name   = "${var.name_prefix}-ip"
  region = var.region

  depends_on = [google_project_service.compute]
}

# --- Compute Engine VM -----------------------------------------------------

resource "google_compute_instance" "this" {
  name         = "${var.name_prefix}-vm"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = [var.name_prefix]

  boot_disk {
    initialize_params {
      image = var.boot_disk_image
      size  = var.boot_disk_size_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    network = google_compute_network.this.name
    access_config {
      nat_ip = google_compute_address.this.address
    }
  }

  metadata = {
    startup-script = local.startup_script
  }

  # The startup script pulls and builds the stack; allow Terraform to finish
  # without waiting for it. Track progress via the serial console / log file.
  allow_stopping_for_update = true

  depends_on = [
    google_compute_firewall.app,
    google_compute_firewall.ssh,
  ]
}
