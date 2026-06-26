# Mission Report Export

Export a complete mission dossier for jury handoff, post-lab review, or documentation.

## Contents

Reports include:

- Mission metadata (name, description, status, steps)
- Target nodes (ids, alias, policy, status at export time)
- Executed tasks (plugin, args, status, timestamps)
- Results (stdout/stderr summary, exit codes, duration)
- Errors and policy blocks
- Ledger hashes and on-chain verification status per event
- Chronological timeline
- Executive summary (counts, success rate, anchor status)

## Export formats

| Format | Use case |
|--------|----------|
| **JSON** | Machine-readable archive; also saved to `demo/reports/` when `save=true` |
| **Markdown** | Human-readable brief for judges |

## UI

- **Missions** — each mission row has **Export JSON** / **Export MD**
- **Demo** — **Export mission report** buttons (uses first predefined mission)

## API

```
GET /api/missions/{mission_id}/report?format=json|markdown&save=true|false
```

With `save=true` and `format=json`, files are written under `demo/reports/`.

## Demo talking points

> "After a lab exercise we export a mission report — tasks, results, ledger hashes, and verification status in one bundle. JSON for tooling, Markdown for the jury packet."

## Example workflow

1. Run **Lab Health Check** across three nodes.
2. Anchor pending ledger events.
3. **Missions → Export MD** — walk judges through the summary section.
4. **Export JSON** — show chained hashes and per-task evidence references.
