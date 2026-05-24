# AGENTS.md — Payment Agent Benchmark

Benchmark harness (Bun + TypeScript) that runs a LangGraph multi-agent payment assistant against dataset rows and scores routing, tool use, and world-state mutations. Applies to the entire repo.

See [README.md](README.md) for human-oriented overview. Domain terms: [CONTEXT.md](CONTEXT.md).

## Setup

```bash
bun install
cp .env.example .env   # edit LEMONADE_MODEL, never commit .env
```

Requires a local OpenAI-compatible server (Lemonade default: `http://localhost:13305/v1`).

## Commands

```bash
bun run bench --out runs/<Model-Name-GGUF>              # full dataset
bun run bench --row <row-id> --out runs/debug           # single row
bun run bench --out runs/<model> --save-comparison      # persist to benchmarks/
bun run dashboard                                       # regenerate dashboard.html
bun test                                                # all tests
bun run typecheck
bun run check                                           # biome lint
bun run format                                          # biome --write
```

## Architecture (where to edit what)

| Area | Path | Notes |
|------|------|-------|
| Dataset rows | `dataset/v1/*.ts` | One file per row; register in `dataset/v1/index.ts` |
| Row helpers | `dataset/v1/_helpers.ts` | `row()`, `eq()`, `regex()`, `cloneWorld()` |
| Agent graph | `src/agents/assistant.ts` | Wires supervisor + three workers |
| Supervisor | `src/agents/build-supervisor.ts` | LangGraph handoff topology |
| Workers | `src/agents/*-worker.ts` | ReAct agents with domain tools |
| Tools | `src/domain/*-tools.ts` | Mutate/read `WorldStore` |
| Scoring | `src/harness/score.ts` | Five axes; do not grade response text |
| Run loop | `src/harness/run.ts` | Streams graph, writes trace JSON |
| LLM client | `src/llm/client.ts` | Reads `LEMONADE_*` env vars |
| Prompts | `src/prompts/v1.ts` | Version with `PROMPTS_VERSION` |
| Dashboard | `src/dashboard/build.ts` | Embeds `runs/` data into `dashboard.html` |

## Domain vocabulary (use consistently)

- **Assistant** — client-facing supervisor (not "supervisor" in docs/comments aimed at users)
- **Worker** — support, risk, or payments sub-agent
- **Client** — the harness, not a human user
- **Query** — raw user string from dataset
- **Row** — one benchmark scenario (not "test case")
- **World State** — seeded payments universe per row

Workers: `support` (read), `risk` (assess/block), `payments` (charge/refund).

## Adding a dataset row

1. Create `dataset/v1/<id>.ts` using `row()` from `_helpers.ts`.
2. Set `expected.workers` (ordered), `expected.tool_calls`, optional `final_world_state`.
3. Use `ignore_routing: true` when routing is not the point (e.g. hallucination trap).
4. Import and append to `rows` in `dataset/v1/index.ts`.
5. Add/adjust tests in `dataset/v1/dataset.test.ts` if invariants apply globally.

Arg matchers: `{ kind: "eq", value }`, `{ kind: "regex", pattern }`, `{ kind: "approx", value, tolerance }`, `{ kind: "any" }`.

## Scoring rules

- **Routing**: consecutive duplicate workers collapsed before compare.
- **Tool selection**: every expected `(worker, tool)` must appear at least once.
- **Tool args**: matchers per expected call; failed tool results (`ok: false`) don't count as matches unless appropriate.
- **World state**: partial match on `final_world_state` seed fields only.
- **Overall pass**: all five axes pass.

Do not add LLM-as-judge scoring without a new ADR in `docs/adr/`.

## Conventions

- TypeScript strict mode; `.ts` imports use `.ts` extension.
- Biome for lint/format (`biome.json`).
- Tests colocated as `*.test.ts` next to source.
- Prompt/dataset versions tracked in traces (`prompts_version`, `dataset_version`).
- Run output goes to `runs/` (gitignored). Persisted snapshots go to `benchmarks/` via `--save-comparison`.

## Off limits

- **Never commit `.env`** — only `.env.example`.
- Do not commit `runs/` trace artifacts (large, machine-specific).
- Do not change scoring semantics without updating tests in `src/harness/score.test.ts`.
- Do not steer prompts toward specific `reason` strings on refunds unless the row's matcher requires it (see CONTEXT.md fairness notes).

## Common mistakes

```typescript
// ❌ Grading assistant response text
if (response.includes("refunded")) { ... }

// ✅ Grade tool calls and world state (existing axes)
scoreRun({ row, route, toolCalls, finalWorldState, completionFailure })
```

```typescript
// ❌ Naming a row file without registering it
// (orphan file — not run by bench)

// ✅ Export from dataset/v1/index.ts rows array
```

```bash
# ❌ Expecting dashboard to read benchmarks/
# Dashboard scans runs/ for *GGUF* directories with summary.json

# ✅ Run bench with --out runs/MyModel-GGUF, then bun run dashboard
```
