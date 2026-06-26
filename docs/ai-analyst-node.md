# AI Analyst Node (Placeholder)

`node_type: ai_analyst` marks a registry entry intended for **future** analytic assistance. **No external AI APIs are connected in this hackathon build.**

## What it is today

- A metadata flag in the Node Registry (`real`, `simulated`, `ai_analyst`)
- Visible badge in Node Detail and the node table
- Documentation of planned capabilities

## What it is not

- Not a command executor — AI cannot run plugins or shells directly
- Not connected to OpenAI, Anthropic, or other cloud APIs
- Not a bypass for node policies

## Planned capabilities (future)

| Capability | Description |
|------------|-------------|
| Summarize mission results | Natural-language rollup of task stdout across nodes |
| Detect anomalies | Flag unusual latency, error spikes, or policy blocks |
| Generate reports | Draft Markdown mission briefs from evidence exports |
| Suggest safe next plugins | Recommend allowlisted plugins based on mission context |

All suggestions would require **operator approval** before dispatch.

## Registering an AI analyst node (lab)

1. Register a normal node or add a registry entry via connect.
2. In **Node Detail**, set **Node type** → `ai_analyst`.
3. Assign a restrictive policy (e.g. `basic_safe`) until analytic plugins exist.

## Demo talking points

> "We reserved an AI analyst node type for post-mission summarization and anomaly hints — always read-only and policy-bound. In this demo it's a placeholder showing where responsible AI assistance fits without giving models a shell."

## Safety alignment

Fits the project's authorized-lab scope: analytics and reporting only, no offensive automation.
