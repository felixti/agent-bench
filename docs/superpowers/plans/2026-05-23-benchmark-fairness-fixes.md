# Benchmark Fairness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove self-inflicted benchmark bugs uncovered by the cross-model dashboard analysis so that pass/fail signal reflects model capability instead of prompt-and-matcher misalignment.

**Architecture:** Edits live in three layers — (1) the V1 dataset rows under `dataset/v1/`, (2) the operational prompts in `src/prompts/v1.ts`, and (3) the LangChain tool schema in `src/domain/payments-tools.ts`. One dashboard rendering change exposes per-axis failures so future regressions are easier to spot. No new files except a single dataset-shape unit test and the regenerated dashboard. Dataset and prompts remain at version `v1` — old `runs/` and `benchmarks/` snapshots are discarded and re-recorded under the same version label.

**Tech Stack:** Bun, TypeScript (strict), Biome, `bun:test`, LangChain core tool schemas (Zod). Local Lemonade endpoint for end-to-end verification.

**Background (read before starting):** `docs/superpowers/plans/2026-05-23-payment-agent-benchmark-handoff.md`, `CONTEXT.md`, and the failure analysis we ran against the GGUF dashboard. The analysis showed five dataset rows failing on all 7 GGUF models (`payments-refund-001`, `payments-not-found-001`, `support-deflect-001`, `support-then-payments-001`, `out-of-scope-001`). Root cause was prompt + schema steering models to emit `reason: "risk"` for every refund, plus dataset assertions that disagreed with safe model behavior. This plan fixes only those known bugs; it does not redesign scoring.

---

## File Map

| File | Action | Responsibility after change |
|---|---|---|
| `src/domain/payments-tools.ts` | modify | Refund schema description no longer steers `reason` content. |
| `src/prompts/v1.ts` | modify | Supervisor gets explicit out-of-scope and lookup-first rules. Payments worker no longer enforces "fraud/suspicious/risk" wording globally — only inside the risk-driven branch. |
| `dataset/v1/payments-refund-001.ts` | modify | `reason` matcher relaxed to `any()`. |
| `dataset/v1/support-deflect-001.ts` | modify | Query reworded to remove the "support" trigger word; `reason` matcher relaxed. |
| `dataset/v1/support-then-payments-001.ts` | modify | (No structural change — verified after prompt update.) Documentation comment added. |
| `dataset/v1/risk-low-score-001.ts` | modify | Query reworded so the fraud trigger vocabulary matches the supervisor prompt. |
| `dataset/v1/payments-not-found-001.ts` | modify | Redesigned to expect `support_worker.get_payment_status` lookup, not a refund call. |
| `dataset/v1/dataset.test.ts` | create | Static assertions that lock in the relaxed matcher shape so a future agent doesn't re-tighten them by accident. |
| `src/dashboard/build.ts` | modify | Heatmap tooltip lists pass/fail per axis (`routing/tool_selection/tool_args/world_state/completion`) for each cell. |
| `runs/` (existing GGUF folders) | delete | Old results were generated under the broken prompts; they are no longer comparable. |
| `benchmarks/comparison.json`, `benchmarks/models/*.json` | delete | Same reason. |
| `CONTEXT.md` | modify | One-paragraph note recording that V1 was revised on 2026-05-23 to fix prompt/matcher steering. |

No new top-level dependencies are added.

---

## Task 1: Lock in expected matcher shape with a regression test

**Files:**
- Create: `dataset/v1/dataset.test.ts`

This test runs against the *current* (broken) dataset. After Tasks 2–6 it must still pass. It pins the contract: only `risk-refund-001` enforces a fraud-keyword regex on `reason`.

- [ ] **Step 1.1: Create the dataset shape test**

```typescript
import { describe, expect, test } from "bun:test";
import { rows } from "./index.ts";

const REFUND_ROWS = [
  "payments-refund-001",
  "payments-not-found-001",
  "support-deflect-001",
  "support-then-payments-001",
];

const RISK_REFUND_ROW = "risk-refund-001";

describe("dataset v1 refund matchers", () => {
  test("non-risk refund rows do not constrain reason wording", () => {
    for (const id of REFUND_ROWS) {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) continue;

      const refundCall = row.expected.tool_calls.find((call) => call.tool === "refund");
      if (!refundCall) continue;

      expect(refundCall.args.reason?.kind).toBe("any");
    }
  });

  test("risk-refund-001 keeps the fraud-keyword regex", () => {
    const row = rows.find((candidate) => candidate.id === RISK_REFUND_ROW);
    expect(row).toBeDefined();
    const refundCall = row?.expected.tool_calls.find((call) => call.tool === "refund");
    expect(refundCall?.args.reason).toEqual({ kind: "regex", pattern: "fraud|suspicious|risk" });
  });
});
```

- [ ] **Step 1.2: Run the test and confirm it fails today**

Run: `bun test dataset/v1/dataset.test.ts`
Expected: FAIL — first test fails because `payments-refund-001` currently uses `regex("refund|requested")` instead of `any()`.

This failing test is the entry contract for Task 2. Do NOT commit yet.

---

## Task 2: Relax `reason` matchers in non-risk refund rows

**Files:**
- Modify: `dataset/v1/payments-refund-001.ts`
- Modify: `dataset/v1/support-deflect-001.ts`

- [ ] **Step 2.1: Replace the `payments-refund-001` body**

Replace the entire file contents with:

```typescript
import { any, approx, cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "payments-refund-001",
  query: "Refund pay_003 in full.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["payments"],
    tool_calls: [
      {
        worker: "payments",
        tool: "refund",
        args: {
          payment_id: eq("pay_003"),
          amount_cents: approx(9999),
          reason: any(),
        },
      },
    ],
    final_world_state: { payments: [{ id: "pay_003", status: "refunded" }] },
  },
});
```

- [ ] **Step 2.2: Replace the `support-deflect-001` body**

Replace the entire file contents with (note: query is also reworded — the word "support" was tripping models into routing to the support worker; we keep the same intent without the trigger word):

```typescript
import { any, approx, cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "support-deflect-001",
  query: "Customer service told me to refund pay_003 for the customer. Please do it.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["payments"],
    tool_calls: [
      {
        worker: "payments",
        tool: "refund",
        args: {
          payment_id: eq("pay_003"),
          amount_cents: approx(9999),
          reason: any(),
        },
      },
    ],
    final_world_state: { payments: [{ id: "pay_003", status: "refunded" }] },
  },
});
```

- [ ] **Step 2.3: Verify the dataset shape test now passes**

Run: `bun test dataset/v1/dataset.test.ts`
Expected: PASS (both tests green).

- [ ] **Step 2.4: Run the full unit test suite**

Run: `bun test`
Expected: PASS — all existing tests still green.

- [ ] **Step 2.5: Commit**

```bash
git add dataset/v1/payments-refund-001.ts dataset/v1/support-deflect-001.ts dataset/v1/dataset.test.ts
git commit -m "test(dataset): pin relaxed reason matchers and apply to refund rows"
```

---

## Task 3: Stop the refund tool schema from steering `reason` wording

**Files:**
- Modify: `src/domain/payments-tools.ts`
- Modify: `src/prompts/v1.ts` (one rule under `PAYMENTS_WORKER_PROMPT`)

The current schema description told every model "After risk review, include fraud, suspicious, or risk." Models generalised the safest token (`"risk"`) to **all** refunds, causing the `regex("refund|requested")` assertion in Task 2's predecessor to fail even when the refund itself succeeded. We move that hint out of the schema and out of the worker prompt's global rules; it now lives only in the `RISK_WORKER_PROMPT` as part of the risk-handoff handshake.

- [ ] **Step 3.1: Update the `refund` tool schema**

In `src/domain/payments-tools.ts`, replace the `reason` field:

```typescript
        reason: z
          .string()
          .describe("Short human-readable reason for the refund."),
```

The full `refund` tool block after editing:

```typescript
  const refund = tool(
    async ({ payment_id, amount_cents, reason }) =>
      JSON.stringify(store.refund(payment_id, amount_cents, reason)),
    {
      name: "refund",
      description: "Refund an existing captured payment for the exact amount in cents.",
      schema: z.object({
        payment_id: z.string(),
        amount_cents: z.number().int().positive(),
        reason: z
          .string()
          .describe("Short human-readable reason for the refund."),
      }),
    },
  );
```

- [ ] **Step 3.2: Update `PAYMENTS_WORKER_PROMPT`**

In `src/prompts/v1.ts`, replace the `PAYMENTS_WORKER_PROMPT` constant with:

```typescript
export const PAYMENTS_WORKER_PROMPT = `You are the payments worker. You execute charges and refunds.

Tools: charge, refund.

Rules:
- Read the request and the supervisor's context carefully. Pass exact values from those sources as tool arguments.
- If a required value (payment_id, amount_cents, reason, customer_id, card_id) is missing, do not invent it: report what is missing and stop.
- When the supervisor's handoff message says the request involves fraud or a risk assessment, the refund reason MUST include one of these words: fraud, suspicious, or risk.
- Otherwise use a short plain-English reason that reflects the user's request (for example: "customer requested refund", "duplicate charge").
- After a successful tool call, summarise the outcome in one sentence and stop.`;
```

- [ ] **Step 3.3: Run unit tests**

Run: `bun test`
Expected: PASS.

- [ ] **Step 3.4: Run typecheck and lint**

Run: `bun run typecheck && bun run check`
Expected: both exit 0.

- [ ] **Step 3.5: Commit**

```bash
git add src/domain/payments-tools.ts src/prompts/v1.ts
git commit -m "fix(prompts): scope fraud-keyword guidance to risk-driven refunds only"
```

---

## Task 4: Add an out-of-scope refusal rule to the supervisor

**Files:**
- Modify: `src/prompts/v1.ts` (extend `ASSISTANT_PROMPT`)
- Modify: `dataset/v1/out-of-scope-001.ts` (no behavior change; reaffirms expectation comment)

Background: 0/7 models passed `out-of-scope-001` ("Send Bob $50.") because the supervisor had no rule for "don't route anywhere — reply directly." Every model fell through to `payments_worker`, which (correctly) asked for clarification. We give the supervisor an explicit out: reply directly and stop.

- [ ] **Step 4.1: Extend `ASSISTANT_PROMPT`**

In `src/prompts/v1.ts`, replace `ASSISTANT_PROMPT` with the version below. The two new bullets are the last two under "Routing policy" and the new bullet under "Critical rules".

```typescript
export const ASSISTANT_PROMPT = `You are a payments operations assistant. Coordinate three specialist workers to handle the user's request.

Routing policy:
- Read-only questions about payments (status, history, "did my refund go through") -> transfer to support_worker.
- Mutations (charge, refund) with no fraud signal -> transfer to payments_worker.
- Anything mentioning fraud, suspicious activity, unrecognised charges, weird or unusual charges, high-risk countries, or unexpectedly large amounts -> transfer to risk_worker FIRST, then payments_worker if the user asked for a refund or charge.
- If the user references a payment by description ("my last charge", "the biggest one", "yesterday's payment") instead of a payment_id, transfer to support_worker FIRST to look it up with list_payments, then continue with the appropriate worker.
- If the request is not about payments status, history, charge, refund, or fraud (for example money transfers, account changes, generic chat) -> do NOT route to any worker. Reply directly to the user explaining what this assistant can help with.

Critical rules:
- support_worker is read-only and cannot refund or charge. Never route refund or charge requests to support_worker.
- If the user asks to refund a payment, payments_worker must execute the refund (after risk_worker when fraud is suspected).
- When the user's request includes a refund, do not send a final reply until payments_worker has executed the refund tool.
- Fraudulent or suspicious refund workflow: transfer to risk_worker first, wait for the result, then transfer to payments_worker to refund the payment_id from the user's request.
- Hand off to one worker at a time. Wait for that worker's result before deciding the next step.
- Never invent payment_ids, amounts, card numbers, card_ids, or customer_ids. Use only values present in the user's request or in a worker's previous result.
- When all necessary work is complete, reply to the user with a concise plain-text summary. Do not invoke any further workers after replying.`;
```

- [ ] **Step 4.2: Run typecheck**

Run: `bun run typecheck`
Expected: exit 0.

- [ ] **Step 4.3: Commit**

```bash
git add src/prompts/v1.ts
git commit -m "feat(prompts): add out-of-scope and lookup-first routing rules"
```

---

## Task 5: Reword `risk-low-score-001` so its trigger word matches the supervisor

**Files:**
- Modify: `dataset/v1/risk-low-score-001.ts`

Background: 3/7 models routed `"Is payment pay_007 a weird charge?"` to `support_worker` because the supervisor prompt's fraud vocabulary did not include "weird". Task 4 already added "weird or unusual charges" to the supervisor; we also normalise the query to use the canonical word "suspicious" so the row tests both halves of the contract.

- [ ] **Step 5.1: Replace the file contents**

```typescript
import { cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "risk-low-score-001",
  query: "Is payment pay_007 a suspicious charge?",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["risk"],
    tool_calls: [{ worker: "risk", tool: "assess_risk", args: { payment_id: eq("pay_007") } }],
    final_world_state: { cards: [{ id: "card_007", blocked: false }] },
  },
});
```

- [ ] **Step 5.2: Run unit tests**

Run: `bun test`
Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add dataset/v1/risk-low-score-001.ts
git commit -m "fix(dataset): use canonical fraud vocabulary in risk-low-score-001"
```

---

## Task 6: Redesign `payments-not-found-001` to test safe lookup, not blind refund

**Files:**
- Modify: `dataset/v1/payments-not-found-001.ts`
- Modify: `dataset/v1/dataset.test.ts` (drop `payments-not-found-001` from the `REFUND_ROWS` list)

Background: the row was punishing the correct safe behavior (worker declines to refund a payment it can't verify). Under Task 4's new lookup-first rule, the supervisor should hand off to `support_worker.get_payment_status(pay_999)`, observe the `not_found` error, and reply to the user without mutating anything.

- [ ] **Step 6.1: Replace `dataset/v1/payments-not-found-001.ts`**

```typescript
import { cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "payments-not-found-001",
  query: "Refund pay_999 for $10.00.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["support"],
    tool_calls: [
      {
        worker: "support",
        tool: "get_payment_status",
        args: { payment_id: eq("pay_999") },
      },
    ],
    final_world_state: {
      payments: [
        { id: "pay_001", status: "captured" },
        { id: "pay_002", status: "refunded" },
        { id: "pay_003", status: "captured" },
        { id: "pay_007", status: "captured" },
      ],
    },
  },
});
```

This asserts both that the lookup happens AND that none of the four seeded payments change state (i.e. no stray mutation).

- [ ] **Step 6.2: Update `dataset/v1/dataset.test.ts`**

Remove `"payments-not-found-001"` from the `REFUND_ROWS` array. The array becomes:

```typescript
const REFUND_ROWS = [
  "payments-refund-001",
  "support-deflect-001",
  "support-then-payments-001",
];
```

- [ ] **Step 6.3: Run unit tests**

Run: `bun test`
Expected: PASS.

- [ ] **Step 6.4: Commit**

```bash
git add dataset/v1/payments-not-found-001.ts dataset/v1/dataset.test.ts
git commit -m "fix(dataset): payments-not-found-001 expects safe lookup path"
```

---

## Task 7: Show per-axis pass/fail on the dashboard heatmap tooltip

**Files:**
- Modify: `src/dashboard/load-runs.ts` (expose axis booleans on each row — already present as `axes`; ensure the failure reason for each axis is captured)
- Modify: `src/dashboard/build.ts` (extend tooltip to list all five axes)

Background: today the dashboard tooltip only shows the first failing axis. After this plan, when re-running the benchmark, an investigator should immediately see which axis failed without opening trace JSON.

- [ ] **Step 7.1: Capture per-axis details in the loader**

In `src/dashboard/load-runs.ts`, change the `DashboardRow` type and the `loadTraceRows` function to record per-axis details:

```typescript
export type AxisOutcome = { passed: boolean; details: string };

export type DashboardRow = {
  row_id: string;
  passed: boolean;
  duration_ms: number;
  axes: Record<AxisName, AxisOutcome>;
};
```

Replace the body of `loadTraceRows` with:

```typescript
async function loadTraceRows(tracesDir: string, summary: Summary): Promise<DashboardRow[]> {
  const scoreByRow = new Map<string, TraceScore>();

  try {
    const traceFiles = await readdir(tracesDir);
    for (const fileName of traceFiles) {
      if (!fileName.endsWith(".json")) {
        continue;
      }

      const trace = JSON.parse(await readFile(join(tracesDir, fileName), "utf8")) as TraceFile;
      scoreByRow.set(trace.row_id, trace.score);
    }
  } catch {
    // traces directory may be missing; fall back to summary-only data
  }

  return summary.row_results.map((result) => {
    const score = scoreByRow.get(result.row_id);
    const axes = Object.fromEntries(
      AXES.map((axis) => [
        axis,
        score
          ? { passed: score[axis].passed, details: score[axis].details }
          : { passed: result.passed, details: "no trace available" },
      ]),
    ) as Record<AxisName, AxisOutcome>;

    return {
      row_id: result.row_id,
      passed: result.passed,
      duration_ms: result.duration_ms,
      axes,
    };
  });
}
```

Delete the now-unused `firstFailureDetail` function at the bottom of the file.

- [ ] **Step 7.2: Render axis breakdown in the heatmap tooltip**

In `src/dashboard/build.ts`, find the `renderHeatmap` function and replace its tooltip-string construction. The cell mapping inside `cells = models.map(...)` becomes:

```javascript
                  .map((model) => {
                    const row = rowLookup(model, rowId);
                    if (!row) {
                      return '<td class="cell cell-missing">—</td>';
                    }
                    const klass = row.passed ? "cell-pass" : "cell-fail";
                    const label = row.passed ? "✓" : "✗";
                    const axisLines = AXES.map((axis) => {
                      const outcome = row.axes[axis];
                      const mark = outcome.passed ? "✓" : "✗";
                      return mark + " " + AXIS_LABELS[axis] + ": " + outcome.details;
                    }).join("\\n");
                    const tip =
                      model.model_id + " / " + rowId + " (" + formatMs(row.duration_ms) + ")\\n" + axisLines;
                    return '<td class="cell ' + klass + '" data-tip="' + escapeAttr(tip) + '">' + label + '</td>';
                  })
```

Also update the tooltip element to preserve newlines. In the `<style>` section, add a `white-space: pre-line` rule to `.tooltip`:

```css
    .tooltip {
      position: fixed;
      pointer-events: none;
      background: #0f1520;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 0.8rem;
      max-width: 360px;
      white-space: pre-line;
      box-shadow: var(--shadow);
      z-index: 20;
      display: none;
    }
```

- [ ] **Step 7.3: Build the dashboard**

Run: `bun run dashboard`
Expected: `wrote /var/home/felix/github/local-llm/lemonade/agent-bench/dashboard.html (N models)` (N = however many GGUF runs currently exist).

- [ ] **Step 7.4: Run typecheck and lint**

Run: `bun run typecheck && bun run check`
Expected: both exit 0.

- [ ] **Step 7.5: Commit**

```bash
git add src/dashboard/load-runs.ts src/dashboard/build.ts
git commit -m "feat(dashboard): show per-axis pass/fail breakdown on heatmap tooltip"
```

---

## Task 8: Discard stale runs and the comparison registry

**Files:**
- Delete: every directory under `runs/` whose name contains `GGUF`
- Delete: `benchmarks/comparison.json` and every file under `benchmarks/models/`

Background: All existing snapshots were produced with the broken prompts and matchers; comparing new runs against them would be misleading. Re-running is mandatory.

- [ ] **Step 8.1: Verify what would be deleted**

Run: `ls runs/ benchmarks/models/ 2>/dev/null && cat benchmarks/comparison.json 2>/dev/null | head -5`
Expected: lists the GGUF folders and shows the start of the comparison index.

- [ ] **Step 8.2: Remove the stale snapshots**

Run:
```bash
rm -rf runs/*-GGUF*
rm -rf benchmarks/models
rm -f benchmarks/comparison.json
```

- [ ] **Step 8.3: Confirm an empty runs/ and benchmarks/**

Run: `ls runs/ benchmarks/ 2>/dev/null`
Expected: `runs/` is empty (or contains only non-GGUF folders, which we leave alone); `benchmarks/` either does not exist or is empty.

- [ ] **Step 8.4: Rebuild the dashboard against the (now empty) data**

Run: `bun run dashboard`
Expected: `wrote .../dashboard.html (0 models)`. Open it in a browser and confirm the "No GGUF runs found" empty-state renders.

- [ ] **Step 8.5: Commit**

`runs/` is gitignored, so only `benchmarks/` paths will appear in `git status`.

```bash
git add -A benchmarks dashboard.html
git commit -m "chore(benchmarks): drop V1 snapshots produced under broken prompts"
```

If `git status` shows nothing under `benchmarks/`, that path was never tracked — skip `benchmarks` from the `git add` line.

---

## Task 9: Re-record V1 on a fast representative model and confirm the fixes

**Files:**
- Read/produce: `runs/Gemma-4-E4B-it-GGUF/summary.json` (regenerated)

We pick `Gemma-4-E4B-it-GGUF` as the fast canary (≈90s for 12 rows in prior runs and it was previously the joint best at 7/12). If lemonade is unreachable, document the failure and stop — DO NOT mock anything.

- [ ] **Step 9.1: Verify lemonade is reachable**

Run: `curl -fsS http://localhost:13305/v1/models | head -c 300`
Expected: non-empty JSON listing models. If this fails, stop here and surface the connection error to the user; the remaining steps need a live endpoint.

- [ ] **Step 9.2: Run the benchmark against the canary**

Run:
```bash
LEMONADE_MODEL=Gemma-4-E4B-it-GGUF bun run bench --out runs/Gemma-4-E4B-it-GGUF --save-comparison
```

Expected: the CLI prints a JSON summary and then `saved comparison for Gemma-4-E4B-it-GGUF -> benchmarks/models/Gemma-4-E4B-it-GGUF.json`.

- [ ] **Step 9.3: Assert the previously-broken rows now pass**

Run:
```bash
bun -e "
import { readFile } from 'node:fs/promises';
const s = JSON.parse(await readFile('runs/Gemma-4-E4B-it-GGUF/summary.json', 'utf8'));
const required = ['payments-refund-001', 'support-deflect-001'];
const byId = Object.fromEntries(s.row_results.map(r => [r.row_id, r.passed]));
for (const id of required) {
  console.log(id, byId[id] ? 'PASS' : 'FAIL');
  if (!byId[id]) process.exitCode = 1;
}
console.log('overall pass rate:', s.pass_rate);
"
```

Expected: `payments-refund-001 PASS` and `support-deflect-001 PASS`. Overall pass rate should rise from the prior baseline of 0.5833 — anything ≥ 0.66 indicates the Task 2/3 fixes worked. If either required row still fails, read the corresponding trace under `runs/Gemma-4-E4B-it-GGUF/traces/<row>.json`, identify which axis failed, and stop to discuss before continuing.

- [ ] **Step 9.4: Rebuild and inspect the dashboard**

Run: `bun run dashboard`
Expected: `wrote ... (1 models)`. Open `dashboard.html` and confirm the leaderboard shows the new pass rate and that hovering a cell shows the per-axis breakdown introduced in Task 7.

- [ ] **Step 9.5: Commit**

```bash
git add benchmarks/comparison.json benchmarks/models/Gemma-4-E4B-it-GGUF.json dashboard.html
git commit -m "chore(benchmarks): record V1 baseline on Gemma-4-E4B-it-GGUF after fairness fixes"
```

---

## Task 10: Note the V1 revision in `CONTEXT.md`

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 10.1: Append a paragraph**

Append the following paragraph to the end of `CONTEXT.md` (or, if `CONTEXT.md` already has a "Revision history" section, add the bullet to it):

```markdown
## Revision history

- **2026-05-23 — V1 fairness pass.** Removed prompt and tool-schema steering that caused models to emit `reason: "risk"` on every refund, regardless of fraud context. Relaxed the `reason` matcher to `any()` on non-risk refund rows. Added an out-of-scope refusal rule and a lookup-first rule to the supervisor prompt. Redesigned `payments-not-found-001` to expect a safe `support_worker.get_payment_status` lookup. All `runs/` and `benchmarks/` snapshots created before this date were discarded. Dataset and prompt version labels remain `v1`.
```

- [ ] **Step 10.2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: record V1 fairness revision in CONTEXT.md"
```

---

## Done criteria

- `bun test` is green.
- `bun run typecheck && bun run check` both exit 0.
- `runs/Gemma-4-E4B-it-GGUF/summary.json` exists and reports `payments-refund-001` and `support-deflect-001` as passed.
- `dashboard.html` renders, the heatmap tooltip shows per-axis details, and the leaderboard contains at least Gemma-4-E4B-it-GGUF.
- `CONTEXT.md` documents the V1 revision.

## Out of scope (intentionally deferred)

- Switching routing from strict equality to subsequence-containment. Rejected for this pass because models with wildly bouncing routes (e.g. `payments -> support -> payments -> support`) would silently pass.
- Re-running the other six GGUF models. Once the canary confirms the fixes, the user can re-record those at their own pace with `LEMONADE_MODEL=<id> bun run bench --out runs/<id> --save-comparison`.
- Bumping `PROMPTS_VERSION` / `DATASET_VERSION` to `v2`. Deferred until a structural change (new tools, new workers, schema migration) makes the version bump meaningful.
