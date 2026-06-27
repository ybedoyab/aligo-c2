# Infrastructure — Aligo Mission Ledger C2 on Google Cloud (Terraform)

This folder provisions and deploys the whole Aligo C2 stack on **Google Cloud**
using **Terraform**. It is designed for a fast, reliable hackathon demo.

## Approach: one VM running the existing docker-compose stack

The project already runs as a `docker-compose` project (Hardhat chain, FastAPI
server, React frontend, two nodes, and an optional AI agent). That topology does
**not** fit a stateless platform like Cloud Run cleanly:

- the **Hardhat chain** keeps its state (and the deployed contract) in memory,
- the **nodes** are long-lived WebSocket *clients*, not HTTP servers,
- the **server** speaks WebSockets to both the dashboard and the nodes.

So Terraform provisions a single **Compute Engine VM**, installs Docker, and runs
that same compose project via a startup script. The deployed topology is
identical to local/dev — fewer surprises during the demo.

```
                        ┌────────────────────────── GCE VM (Debian 12) ───────────────────────────┐
  Browser ──:5173──────▶│ frontend (nginx)                                                         │
  Browser ──:8000──────▶│ server (FastAPI, REST + WS) ──▶ blockchain (Hardhat :8545, internal)     │
  (optional) ─:8100────▶│ agent (AI orchestrator)     ──▶ server                                    │
                        │ node-1, node-2  ──ws──▶ server                                            │
                        └──────────────────────────────────────────────────────────────────────────┘
```

## What gets created

| Resource | Purpose |
|----------|---------|
| `google_compute_network` | Dedicated VPC (auto subnets) |
| `google_compute_firewall` ×2 | SSH (22) and app ports (5173, 8000, +8100 if agent) |
| `google_compute_address` | Static public IP (keeps the baked-in frontend URL valid) |
| `google_compute_instance` | The VM; a startup script builds and runs the stack |
| `google_project_service` | Enables the Compute Engine API (toggle with `enable_apis`) |

Port **8545** (Hardhat RPC) is intentionally **not** exposed — it stays internal
to the Docker network.

## Prerequisites

1. **A GCP project** with billing enabled.
2. **Terraform** ≥ 1.5 — https://developer.hashicorp.com/terraform/downloads
3. **gcloud CLI**, authenticated for Terraform to use:
   ```bash
   gcloud auth application-default login
   gcloud config set project <YOUR_PROJECT_ID>
   ```
   > In this Claude Code session you can run the login directly by typing
   > `! gcloud auth application-default login` in the prompt.
4. **Push your latest code** to the branch you deploy (`repo_branch`). The VM
   does a fresh `git clone` of `repo_url` — it does **not** upload your local
   working tree.

## Deploy

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
#   edit terraform.tfvars: set project_id (required), tweak the rest

terraform init
terraform plan
terraform apply
```

Terraform finishes in ~1 minute, but the **VM keeps working in the background**
for ~5–15 minutes on first boot (install Docker → clone → build images → deploy
the contract → start everything). Watch it:

```bash
# use the ssh_command from `terraform output`
gcloud compute ssh aligo-c2-vm --zone us-central1-a --project <PROJECT>
sudo tail -f /var/log/aligo-startup.log
# done when /opt/aligo-c2/READY exists
```

When ready, open the URLs from the outputs:

```bash
terraform output
# frontend_url = "http://<IP>:5173"
# api_docs_url = "http://<IP>:8000/docs"
```

## Optional: the AI agent

Off by default (it needs an Anthropic API key). To enable it, in
`terraform.tfvars`:

```hcl
enable_agent      = true
anthropic_api_key = "sk-ant-..."
```

This opens port 8100 and runs the orchestrator. **Note:** the agent backend's
CORS allow-list is currently hard-coded to the dev origins
(`localhost:5173`). To drive it from the cloud dashboard in a browser, add
`http://<IP>:5173` to `allow_origins` in
`agents/orchestrator/app/main.py`. Without that change the agent still runs and
is reachable over its API (e.g. `curl http://<IP>:8100/health`), but the browser
panel will report it unreachable.

## Configuration reference

All variables live in `variables.tf`. The ones you are most likely to set:

| Variable | Default | Notes |
|----------|---------|-------|
| `project_id` | — | **Required** |
| `region` / `zone` | `us-central1` / `us-central1-a` | |
| `repo_url` / `repo_branch` | this repo / `main` | The VM clones this |
| `machine_type` | `e2-standard-2` | Needs ≥ 2 vCPU / 8 GB to build images |
| `node_shared_token` | `change-me-lab-token` | Change it |
| `ssh_source_ranges` | `["0.0.0.0/0"]` | **Restrict to your IP** |
| `app_source_ranges` | `["0.0.0.0/0"]` | Who can reach 5173/8000/8100 |
| `enable_agent` / `anthropic_api_key` | `false` / `""` | Optional AI agent |

## Cost

A single `e2-standard-2` VM + 30 GB disk + a static IP runs roughly **a few US
dollars per day** if left on. **Destroy it when the demo is over.**

## Teardown

```bash
terraform destroy
```

This removes the VM, IP, firewall rules, and network. (The Compute API stays
enabled — harmless.)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Error 403: ... API has not been used` | Set `enable_apis = true` (default) or enable Compute Engine API manually, then re-apply. |
| Stack not up yet | First boot takes 5–15 min. `sudo tail -f /var/log/aligo-startup.log`; wait for `/opt/aligo-c2/READY`. |
| `git clone` fails on the VM | `repo_url` must be reachable from the VM. For a private repo, embed a PAT in the URL or add a deploy key. |
| Dashboard loads but API calls fail | The frontend bakes `http://<IP>:8000` at build time; confirm the static IP didn't change and port 8000 is open (`app_source_ranges`). |
| Ledger shows "local only" | Contract deploy step failed — check the startup log around "Deploying ExecutionLedger". |
| Need to redeploy new code | Push to `repo_branch`, then on the VM: `cd /opt/aligo-c2 && sudo bash -c 'git pull && docker compose -f docker-compose.yml -f infrastructure/docker-compose.cloud.yml up -d --build'`. |

## Security notes (read before exposing publicly)

- This is **lab software**. The node auth is a shared token, not real PKI, and
  the blockchain key is the well-known Hardhat account #0 key.
- Lock down `ssh_source_ranges` and `app_source_ranges` to your own IP.
- Secrets (token, Anthropic key) are passed through VM metadata / the rendered
  `.env`; they are visible to anyone with project access. Do not reuse real
  secrets here. For anything beyond a demo, use Secret Manager.
