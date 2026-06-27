output "external_ip" {
  description = "Public IP of the C2 VM."
  value       = google_compute_address.this.address
}

output "frontend_url" {
  description = "Operator dashboard (open this in a browser)."
  value       = "http://${google_compute_address.this.address}:5173"
}

output "api_docs_url" {
  description = "C2 server Swagger UI."
  value       = "http://${google_compute_address.this.address}:8000/docs"
}

output "agent_url" {
  description = "AI agent backend (only reachable when enable_agent = true)."
  value       = var.enable_agent ? "http://${google_compute_address.this.address}:8100/health" : "(disabled)"
}

output "ssh_command" {
  description = "Convenience SSH command via gcloud."
  value       = "gcloud compute ssh ${google_compute_instance.this.name} --zone ${var.zone} --project ${var.project_id}"
}

output "startup_log_hint" {
  description = "Where to watch the first-boot build/deploy progress."
  value       = "SSH in, then: sudo tail -f /var/log/aligo-startup.log  (a /opt/aligo-c2/READY marker appears when the stack is up)"
}
