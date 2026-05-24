# Payment Agent Benchmark

Benchmark harness for comparing **local GGUF models** on a hierarchical multi-agent payment assistant. The agent receives natural-language queries, routes them through specialized workers (support, risk, payments), calls tools against a simulated world state, and is scored deterministically — no LLM-as-judge.

Designed to run against [Lemonade](https://github.com/lemonade-sdk/lemonade) or any OpenAI-compatible local server at `http://localhost:13305/v1`.

## What it measures

Each **row** in the v1 dataset is an independent scenario with a query, seeded world state, and expected behavior. A row passes only when all five axes pass:

| Axis | What it checks |
|------|----------------|
| **Routing** | Assistant invokes the expected worker sequence (order-sensitive) |
| **Tool selection** | Required tools were called |
| **Tool args** | Arguments match expected matchers (`eq`, `regex`, `approx`, `any`) |
| **World state** | Final payments/cards/customers match expected mutations |
| **Completion** | Run finished without errors or budget exhaustion |

Natural-language responses are **not** graded. See [ADR 0003](docs/adr/0003-grade-routing-and-tools-not-response-text.md).

## Architecture

```
Client (harness)
    │
    ▼
Assistant (supervisor) ──handoff──► Support worker  (read-only: status, list)
    │                               Risk worker     (assess_risk, block_card)
    │                               Payments worker (charge, refund)
    ▼
Response + trace JSON
```

- **LangGraph** supervisor pattern with three ReAct workers
- **WorldStore** simulates customers, cards, and payments per row
- **Traces** capture route, tool calls, mutations, and per-axis scores

Domain vocabulary is defined in [CONTEXT.md](CONTEXT.md).

## Dataset v1 (12 rows)

| Row | Category |
|-----|----------|
| `support-status-001` | Read payment status |
| `support-list-001` | List payments |
| `support-deflect-001` | Support lookup → payments refund |
| `payments-refund-001` | Direct refund |
| `payments-charge-001` | Charge a card |
| `payments-not-found-001` | Refund missing payment (safe failure) |
| `risk-refund-001` | High-risk charge → block + refund |
| `risk-block-only-001` | Block card without refund |
| `risk-low-score-001` | Low risk, no block |
| `support-then-payments-001` | Multi-hop support → refund |
| `hallucination-trap-001` | Vague query, no tools expected |
| `out-of-scope-001` | Out-of-scope request, no routing |

## Quick start

**Prerequisites:** [Bun](https://bun.sh), a Lemonade (or compatible) server with at least one GGUF model loaded.

```bash
# Install dependencies
bun install

# Configure model endpoint (copy template, edit model id)
cp .env.example .env

# Run full benchmark for one model
bun run bench --out runs/Qwen3.5-9B-GGUF

# Run a single row (debug)
bun run bench --row risk-refund-001 --out runs/debug

# Save snapshot to benchmarks/ for long-term comparison
bun run bench --out runs/Qwen3.5-9B-GGUF --save-comparison

# Regenerate comparison dashboard
bun run dashboard
# Open dashboard.html in a browser
```

### CLI flags

| Flag | Description |
|------|-------------|
| `--out <dir>` | Output directory (default: timestamped folder under `runs/`) |
| `--row <id>` | Run one row instead of the full dataset |
| `--dataset v1` | Dataset version (only `v1` supported) |
| `--save-comparison` | Write summary to `benchmarks/models/<model>.json` and update index |

Set `LEMONADE_MODEL`, `LEMONADE_BASE_URL`, and `LEMONADE_API_KEY` in `.env` (see `.env.example`).

## Results layout

```
runs/<model-id>/
├── summary.json          # pass rates, axis breakdown, row results
└── traces/
    └── <row-id>.json     # full trace: route, tools, world state, score

benchmarks/
├── comparison.json       # index of all saved model snapshots
└── models/
    └── <model-id>.json   # persisted benchmark entry (--save-comparison)
```

`runs/` is gitignored (local artifacts). Use `--save-comparison` to persist summaries under `benchmarks/`.

## Dashboard

`bun run dashboard` scans `runs/` for directories whose names contain `GGUF`, loads each `summary.json` and trace scores, and writes a self-contained `dashboard.html`.

The dashboard includes:

- **Summary cards** — model count, best/average pass rate, row count
- **Leaderboard** — sortable by pass rate, duration, or any axis
- **Axis pass rates** — per-model breakdown across routing, tools, args, world state, completion
- **Row pass matrix** — heatmap of pass/fail per row × model with hover tooltips for axis details

Open `dashboard.html` locally after regenerating it following benchmark runs.

## Development

```bash
bun test              # unit tests (dataset, scoring, domain)
bun run typecheck     # TypeScript strict check
bun run check         # Biome lint
bun run format        # Biome auto-fix
```

### Project layout

```
src/
├── agents/       # Assistant supervisor + worker graphs
├── cli.ts        # Benchmark entrypoint
├── dashboard/    # dashboard.html generator
├── domain/       # WorldStore, tool implementations
├── harness/      # run, score, trace, comparison
├── llm/          # Lemonade OpenAI client
└── prompts/      # Assistant prompt (versioned)
dataset/v1/       # Benchmark rows
docs/adr/         # Architecture decision records
```

## License

Not specified — add a license file if you plan to distribute this publicly.
