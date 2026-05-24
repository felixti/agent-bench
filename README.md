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

## Reference setup

The published benchmark results were collected on the host below, with inference served by **[Lemonade](https://github.com/lemonade-sdk/lemonade)** — a local LLM server that wraps **llama.cpp** with AMD-specific builds and optimizations (ROCm/Vulkan backends, model manager, OpenAI-compatible API).

### Lemonade (Docker + ROCm)

Lemonade runs in Docker with the ROCm backend and AMD GPU device passthrough. See the [Docker install guide](https://lemonade-server.ai/docs/guide/install/docker/) for details.

```bash
docker run -d \
  --name lemonade-server \
  -p 13305:13305 \
  -v lemonade-cache:/root/.cache/huggingface \
  -v lemonade-llama:/opt/lemonade/llama \
  -v lemonade-recipe:/root/.cache/lemonade \
  -e LEMONADE_LLAMACPP=rocm \
  --device=/dev/kfd \
  --device=/dev/dri \
  ghcr.io/lemonade-sdk/lemonade-server:latest
```

The server exposes an OpenAI-compatible API at `http://localhost:13305/v1`. Download GGUF models via the Lemonade model manager, then point this benchmark at them with `LEMONADE_MODEL` (see [Running the benchmark](#running-the-benchmark)).

Models used in the comparison runs:

- `Gemma-4-26B-A4B-it-GGUF`
- `Gemma-4-E4B-it-GGUF`
- `GLM-4.7-Flash-GGUF`
- `Qwen3.5-4B-MTP-GGUF`
- `Qwen3.5-9B-GGUF`
- `Qwen3.6-35B-A3B-MTP-GGUF`
- `gpt-oss-20b-mxfp4-GGUF`

### Hardware

Captured with [`fastfetch`](https://github.com/fastfetch-cli/fastfetch) on the benchmark host:

```
felix@aurora
OS:     Aurora 44 (Linux 6.19.14-101.fc44.x86_64)
Board:  B860M AORUS ELITE WIFI6E
CPU:    Intel Core Ultra 5 245K (14) @ 5.20 GHz
GPU:    AMD Radeon RX 9060 XT [Discrete]
iGPU:   Intel Graphics @ 1.90 GHz
Memory: 30.81 GiB
Disk:   498.75 GiB (btrfs)
```

Reproduce on your machine:

```bash
fastfetch
```

## Running the benchmark

### Prerequisites

1. **[Bun](https://bun.sh)** installed (`bun --version`).
2. **Lemonade** (or another OpenAI-compatible server) running locally with at least one GGUF model loaded.
   Default API: `http://localhost:13305/v1`
3. The model id you want to test must match what the server exposes (see step 2 below).

### 1. Install dependencies

```bash
bun install
```

### 2. Configure the model

Copy the env template and set the model you want to benchmark:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
LEMONADE_BASE_URL=http://localhost:13305/v1
LEMONADE_MODEL=Qwen3.5-9B-GGUF          # must match a loaded model
LEMONADE_API_KEY=not-needed-for-local-lemonade
```

List available models from your server:

```bash
curl -s http://localhost:13305/v1/models | jq '.data[].id'
```

Bun loads `.env` automatically when you run `bun run bench`. Do not commit `.env` — only `.env.example` is tracked.

### 3. Run the full dataset

Run all 12 rows and write results to a directory named after the model:

```bash
bun run bench --out runs/Qwen3.5-9B-GGUF
```

The harness prints progress as each row runs (`running support-status-001`, …) and ends with a JSON **summary** on stdout. Artifacts are written under `--out`:

```
runs/Qwen3.5-9B-GGUF/
├── summary.json
└── traces/
    ├── support-status-001.json
    ├── support-list-001.json
    └── …
```

Each trace file records the query, worker route, tool calls, world-state mutations, and per-axis score. Inspect a failure with:

```bash
jq '.score' runs/Qwen3.5-9B-GGUF/traces/risk-refund-001.json
```

If you omit `--out`, results go to a timestamped folder under `runs/` (e.g. `runs/2026-05-24T12-00-00.000Z`).

### 4. Benchmark another model

Load a different GGUF model in Lemonade, then either edit `.env` or override the model inline for a one-off run:

```bash
# Fast: override model without editing .env
LEMONADE_MODEL=gpt-oss-20b-mxfp4-GGUF bun run bench --out runs/gpt-oss-20b-mxfp4-GGUF --save-comparison
```

Or update `.env` and run with a matching output path:

```bash
# .env → LEMONADE_MODEL=Gemma-4-E4B-it-GGUF
bun run bench --out runs/Gemma-4-E4B-it-GGUF
```

Repeat for each model you want on the leaderboard. The output directory name should include `GGUF` so the dashboard picks it up.

### 5. Debug a single row

Useful when iterating on prompts or scoring:

```bash
bun run bench --row risk-refund-001 --out runs/debug
```

Only the named row runs. `--save-comparison` requires a full dataset run (omit `--row`).

### 6. Save a comparison snapshot (optional)

After a full run, persist the summary to `benchmarks/` for version-controlled comparison:

```bash
bun run bench --out runs/Qwen3.5-9B-GGUF --save-comparison
```

This writes `benchmarks/models/<model-id>.json` and updates `benchmarks/comparison.json`. Use this when you want to keep results in git; raw traces stay in `runs/` (gitignored).

### 7. View results in the dashboard

Regenerate the report, serve the repo over HTTP, and open the dashboard:

```bash
bun run dashboard
bunx serve .
# open http://localhost:3000/dashboard.html
```

See [Dashboard](#dashboard) for details on `dashboard-data.json` and why a local web server is required.

### CLI reference

| Flag | Description |
|------|-------------|
| `--out <dir>` | Output directory (default: timestamped folder under `runs/`) |
| `--row <id>` | Run one row instead of the full dataset |
| `--dataset v1` | Dataset version (only `v1` supported) |
| `--save-comparison` | Write summary to `benchmarks/models/<model>.json` and update index |

**Typical workflow:** start Lemonade → configure `.env` → `bun run bench --out runs/<Model-GGUF>` → repeat for each model → `bun run dashboard` → `bunx serve .` → open `/dashboard.html`.

## Results layout

```
runs/<model-id>/              # gitignored — local benchmark artifacts
├── summary.json
└── traces/
    └── <row-id>.json

benchmarks/                   # committed snapshots (--save-comparison)
├── comparison.json
└── models/
    └── <model-id>.json

dashboard-data.json           # generated by bun run dashboard; relative paths only
dashboard.html                # fetches ./dashboard-data.json at load time
```

## Dashboard

`bun run dashboard` scans `runs/` for directories whose names contain `GGUF`, reads each `summary.json` and trace scores, and writes two files at the repo root:

| File | Purpose |
|------|---------|
| `dashboard-data.json` | Benchmark payload — all model summaries, row scores, and axis details. Uses relative paths only (`runs_root: "runs"`, `run_dir: "runs/<model>"`). |
| `dashboard.html` | Static UI that loads `./dashboard-data.json` via `fetch` when the page opens. |

**Important:** the dashboard does not embed data inline and does not work reliably via `file://`. Serve the repo root over HTTP:

```bash
bun run dashboard
bunx serve .
# open http://localhost:3000/dashboard.html
```

Re-run `bun run dashboard` after adding or updating model runs under `runs/`. Commit `dashboard-data.json` alongside `dashboard.html` if you want published results to stay in sync on GitHub.

The dashboard shows:

- **Summary cards** — model count, best/average pass rate, row count
- **Leaderboard** — sortable by pass rate, duration, or any axis
- **Axis pass rates** — per-model breakdown across routing, tools, args, world state, completion
- **Row pass matrix** — heatmap of pass/fail per row × model with hover tooltips for axis details

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
├── dashboard/    # dashboard.html + dashboard-data.json generator
├── domain/       # WorldStore, tool implementations
├── harness/      # run, score, trace, comparison
├── llm/          # Lemonade OpenAI client
└── prompts/      # Assistant prompt (versioned)
dataset/v1/       # Benchmark rows
docs/adr/         # Architecture decision records
dashboard.html    # generated UI (serve over HTTP)
dashboard-data.json
```

## License

Not specified — add a license file if you plan to distribute this publicly.
