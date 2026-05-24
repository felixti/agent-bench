# Payment Agent Benchmark Handoff

Use this handoff to start implementation in a fresh session.

## Start Here

Read these files in order:

1. `CONTEXT.md` - glossary and domain language.
2. `docs/adr/0001-workers-carved-by-concern-surface.md`
3. `docs/adr/0002-createsupervisor-with-custom-state.md`
4. `docs/adr/0003-grade-routing-and-tools-not-response-text.md`
5. `docs/superpowers/plans/2026-05-23-payment-agent-benchmark.md` - implementation plan.

Then execute the plan task-by-task from Task 1.

## Current State

This is a greenfield benchmark workspace. Documentation has been created, but no package scaffold or source code has been implemented yet.

Existing files:

- `CONTEXT.md`
- `docs/adr/0001-workers-carved-by-concern-surface.md`
- `docs/adr/0002-createsupervisor-with-custom-state.md`
- `docs/adr/0003-grade-routing-and-tools-not-response-text.md`
- `docs/superpowers/plans/2026-05-23-payment-agent-benchmark.md`
- `docs/superpowers/plans/2026-05-23-payment-agent-benchmark-handoff.md`

## Goal

Build a Bun + TypeScript benchmark harness for a hierarchical payment multi-agent system using LangGraphJS and a local Lemonade OpenAI-compatible endpoint.

The benchmark should run single-turn Rows through:

Client Query -> Assistant (`createSupervisor`) -> one or more Workers (`createReactAgent`) -> Assistant Response

Workers:

- `payments_worker`: mutating tools, `charge` and `refund`.
- `risk_worker`: risk tools, `assess_risk` and `block_card`.
- `support_worker`: read-only tools, `get_payment_status` and `list_payments`.

## Key Decisions Already Made

- This is a benchmark, not a production payment system.
- LLM endpoint: `http://localhost:13305/v1`.
- Target model: `Qwen3.5-9B-GGUF`.
- Use OpenAI-compatible chat completions through `@langchain/openai`.
- Use `@langchain/langgraph-supervisor` and `createSupervisor`; do not hand-roll routing with `Command`.
- Workers are full ReAct agents, not single-shot wrappers.
- Dataset Rows are TypeScript modules under `dataset/v1/`.
- Each Row has its own isolated in-memory `WorldStore`.
- Risk scoring is deterministic and computed from the seeded payment.
- Risk block threshold is `0.7` and belongs in the Risk worker prompt.
- Prompts are operational, no few-shot examples, frozen as `prompts_version: "v1"`.
- Score axes are `routing`, `tool_selection`, `tool_args`, `world_state`, and `completion`.
- Response text is not graded in v1.
- Rows are single-turn and run sequentially.

## Implementation Plan

Follow `docs/superpowers/plans/2026-05-23-payment-agent-benchmark.md`.

Recommended execution mode: subagent-driven development, one fresh worker per task, with review between tasks.

If working inline instead, complete one task at a time and run that task's verification commands before moving on.

## First Task To Execute

Start with Task 1: Project Scaffold.

Create:

- `package.json`
- `tsconfig.json`
- `biome.json`
- `.gitignore`

Then run:

```bash
bun install
bun run check
bun run typecheck
bun test
```

Expected: dependencies install; checks pass or only surface expected "no source files / zero tests" style output.

## Important Notes For The Next Session

- The workspace may not currently be a git repository. If commits are desired and git is not initialized, run `git init` before the first commit.
- Do not implement extra production payment behavior; keep the system benchmark-focused.
- Keep tools deterministic: no real payment processors, no `Date.now()`, no random IDs.
- Use `runs/` for generated benchmark artefacts and keep it gitignored.
- If LangGraphJS 1.3.0 has minor API drift, adjust only the local call sites while preserving the public architecture and trace schema from the plan.

## Suggested Opening Prompt For A New Session

```text
We are in /var/home/felix/github/local-llm/lemonade/agent-bench.

Please implement the payment agent benchmark from:
docs/superpowers/plans/2026-05-23-payment-agent-benchmark.md

First read:
- CONTEXT.md
- docs/adr/0001-workers-carved-by-concern-surface.md
- docs/adr/0002-createsupervisor-with-custom-state.md
- docs/adr/0003-grade-routing-and-tools-not-response-text.md
- docs/superpowers/plans/2026-05-23-payment-agent-benchmark-handoff.md

Then start with Task 1 and proceed task-by-task. Use Bun, TypeScript strict mode, Biome, bun:test, LangGraphJS createSupervisor, and the local OpenAI-compatible Lemonade endpoint at http://localhost:13305/v1 with model Qwen3.5-9B-GGUF.
```
