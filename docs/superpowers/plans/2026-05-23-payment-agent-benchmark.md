# Payment Agent Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun + TypeScript benchmark harness for a hierarchical payment multi-agent system using LangGraphJS, `createSupervisor`, and a local OpenAI-compatible Lemonade server.

**Architecture:** The benchmark runs single-turn Rows through one client-facing Assistant graph. The Assistant delegates to three ReAct Workers (`payments_worker`, `risk_worker`, `support_worker`) via LangGraph Supervisor hand-off tools; Workers operate on a per-Row in-memory `WorldStore` and the harness scores routing, tool calls, world-state mutations, and completion.

**Tech Stack:** Bun, TypeScript strict mode, Biome, `bun:test`, `@langchain/langgraph@1.3.0`, `@langchain/langgraph-supervisor@1.0.1`, `@langchain/openai@1.4.7`, `@langchain/core@1.1.48`, `zod@4.4.3`, local Lemonade OpenAI-compatible endpoint at `http://localhost:13305/v1`.

---

## File Structure

- Create `package.json`: project metadata, Bun scripts, pinned runtime and dev dependencies.
- Create `tsconfig.json`: strict TypeScript config for Bun ESM.
- Create `biome.json`: format, lint, import organization.
- Create `.gitignore`: ignores dependencies and benchmark run artefacts.
- Create `src/types.ts`: shared domain, benchmark, trace, matcher, and score types.
- Create `src/harness/matchers.ts`: `ArgMatcher` and partial-world matching logic.
- Create `src/harness/matchers.test.ts`: unit tests for matcher behavior.
- Create `src/domain/world-store.ts`: per-Row in-memory state, deterministic mutations, mutation log.
- Create `src/domain/world-store.test.ts`: tests for refund, charge, blocking, and list/status lookup behavior.
- Create `src/domain/risk.ts`: deterministic risk scoring and threshold constants.
- Create `src/domain/risk.test.ts`: tests for low/high risk cases.
- Create `src/domain/payments-tools.ts`: LangChain tools for `charge` and `refund`.
- Create `src/domain/risk-tools.ts`: LangChain tools for `assess_risk` and `block_card`.
- Create `src/domain/support-tools.ts`: LangChain tools for `get_payment_status` and `list_payments`.
- Create `src/domain/tools.test.ts`: direct tool invocation tests for success and structured error cases.
- Create `src/prompts/v1.ts`: frozen operational prompts and `PROMPTS_VERSION`.
- Create `src/llm/client.ts`: ChatOpenAI client configured for Lemonade.
- Create `src/agents/payments-worker.ts`: `createReactAgent` for payments.
- Create `src/agents/risk-worker.ts`: `createReactAgent` for risk.
- Create `src/agents/support-worker.ts`: `createReactAgent` for support.
- Create `src/agents/assistant.ts`: `createSupervisor` graph wiring.
- Create `dataset/v1/_helpers.ts`: typed helpers for Rows, matchers, and seeds.
- Create `dataset/v1/*.ts`: 12 starter Rows.
- Create `dataset/v1/index.ts`: stable ordered dataset export.
- Create `src/harness/hash.ts`: deterministic row seed hashing.
- Create `src/harness/trace.ts`: stream update normalization into route, tool calls, and messages.
- Create `src/harness/score.ts`: scoring engine.
- Create `src/harness/score.test.ts`: scoring tests for routing, tool args, world state, and completion.
- Create `src/harness/run.ts`: execute one Row against the graph and write a trace.
- Create `src/harness/report.ts`: aggregate Row traces into `summary.json`.
- Create `src/cli.ts`: `bun run bench`, `--row`, `--dataset`, `--out`.

Each task below is written so a worker can implement and verify it independently.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `.gitignore`

- [ ] **Step 1: Write package metadata and scripts**

Create `package.json`:

```json
{
  "name": "payment-agent-benchmark",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "bench": "bun run src/cli.ts",
    "check": "biome check .",
    "format": "biome check --write .",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@langchain/core": "1.1.48",
    "@langchain/langgraph": "1.3.0",
    "@langchain/langgraph-supervisor": "1.0.1",
    "@langchain/openai": "1.4.7",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@biomejs/biome": "2.4.15",
    "typescript": "5.9.3"
  }
}
```

- [ ] **Step 2: Write TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts", "dataset/**/*.ts"]
}
```

- [ ] **Step 3: Write Biome config**

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.15/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  },
  "organizeImports": {
    "enabled": true
  },
  "files": {
    "ignoreUnknown": false,
    "includes": ["**/*.ts", "**/*.json", "**/*.md", "!runs/**", "!node_modules/**"]
  }
}
```

- [ ] **Step 4: Write ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
bun.lock
runs/
.DS_Store
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
bun install
```

Expected: dependency installation completes and writes `bun.lock`.

- [ ] **Step 6: Run baseline checks**

Run:

```bash
bun run check
bun run typecheck
bun test
```

Expected: Biome reports no errors or only markdown formatting suggestions; TypeScript reports no source files or no errors; `bun test` reports zero tests.

- [ ] **Step 7: Commit scaffold**

Run:

```bash
git add package.json tsconfig.json biome.json .gitignore bun.lock
git commit -m "chore: scaffold payment agent benchmark"
```

Expected: a commit is created. If implementation occurs before git is initialized, initialize git first with `git init` and then run the same add/commit commands.

---

### Task 2: Shared Types and Matchers

**Files:**
- Create: `src/types.ts`
- Create: `src/harness/matchers.ts`
- Create: `src/harness/matchers.test.ts`

- [ ] **Step 1: Write failing matcher tests**

Create `src/harness/matchers.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { argsMatch, partialWorldMatches } from "./matchers.ts";
import type { ArgMatcher, WorldState } from "../types.ts";

describe("argsMatch", () => {
  test("passes exact, approximate, regex, and any matchers", () => {
    const matchers: Record<string, ArgMatcher> = {
      payment_id: { kind: "eq", value: "pay_001" },
      amount_cents: { kind: "approx", value: 400000, tolerance: 0 },
      reason: { kind: "regex", pattern: "fraud|suspicious" },
      risk_score: { kind: "any" }
    };

    const actual = {
      payment_id: "pay_001",
      amount_cents: 400000,
      reason: "suspected fraud",
      risk_score: 0.92,
      optional_note: "extra fields are ignored"
    };

    expect(argsMatch(actual, matchers)).toEqual({ passed: true, details: "all arguments matched" });
  });

  test("fails when a pinned argument is missing", () => {
    expect(argsMatch({}, { payment_id: { kind: "eq", value: "pay_001" } })).toEqual({
      passed: false,
      details: "payment_id: expected eq \"pay_001\", got undefined"
    });
  });
});

describe("partialWorldMatches", () => {
  test("matches listed entities by id and ignores unlisted fields", () => {
    const actual: WorldState = {
      customers: [{ id: "cus_001", name: "Ada" }],
      cards: [{ id: "card_001", customer_id: "cus_001", last4: "4242", blocked: false }],
      payments: [
        {
          id: "pay_001",
          customer_id: "cus_001",
          card_id: "card_001",
          amount_cents: 400000,
          currency: "USD",
          country: "BY",
          status: "refunded",
          created_at: "2026-01-10T00:00:00.000Z"
        }
      ]
    };

    expect(partialWorldMatches(actual, { payments: [{ id: "pay_001", status: "refunded" }] })).toEqual({
      passed: true,
      details: "world state matched"
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun test src/harness/matchers.test.ts
```

Expected: FAIL because `src/types.ts` and `src/harness/matchers.ts` do not exist.

- [ ] **Step 3: Create shared types**

Create `src/types.ts`:

```ts
export type WorkerName = "payments" | "risk" | "support";

export type PaymentStatus = "authorized" | "captured" | "refunded" | "failed";

export type Customer = {
  id: string;
  name: string;
};

export type Card = {
  id: string;
  customer_id: string;
  last4: string;
  blocked: boolean;
};

export type Payment = {
  id: string;
  customer_id: string;
  card_id: string;
  amount_cents: number;
  currency: "USD";
  country: string;
  status: PaymentStatus;
  created_at: string;
};

export type WorldState = {
  customers: Customer[];
  cards: Card[];
  payments: Payment[];
};

export type PartialWorldState = {
  customers?: Array<Partial<Customer> & Pick<Customer, "id">>;
  cards?: Array<Partial<Card> & Pick<Card, "id">>;
  payments?: Array<Partial<Payment> & Pick<Payment, "id">>;
};

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type ArgMatcher =
  | { kind: "eq"; value: unknown }
  | { kind: "approx"; value: number; tolerance: number }
  | { kind: "regex"; pattern: string }
  | { kind: "any" };

export type ExpectedToolCall = {
  worker: WorkerName;
  tool: string;
  args: Record<string, ArgMatcher>;
};

export type BenchmarkRow = {
  id: string;
  query: string;
  world_state_seed: WorldState;
  expected: {
    workers: WorkerName[];
    tool_calls: ExpectedToolCall[];
    final_world_state?: PartialWorldState;
  };
};

export type WorldStateMutation = {
  tool: string;
  entity: "payment" | "card";
  entity_id: string;
  before: unknown;
  after: unknown;
};

export type ObservedToolCall = {
  worker: WorkerName;
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type CompletionFailure =
  | "error_thrown"
  | "supervisor_budget_exceeded"
  | "worker_budget_exceeded"
  | "truncated";

export type AxisScore = {
  passed: boolean;
  details: string;
};

export type CompletionScore = AxisScore & {
  failure?: CompletionFailure;
};

export type RowScore = {
  routing: AxisScore;
  tool_selection: AxisScore;
  tool_args: AxisScore;
  world_state: AxisScore;
  completion: CompletionScore;
  overall: boolean;
};

export type RowTrace = {
  row_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  model_id: string;
  prompts_version: string;
  dataset_version: string;
  commit: string | null;
  query: string;
  world_state_seed: WorldState;
  route: WorkerName[];
  tool_calls: ObservedToolCall[];
  world_state_log: WorldStateMutation[];
  final_world_state: WorldState;
  messages: unknown[];
  expected: BenchmarkRow["expected"];
  score: RowScore;
  warnings: string[];
  step_counts: {
    supervisor: number;
    per_worker: Record<WorkerName, number>;
  };
};
```

- [ ] **Step 4: Implement matcher engine**

Create `src/harness/matchers.ts`:

```ts
import type { ArgMatcher, AxisScore, PartialWorldState, WorldState } from "../types.ts";

export function argsMatch(
  actual: Record<string, unknown>,
  expected: Record<string, ArgMatcher>
): AxisScore {
  for (const [key, matcher] of Object.entries(expected)) {
    const value = actual[key];
    const result = valueMatches(value, matcher);

    if (!result.passed) {
      return {
        passed: false,
        details: `${key}: ${result.details}`
      };
    }
  }

  return { passed: true, details: "all arguments matched" };
}

export function valueMatches(actual: unknown, matcher: ArgMatcher): AxisScore {
  switch (matcher.kind) {
    case "any":
      return { passed: true, details: "any value accepted" };
    case "eq":
      if (deepEqual(actual, matcher.value)) {
        return { passed: true, details: "equal" };
      }
      return {
        passed: false,
        details: `expected eq ${JSON.stringify(matcher.value)}, got ${JSON.stringify(actual)}`
      };
    case "approx":
      if (typeof actual !== "number") {
        return {
          passed: false,
          details: `expected number approx ${matcher.value}, got ${JSON.stringify(actual)}`
        };
      }
      if (Math.abs(actual - matcher.value) <= matcher.tolerance) {
        return { passed: true, details: "approximately equal" };
      }
      return {
        passed: false,
        details: `expected approx ${matcher.value} +/- ${matcher.tolerance}, got ${actual}`
      };
    case "regex":
      if (new RegExp(matcher.pattern).test(String(actual))) {
        return { passed: true, details: "regex matched" };
      }
      return {
        passed: false,
        details: `expected regex /${matcher.pattern}/, got ${JSON.stringify(actual)}`
      };
  }
}

export function partialWorldMatches(actual: WorldState, expected?: PartialWorldState): AxisScore {
  if (!expected) {
    return { passed: true, details: "no world state assertion" };
  }

  const checks = [
    checkEntities("customers", actual.customers, expected.customers),
    checkEntities("cards", actual.cards, expected.cards),
    checkEntities("payments", actual.payments, expected.payments)
  ];

  const failure = checks.find((check) => !check.passed);
  if (failure) {
    return failure;
  }

  return { passed: true, details: "world state matched" };
}

function checkEntities<T extends { id: string }>(
  label: string,
  actual: T[],
  expected: Array<Partial<T> & Pick<T, "id">> | undefined
): AxisScore {
  if (!expected) {
    return { passed: true, details: `${label}: no assertion` };
  }

  for (const expectedEntity of expected) {
    const actualEntity = actual.find((entity) => entity.id === expectedEntity.id);
    if (!actualEntity) {
      return { passed: false, details: `${label}: missing entity ${expectedEntity.id}` };
    }

    for (const [key, expectedValue] of Object.entries(expectedEntity)) {
      const actualValue = actualEntity[key as keyof T];
      if (!deepEqual(actualValue, expectedValue)) {
        return {
          passed: false,
          details: `${label}.${expectedEntity.id}.${key}: expected ${JSON.stringify(
            expectedValue
          )}, got ${JSON.stringify(actualValue)}`
        };
      }
    }
  }

  return { passed: true, details: `${label}: matched` };
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
```

- [ ] **Step 5: Run matcher tests**

Run:

```bash
bun test src/harness/matchers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run typecheck and Biome**

Run:

```bash
bun run typecheck
bun run check
```

Expected: PASS. If Biome requests formatting, run `bun run format` and repeat both commands.

- [ ] **Step 7: Commit shared types and matchers**

Run:

```bash
git add src/types.ts src/harness/matchers.ts src/harness/matchers.test.ts
git commit -m "feat: add benchmark types and matchers"
```

Expected: commit succeeds.

---

### Task 3: WorldStore and Risk Scoring

**Files:**
- Create: `src/domain/world-store.ts`
- Create: `src/domain/world-store.test.ts`
- Create: `src/domain/risk.ts`
- Create: `src/domain/risk.test.ts`

- [ ] **Step 1: Write failing WorldStore tests**

Create `src/domain/world-store.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { WorldStore } from "./world-store.ts";
import type { WorldState } from "../types.ts";

const seed: WorldState = {
  customers: [{ id: "cus_001", name: "Ada Lovelace" }],
  cards: [{ id: "card_001", customer_id: "cus_001", last4: "4242", blocked: false }],
  payments: [
    {
      id: "pay_001",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 400000,
      currency: "USD",
      country: "BY",
      status: "captured",
      created_at: "2026-01-10T00:00:00.000Z"
    }
  ]
};

describe("WorldStore", () => {
  test("refund mutates a payment and records a mutation", () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");

    const result = store.refund("pay_001", 400000, "suspected fraud");

    expect(result.ok).toBe(true);
    expect(store.snapshot().payments[0]?.status).toBe("refunded");
    expect(store.mutations()).toHaveLength(1);
    expect(store.mutations()[0]?.tool).toBe("refund");
  });

  test("refund returns structured error for missing payment", () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");

    expect(store.refund("pay_missing", 100, "missing")).toEqual({
      ok: false,
      error: { code: "not_found", message: "payment pay_missing not found" }
    });
  });

  test("blockCard mutates a card and records a mutation", () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");

    const result = store.blockCard("card_001", "risk score 0.92");

    expect(result.ok).toBe(true);
    expect(store.snapshot().cards[0]?.blocked).toBe(true);
    expect(store.mutations()[0]?.tool).toBe("block_card");
  });
});
```

- [ ] **Step 2: Write failing risk tests**

Create `src/domain/risk.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { RISK_BLOCK_THRESHOLD, scoreRisk } from "./risk.ts";
import type { Payment } from "../types.ts";

const basePayment: Payment = {
  id: "pay_001",
  customer_id: "cus_001",
  card_id: "card_001",
  amount_cents: 3000,
  currency: "USD",
  country: "US",
  status: "captured",
  created_at: "2026-01-10T00:00:00.000Z"
};

describe("scoreRisk", () => {
  test("returns low score for small domestic payment", () => {
    const risk = scoreRisk(basePayment);

    expect(risk.risk_score).toBeLessThanOrEqual(RISK_BLOCK_THRESHOLD);
    expect(risk.signals).toEqual(["baseline"]);
  });

  test("returns high score for large payment from elevated-risk country", () => {
    const risk = scoreRisk({ ...basePayment, amount_cents: 400000, country: "BY" });

    expect(risk.risk_score).toBeGreaterThan(RISK_BLOCK_THRESHOLD);
    expect(risk.signals).toContain("amount_outlier");
    expect(risk.signals).toContain("geo_anomaly");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
bun test src/domain/world-store.test.ts src/domain/risk.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 4: Implement WorldStore**

Create `src/domain/world-store.ts`:

```ts
import type { Payment, ToolResult, WorldState, WorldStateMutation } from "../types.ts";

export class WorldStore {
  private world: WorldState;
  private log: WorldStateMutation[] = [];

  constructor(seed: WorldState, private readonly now: string) {
    this.world = structuredClone(seed);
  }

  snapshot(): WorldState {
    return structuredClone(this.world);
  }

  mutations(): WorldStateMutation[] {
    return structuredClone(this.log);
  }

  getPayment(paymentId: string): Payment | undefined {
    return this.world.payments.find((payment) => payment.id === paymentId);
  }

  getPaymentStatus(paymentId: string): ToolResult<Payment> {
    const payment = this.getPayment(paymentId);
    if (!payment) {
      return { ok: false, error: { code: "not_found", message: `payment ${paymentId} not found` } };
    }

    return { ok: true, data: structuredClone(payment) };
  }

  listPayments(customerId: string): ToolResult<{ payments: Payment[] }> {
    const customer = this.world.customers.find((item) => item.id === customerId);
    if (!customer) {
      return { ok: false, error: { code: "not_found", message: `customer ${customerId} not found` } };
    }

    return {
      ok: true,
      data: { payments: structuredClone(this.world.payments.filter((p) => p.customer_id === customerId)) }
    };
  }

  charge(input: {
    customer_id: string;
    card_id: string;
    amount_cents: number;
    country: string;
  }): ToolResult<Payment> {
    const card = this.world.cards.find((item) => item.id === input.card_id);
    if (!card) {
      return { ok: false, error: { code: "not_found", message: `card ${input.card_id} not found` } };
    }

    if (card.blocked) {
      return { ok: false, error: { code: "card_blocked", message: `card ${input.card_id} is blocked` } };
    }

    const payment: Payment = {
      id: `pay_${input.customer_id}_${input.card_id}_${this.world.payments.length + 1}`,
      customer_id: input.customer_id,
      card_id: input.card_id,
      amount_cents: input.amount_cents,
      currency: "USD",
      country: input.country,
      status: "captured",
      created_at: this.now
    };

    this.world.payments.push(payment);
    this.log.push({
      tool: "charge",
      entity: "payment",
      entity_id: payment.id,
      before: null,
      after: structuredClone(payment)
    });

    return { ok: true, data: structuredClone(payment) };
  }

  refund(paymentId: string, amountCents: number, reason: string): ToolResult<Payment> {
    const payment = this.getPayment(paymentId);
    if (!payment) {
      return { ok: false, error: { code: "not_found", message: `payment ${paymentId} not found` } };
    }

    if (payment.status === "refunded") {
      return {
        ok: false,
        error: { code: "already_refunded", message: `payment ${paymentId} is already refunded` }
      };
    }

    if (amountCents !== payment.amount_cents) {
      return {
        ok: false,
        error: {
          code: "amount_mismatch",
          message: `refund amount ${amountCents} does not match payment amount ${payment.amount_cents}`
        }
      };
    }

    const before = structuredClone(payment);
    payment.status = "refunded";
    const after = structuredClone(payment);

    this.log.push({
      tool: "refund",
      entity: "payment",
      entity_id: paymentId,
      before,
      after: { ...after, reason }
    });

    return { ok: true, data: after };
  }

  blockCard(cardId: string, reason: string): ToolResult<{ card_id: string; blocked: boolean }> {
    const card = this.world.cards.find((item) => item.id === cardId);
    if (!card) {
      return { ok: false, error: { code: "not_found", message: `card ${cardId} not found` } };
    }

    const before = structuredClone(card);
    card.blocked = true;
    const after = structuredClone(card);

    this.log.push({
      tool: "block_card",
      entity: "card",
      entity_id: cardId,
      before,
      after: { ...after, reason }
    });

    return { ok: true, data: { card_id: cardId, blocked: true } };
  }
}
```

- [ ] **Step 5: Implement deterministic risk scoring**

Create `src/domain/risk.ts`:

```ts
import type { Payment } from "../types.ts";

export const RISK_BLOCK_THRESHOLD = 0.7;

export type RiskAssessment = {
  payment_id: string;
  card_id: string;
  risk_score: number;
  signals: string[];
};

const elevatedRiskCountries = new Set(["BY", "RU", "IR", "KP"]);

export function scoreRisk(payment: Payment): RiskAssessment {
  const signals: string[] = [];
  let score = 0.1;

  if (payment.amount_cents >= 100000) {
    score += 0.35;
    signals.push("amount_outlier");
  }

  if (elevatedRiskCountries.has(payment.country)) {
    score += 0.45;
    signals.push("geo_anomaly");
  }

  if (payment.status !== "captured") {
    score += 0.1;
    signals.push("non_captured_status");
  }

  if (signals.length === 0) {
    signals.push("baseline");
  }

  return {
    payment_id: payment.id,
    card_id: payment.card_id,
    risk_score: Math.min(1, Number(score.toFixed(2))),
    signals
  };
}
```

- [ ] **Step 6: Run domain tests**

Run:

```bash
bun test src/domain/world-store.test.ts src/domain/risk.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run project checks**

Run:

```bash
bun run typecheck
bun run check
```

Expected: PASS. If Biome requests formatting, run `bun run format` and repeat both commands.

- [ ] **Step 8: Commit WorldStore and risk scoring**

Run:

```bash
git add src/domain/world-store.ts src/domain/world-store.test.ts src/domain/risk.ts src/domain/risk.test.ts
git commit -m "feat: add deterministic payment world"
```

Expected: commit succeeds.

---

### Task 4: Domain Tools

**Files:**
- Create: `src/domain/payments-tools.ts`
- Create: `src/domain/risk-tools.ts`
- Create: `src/domain/support-tools.ts`
- Create: `src/domain/tools.test.ts`

- [ ] **Step 1: Write failing tool tests**

Create `src/domain/tools.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { makePaymentsTools } from "./payments-tools.ts";
import { makeRiskTools } from "./risk-tools.ts";
import { makeSupportTools } from "./support-tools.ts";
import { WorldStore } from "./world-store.ts";
import type { WorldState } from "../types.ts";

const seed: WorldState = {
  customers: [{ id: "cus_001", name: "Ada Lovelace" }],
  cards: [{ id: "card_001", customer_id: "cus_001", last4: "4242", blocked: false }],
  payments: [
    {
      id: "pay_001",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 400000,
      currency: "USD",
      country: "BY",
      status: "captured",
      created_at: "2026-01-10T00:00:00.000Z"
    }
  ]
};

describe("domain tools", () => {
  test("payments refund tool returns structured success", async () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");
    const [charge, refund] = makePaymentsTools(store);

    expect(charge.name).toBe("charge");
    const result = await refund.invoke({
      payment_id: "pay_001",
      amount_cents: 400000,
      reason: "suspected fraud"
    });

    expect(result).toContain('"ok":true');
    expect(store.snapshot().payments[0]?.status).toBe("refunded");
  });

  test("risk assess tool returns deterministic score", async () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");
    const [assessRisk] = makeRiskTools(store);

    const result = await assessRisk.invoke({ payment_id: "pay_001" });

    expect(result).toContain('"risk_score":0.9');
    expect(result).toContain('"geo_anomaly"');
  });

  test("support get status tool returns payment data", async () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");
    const [getPaymentStatus] = makeSupportTools(store);

    const result = await getPaymentStatus.invoke({ payment_id: "pay_001" });

    expect(result).toContain('"status":"captured"');
  });
});
```

- [ ] **Step 2: Run tool tests to verify failure**

Run:

```bash
bun test src/domain/tools.test.ts
```

Expected: FAIL because tool factory files do not exist.

- [ ] **Step 3: Implement payments tools**

Create `src/domain/payments-tools.ts`:

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { WorldStore } from "./world-store.ts";

export function makePaymentsTools(store: WorldStore) {
  const charge = tool(
    async (input) => JSON.stringify(store.charge(input)),
    {
      name: "charge",
      description: "Charge a customer's card for an amount in cents.",
      schema: z.object({
        customer_id: z.string(),
        card_id: z.string(),
        amount_cents: z.number().int().positive(),
        country: z.string().length(2)
      })
    }
  );

  const refund = tool(
    async ({ payment_id, amount_cents, reason }) =>
      JSON.stringify(store.refund(payment_id, amount_cents, reason)),
    {
      name: "refund",
      description: "Refund an existing captured payment for the exact amount in cents.",
      schema: z.object({
        payment_id: z.string(),
        amount_cents: z.number().int().positive(),
        reason: z.string()
      })
    }
  );

  return [charge, refund] as const;
}
```

- [ ] **Step 4: Implement risk tools**

Create `src/domain/risk-tools.ts`:

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { scoreRisk } from "./risk.ts";
import type { WorldStore } from "./world-store.ts";

export function makeRiskTools(store: WorldStore) {
  const assessRisk = tool(
    async ({ payment_id }) => {
      const payment = store.getPayment(payment_id);
      if (!payment) {
        return JSON.stringify({
          ok: false,
          error: { code: "not_found", message: `payment ${payment_id} not found` }
        });
      }

      return JSON.stringify({ ok: true, data: scoreRisk(payment) });
    },
    {
      name: "assess_risk",
      description: "Assess fraud risk for an existing payment.",
      schema: z.object({
        payment_id: z.string()
      })
    }
  );

  const blockCard = tool(
    async ({ card_id, reason }) => JSON.stringify(store.blockCard(card_id, reason)),
    {
      name: "block_card",
      description: "Block a card when the risk policy says the card should no longer be used.",
      schema: z.object({
        card_id: z.string(),
        reason: z.string()
      })
    }
  );

  return [assessRisk, blockCard] as const;
}
```

- [ ] **Step 5: Implement support tools**

Create `src/domain/support-tools.ts`:

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { WorldStore } from "./world-store.ts";

export function makeSupportTools(store: WorldStore) {
  const getPaymentStatus = tool(
    async ({ payment_id }) => JSON.stringify(store.getPaymentStatus(payment_id)),
    {
      name: "get_payment_status",
      description: "Look up a payment by id and return its current status and details.",
      schema: z.object({
        payment_id: z.string()
      })
    }
  );

  const listPayments = tool(
    async ({ customer_id }) => JSON.stringify(store.listPayments(customer_id)),
    {
      name: "list_payments",
      description: "List payments belonging to a customer.",
      schema: z.object({
        customer_id: z.string()
      })
    }
  );

  return [getPaymentStatus, listPayments] as const;
}
```

- [ ] **Step 6: Run tool tests**

Run:

```bash
bun test src/domain/tools.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run project checks**

Run:

```bash
bun run typecheck
bun run check
```

Expected: PASS. If Biome requests formatting, run `bun run format` and repeat both commands.

- [ ] **Step 8: Commit tool factories**

Run:

```bash
git add src/domain/payments-tools.ts src/domain/risk-tools.ts src/domain/support-tools.ts src/domain/tools.test.ts
git commit -m "feat: add payment benchmark tools"
```

Expected: commit succeeds.

---

### Task 5: Prompts, LLM Client, and Agents

**Files:**
- Create: `src/prompts/v1.ts`
- Create: `src/llm/client.ts`
- Create: `src/agents/payments-worker.ts`
- Create: `src/agents/risk-worker.ts`
- Create: `src/agents/support-worker.ts`
- Create: `src/agents/assistant.ts`

- [ ] **Step 1: Write frozen prompts**

Create `src/prompts/v1.ts`:

```ts
import { RISK_BLOCK_THRESHOLD } from "../domain/risk.ts";

export const PROMPTS_VERSION = "v1";

export const ASSISTANT_PROMPT = `You are a payments operations assistant. Coordinate three specialist workers to handle the user's request.

Routing policy:
- Read-only questions about payments (status, history, "did my refund go through") -> transfer to support_worker.
- Mutations (charge, refund) with no fraud signal -> transfer to payments_worker.
- Anything mentioning fraud, suspicious activity, or unrecognised charges -> transfer to risk_worker FIRST, then payments_worker if a refund is warranted.

Rules:
- Hand off to one worker at a time. Wait for that worker's result before deciding the next step.
- Never invent payment_ids, amounts, card numbers, card_ids, or customer_ids. Use only values present in the user's request or in a worker's previous result.
- When all necessary work is complete, reply to the user with a concise plain-text summary. Do not invoke any further workers after replying.`;

export const PAYMENTS_WORKER_PROMPT = `You are the payments worker. You execute charges and refunds.

Tools: charge, refund.

Rules:
- Read the request and the supervisor's context carefully. Pass exact values from those sources as tool arguments.
- If a required value (payment_id, amount_cents, reason, customer_id, card_id) is missing, do not invent it: report what is missing and stop.
- After a successful tool call, summarise the outcome in one sentence and stop.`;

export const RISK_WORKER_PROMPT = `You are the risk worker. You assess fraud risk and block cards.

Tools: assess_risk, block_card.

Policy:
- Always call assess_risk first for any payment under suspicion.
- If the returned risk_score is greater than ${RISK_BLOCK_THRESHOLD}, also call block_card on the card associated with that payment.
- If the risk_score is ${RISK_BLOCK_THRESHOLD} or below, do not block.
- Report the score, the key signals, and whether the card was blocked, in one short paragraph. Stop.`;

export const SUPPORT_WORKER_PROMPT = `You are the support worker. You answer read-only questions about payments and customers.

Tools: get_payment_status, list_payments.

Rules:
- You may not mutate any state. If the user is asking for a charge, refund, or block, do not act: report that this is outside your scope.
- Always cite the exact payment_ids you looked up in your reply.
- Stop after answering.`;
```

- [ ] **Step 2: Write LLM client**

Create `src/llm/client.ts`:

```ts
import { ChatOpenAI } from "@langchain/openai";

export const DEFAULT_MODEL_ID = "Qwen3.5-9B-GGUF";
export const DEFAULT_BASE_URL = "http://localhost:13305/v1";

export type LlmConfig = {
  modelId?: string;
  baseUrl?: string;
  seed?: number;
};

export function createLemonadeChatModel(config: LlmConfig = {}) {
  return new ChatOpenAI({
    model: config.modelId ?? process.env.LEMONADE_MODEL ?? DEFAULT_MODEL_ID,
    apiKey: process.env.LEMONADE_API_KEY ?? "not-needed-for-local-lemonade",
    configuration: {
      baseURL: config.baseUrl ?? process.env.LEMONADE_BASE_URL ?? DEFAULT_BASE_URL
    },
    temperature: 0,
    topP: 1,
    maxTokens: 1024,
    timeout: 60_000,
    maxRetries: 2,
    modelKwargs: {
      seed: config.seed ?? 0
    }
  });
}
```

- [ ] **Step 3: Write worker factories**

Create `src/agents/payments-worker.ts`:

```ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { makePaymentsTools } from "../domain/payments-tools.ts";
import type { WorldStore } from "../domain/world-store.ts";
import { PAYMENTS_WORKER_PROMPT } from "../prompts/v1.ts";

export function createPaymentsWorker(llm: ReturnType<typeof import("../llm/client.ts").createLemonadeChatModel>, store: WorldStore) {
  return createReactAgent({
    llm,
    tools: [...makePaymentsTools(store)],
    prompt: PAYMENTS_WORKER_PROMPT,
    name: "payments_worker"
  });
}
```

Create `src/agents/risk-worker.ts`:

```ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { makeRiskTools } from "../domain/risk-tools.ts";
import type { WorldStore } from "../domain/world-store.ts";
import { RISK_WORKER_PROMPT } from "../prompts/v1.ts";

export function createRiskWorker(llm: ReturnType<typeof import("../llm/client.ts").createLemonadeChatModel>, store: WorldStore) {
  return createReactAgent({
    llm,
    tools: [...makeRiskTools(store)],
    prompt: RISK_WORKER_PROMPT,
    name: "risk_worker"
  });
}
```

Create `src/agents/support-worker.ts`:

```ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { makeSupportTools } from "../domain/support-tools.ts";
import type { WorldStore } from "../domain/world-store.ts";
import { SUPPORT_WORKER_PROMPT } from "../prompts/v1.ts";

export function createSupportWorker(llm: ReturnType<typeof import("../llm/client.ts").createLemonadeChatModel>, store: WorldStore) {
  return createReactAgent({
    llm,
    tools: [...makeSupportTools(store)],
    prompt: SUPPORT_WORKER_PROMPT,
    name: "support_worker"
  });
}
```

- [ ] **Step 4: Write assistant graph factory**

Create `src/agents/assistant.ts`:

```ts
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { createPaymentsWorker } from "./payments-worker.ts";
import { createRiskWorker } from "./risk-worker.ts";
import { createSupportWorker } from "./support-worker.ts";
import type { WorldStore } from "../domain/world-store.ts";
import { createLemonadeChatModel } from "../llm/client.ts";
import { ASSISTANT_PROMPT } from "../prompts/v1.ts";

export type AssistantGraphConfig = {
  seed: number;
  store: WorldStore;
};

export function createAssistantGraph(config: AssistantGraphConfig) {
  const llm = createLemonadeChatModel({ seed: config.seed });

  const workflow = createSupervisor({
    agents: [
      createPaymentsWorker(llm, config.store),
      createRiskWorker(llm, config.store),
      createSupportWorker(llm, config.store)
    ],
    llm,
    prompt: ASSISTANT_PROMPT,
    outputMode: "full_history",
    supervisorName: "assistant"
  });

  return workflow.compile({ name: "payment_agent_benchmark" });
}
```

- [ ] **Step 5: Run typecheck to catch LangGraph API drift**

Run:

```bash
bun run typecheck
```

Expected: PASS. If this fails because LangGraphJS 1.3.0 renamed `llm` to `model` for `createReactAgent`, change only the affected worker factory keys from `llm` to `model` and rerun typecheck.

- [ ] **Step 6: Run Biome**

Run:

```bash
bun run check
```

Expected: PASS. If Biome requests formatting, run `bun run format` and repeat `bun run check`.

- [ ] **Step 7: Commit prompts and agents**

Run:

```bash
git add src/prompts/v1.ts src/llm/client.ts src/agents
git commit -m "feat: wire supervisor and worker agents"
```

Expected: commit succeeds.

---

### Task 6: Dataset v1

**Files:**
- Create: `dataset/v1/_helpers.ts`
- Create: `dataset/v1/support-status-001.ts`
- Create: `dataset/v1/support-list-001.ts`
- Create: `dataset/v1/support-deflect-001.ts`
- Create: `dataset/v1/payments-refund-001.ts`
- Create: `dataset/v1/payments-charge-001.ts`
- Create: `dataset/v1/payments-not-found-001.ts`
- Create: `dataset/v1/risk-refund-001.ts`
- Create: `dataset/v1/risk-block-only-001.ts`
- Create: `dataset/v1/risk-low-score-001.ts`
- Create: `dataset/v1/support-then-payments-001.ts`
- Create: `dataset/v1/hallucination-trap-001.ts`
- Create: `dataset/v1/out-of-scope-001.ts`
- Create: `dataset/v1/index.ts`

- [ ] **Step 1: Write dataset helpers**

Create `dataset/v1/_helpers.ts`:

```ts
import type { ArgMatcher, BenchmarkRow, WorldState } from "../../src/types.ts";

export const now = "2026-05-23T00:00:00.000Z";

export const baseWorld: WorldState = {
  customers: [
    { id: "cus_001", name: "Ada Lovelace" },
    { id: "cus_007", name: "Grace Hopper" }
  ],
  cards: [
    { id: "card_001", customer_id: "cus_001", last4: "4242", blocked: false },
    { id: "card_007", customer_id: "cus_007", last4: "7777", blocked: false }
  ],
  payments: [
    {
      id: "pay_001",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 400000,
      currency: "USD",
      country: "BY",
      status: "captured",
      created_at: "2026-01-10T00:00:00.000Z"
    },
    {
      id: "pay_002",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 2500,
      currency: "USD",
      country: "US",
      status: "refunded",
      created_at: "2026-02-10T00:00:00.000Z"
    },
    {
      id: "pay_003",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 9999,
      currency: "USD",
      country: "US",
      status: "captured",
      created_at: "2026-03-10T00:00:00.000Z"
    },
    {
      id: "pay_007",
      customer_id: "cus_007",
      card_id: "card_007",
      amount_cents: 3000,
      currency: "USD",
      country: "US",
      status: "captured",
      created_at: "2026-04-10T00:00:00.000Z"
    }
  ]
};

export function cloneWorld(): WorldState {
  return structuredClone(baseWorld);
}

export function eq(value: unknown): ArgMatcher {
  return { kind: "eq", value };
}

export function approx(value: number, tolerance = 0): ArgMatcher {
  return { kind: "approx", value, tolerance };
}

export function regex(pattern: string): ArgMatcher {
  return { kind: "regex", pattern };
}

export function any(): ArgMatcher {
  return { kind: "any" };
}

export function row(input: BenchmarkRow): BenchmarkRow {
  return input;
}
```

- [ ] **Step 2: Write the 12 starter Row modules**

Create `dataset/v1/support-status-001.ts`:

```ts
import { cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "support-status-001",
  query: "Did my refund on pay_002 go through?",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["support"],
    tool_calls: [{ worker: "support", tool: "get_payment_status", args: { payment_id: eq("pay_002") } }]
  }
});
```

Create `dataset/v1/support-list-001.ts`:

```ts
import { cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "support-list-001",
  query: "Show me payments for customer cus_007.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["support"],
    tool_calls: [{ worker: "support", tool: "list_payments", args: { customer_id: eq("cus_007") } }]
  }
});
```

Create `dataset/v1/support-deflect-001.ts`:

```ts
import { approx, cloneWorld, eq, regex, row } from "./_helpers.ts";

export default row({
  id: "support-deflect-001",
  query: "Can support refund payment pay_003 for me?",
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
          reason: regex("refund|requested")
        }
      }
    ],
    final_world_state: { payments: [{ id: "pay_003", status: "refunded" }] }
  }
});
```

Create `dataset/v1/payments-refund-001.ts`:

```ts
import { approx, cloneWorld, eq, regex, row } from "./_helpers.ts";

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
          reason: regex("refund|requested")
        }
      }
    ],
    final_world_state: { payments: [{ id: "pay_003", status: "refunded" }] }
  }
});
```

Create `dataset/v1/payments-charge-001.ts`:

```ts
import { approx, cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "payments-charge-001",
  query: "Charge $25.00 to card_id card_001 for customer cus_001 from the US.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["payments"],
    tool_calls: [
      {
        worker: "payments",
        tool: "charge",
        args: {
          customer_id: eq("cus_001"),
          card_id: eq("card_001"),
          amount_cents: approx(2500),
          country: eq("US")
        }
      }
    ]
  }
});
```

Create `dataset/v1/payments-not-found-001.ts`:

```ts
import { approx, cloneWorld, eq, regex, row } from "./_helpers.ts";

export default row({
  id: "payments-not-found-001",
  query: "Refund pay_999 for $10.00.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["payments"],
    tool_calls: [
      {
        worker: "payments",
        tool: "refund",
        args: {
          payment_id: eq("pay_999"),
          amount_cents: approx(1000),
          reason: regex("refund|requested")
        }
      }
    ]
  }
});
```

Create `dataset/v1/risk-refund-001.ts`:

```ts
import { any, approx, cloneWorld, eq, regex, row } from "./_helpers.ts";

export default row({
  id: "risk-refund-001",
  query: "There's a $4,000 charge from Belarus on payment pay_001, refund it.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["risk", "payments"],
    tool_calls: [
      { worker: "risk", tool: "assess_risk", args: { payment_id: eq("pay_001") } },
      { worker: "risk", tool: "block_card", args: { card_id: eq("card_001"), reason: any() } },
      {
        worker: "payments",
        tool: "refund",
        args: {
          payment_id: eq("pay_001"),
          amount_cents: approx(400000),
          reason: regex("fraud|suspicious|risk")
        }
      }
    ],
    final_world_state: {
      payments: [{ id: "pay_001", status: "refunded" }],
      cards: [{ id: "card_001", blocked: true }]
    }
  }
});
```

Create `dataset/v1/risk-block-only-001.ts`:

```ts
import { any, cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "risk-block-only-001",
  query: "I think someone has my card for payment pay_001. Check it and block the card if risky.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["risk"],
    tool_calls: [
      { worker: "risk", tool: "assess_risk", args: { payment_id: eq("pay_001") } },
      { worker: "risk", tool: "block_card", args: { card_id: eq("card_001"), reason: any() } }
    ],
    final_world_state: { cards: [{ id: "card_001", blocked: true }] }
  }
});
```

Create `dataset/v1/risk-low-score-001.ts`:

```ts
import { cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "risk-low-score-001",
  query: "Is payment pay_007 a weird charge?",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["risk"],
    tool_calls: [{ worker: "risk", tool: "assess_risk", args: { payment_id: eq("pay_007") } }],
    final_world_state: { cards: [{ id: "card_007", blocked: false }] }
  }
});
```

Create `dataset/v1/support-then-payments-001.ts`:

```ts
import { any, approx, cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "support-then-payments-001",
  query: "Refund my last charge for customer cus_007.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["support", "payments"],
    tool_calls: [
      { worker: "support", tool: "list_payments", args: { customer_id: eq("cus_007") } },
      {
        worker: "payments",
        tool: "refund",
        args: { payment_id: eq("pay_007"), amount_cents: approx(3000), reason: any() }
      }
    ],
    final_world_state: { payments: [{ id: "pay_007", status: "refunded" }] }
  }
});
```

Create `dataset/v1/hallucination-trap-001.ts`:

```ts
import { cloneWorld, row } from "./_helpers.ts";

export default row({
  id: "hallucination-trap-001",
  query: "Refund my charge.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["payments"],
    tool_calls: []
  }
});
```

Create `dataset/v1/out-of-scope-001.ts`:

```ts
import { cloneWorld, row } from "./_helpers.ts";

export default row({
  id: "out-of-scope-001",
  query: "Send Bob $50.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: [],
    tool_calls: []
  }
});
```

- [ ] **Step 3: Write dataset index**

Create `dataset/v1/index.ts`:

```ts
import hallucinationTrap001 from "./hallucination-trap-001.ts";
import outOfScope001 from "./out-of-scope-001.ts";
import paymentsCharge001 from "./payments-charge-001.ts";
import paymentsNotFound001 from "./payments-not-found-001.ts";
import paymentsRefund001 from "./payments-refund-001.ts";
import riskBlockOnly001 from "./risk-block-only-001.ts";
import riskLowScore001 from "./risk-low-score-001.ts";
import riskRefund001 from "./risk-refund-001.ts";
import supportDeflect001 from "./support-deflect-001.ts";
import supportList001 from "./support-list-001.ts";
import supportStatus001 from "./support-status-001.ts";
import supportThenPayments001 from "./support-then-payments-001.ts";

export const DATASET_VERSION = "v1";

export const rows = [
  supportStatus001,
  supportList001,
  supportDeflect001,
  paymentsRefund001,
  paymentsCharge001,
  paymentsNotFound001,
  riskRefund001,
  riskBlockOnly001,
  riskLowScore001,
  supportThenPayments001,
  hallucinationTrap001,
  outOfScope001
];
```

- [ ] **Step 4: Typecheck dataset**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run Biome**

Run:

```bash
bun run check
```

Expected: PASS. If Biome requests formatting, run `bun run format` and repeat `bun run check`.

- [ ] **Step 6: Commit dataset**

Run:

```bash
git add dataset/v1
git commit -m "feat: add v1 benchmark dataset"
```

Expected: commit succeeds.

---

### Task 7: Scoring Engine

**Files:**
- Create: `src/harness/score.ts`
- Create: `src/harness/score.test.ts`

- [ ] **Step 1: Write failing score tests**

Create `src/harness/score.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { scoreRun } from "./score.ts";
import { eq } from "../../dataset/v1/_helpers.ts";
import type { BenchmarkRow, ObservedToolCall, WorldState } from "../types.ts";

const world: WorldState = {
  customers: [{ id: "cus_001", name: "Ada" }],
  cards: [{ id: "card_001", customer_id: "cus_001", last4: "4242", blocked: true }],
  payments: [
    {
      id: "pay_001",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 400000,
      currency: "USD",
      country: "BY",
      status: "refunded",
      created_at: "2026-01-10T00:00:00.000Z"
    }
  ]
};

describe("scoreRun", () => {
  test("passes when route, tool call, world state, and completion match", () => {
    const row: BenchmarkRow = {
      id: "row",
      query: "refund pay_001",
      world_state_seed: world,
      expected: {
        workers: ["risk", "payments"],
        tool_calls: [
          { worker: "risk", tool: "assess_risk", args: { payment_id: eq("pay_001") } },
          { worker: "payments", tool: "refund", args: { payment_id: eq("pay_001") } }
        ],
        final_world_state: {
          payments: [{ id: "pay_001", status: "refunded" }],
          cards: [{ id: "card_001", blocked: true }]
        }
      }
    };

    const calls: ObservedToolCall[] = [
      { worker: "risk", tool: "assess_risk", args: { payment_id: "pay_001" }, result: {} },
      { worker: "payments", tool: "refund", args: { payment_id: "pay_001" }, result: {} }
    ];

    const score = scoreRun({
      row,
      route: ["risk", "payments"],
      toolCalls: calls,
      finalWorldState: world,
      completionFailure: null
    });

    expect(score.overall).toBe(true);
  });

  test("fails routing when actual route order differs", () => {
    const row: BenchmarkRow = {
      id: "row",
      query: "refund pay_001",
      world_state_seed: world,
      expected: {
        workers: ["risk", "payments"],
        tool_calls: []
      }
    };

    const score = scoreRun({
      row,
      route: ["payments", "risk"],
      toolCalls: [],
      finalWorldState: world,
      completionFailure: null
    });

    expect(score.routing.passed).toBe(false);
    expect(score.overall).toBe(false);
  });
});
```

- [ ] **Step 2: Run score tests to verify failure**

Run:

```bash
bun test src/harness/score.test.ts
```

Expected: FAIL because `src/harness/score.ts` does not exist.

- [ ] **Step 3: Implement scoring**

Create `src/harness/score.ts`:

```ts
import { argsMatch, partialWorldMatches } from "./matchers.ts";
import type {
  AxisScore,
  BenchmarkRow,
  CompletionFailure,
  ObservedToolCall,
  RowScore,
  WorkerName,
  WorldState
} from "../types.ts";

export type ScoreRunInput = {
  row: BenchmarkRow;
  route: WorkerName[];
  toolCalls: ObservedToolCall[];
  finalWorldState: WorldState;
  completionFailure: CompletionFailure | null;
};

export function scoreRun(input: ScoreRunInput): RowScore {
  const routing = scoreRouting(input.row.expected.workers, input.route);
  const toolSelection = scoreToolSelection(input.row.expected.tool_calls, input.toolCalls);
  const toolArgs = scoreToolArgs(input.row.expected.tool_calls, input.toolCalls);
  const worldState = partialWorldMatches(input.finalWorldState, input.row.expected.final_world_state);
  const completion = input.completionFailure
    ? {
        passed: false,
        failure: input.completionFailure,
        details: `completion failed: ${input.completionFailure}`
      }
    : { passed: true, details: "completed cleanly" };

  return {
    routing,
    tool_selection: toolSelection,
    tool_args: toolArgs,
    world_state: worldState,
    completion,
    overall:
      routing.passed &&
      toolSelection.passed &&
      toolArgs.passed &&
      worldState.passed &&
      completion.passed
  };
}

export function collapseConsecutiveDuplicates(route: WorkerName[]): WorkerName[] {
  const collapsed: WorkerName[] = [];

  for (const worker of route) {
    if (collapsed.at(-1) !== worker) {
      collapsed.push(worker);
    }
  }

  return collapsed;
}

function scoreRouting(expected: WorkerName[], actual: WorkerName[]): AxisScore {
  const collapsed = collapseConsecutiveDuplicates(actual);
  if (JSON.stringify(expected) === JSON.stringify(collapsed)) {
    return { passed: true, details: `route matched: ${collapsed.join(" -> ") || "none"}` };
  }

  return {
    passed: false,
    details: `expected route ${expected.join(" -> ") || "none"}, got ${collapsed.join(" -> ") || "none"}`
  };
}

function scoreToolSelection(
  expected: BenchmarkRow["expected"]["tool_calls"],
  actual: ObservedToolCall[]
): AxisScore {
  for (const call of expected) {
    const found = actual.some((observed) => observed.worker === call.worker && observed.tool === call.tool);
    if (!found) {
      return { passed: false, details: `missing ${call.worker}.${call.tool}` };
    }
  }

  return { passed: true, details: "all expected tools were selected" };
}

function scoreToolArgs(
  expected: BenchmarkRow["expected"]["tool_calls"],
  actual: ObservedToolCall[]
): AxisScore {
  for (const call of expected) {
    const candidates = actual.filter(
      (observed) => observed.worker === call.worker && observed.tool === call.tool
    );
    const match = candidates.find((candidate) => argsMatch(candidate.args, call.args).passed);

    if (!match) {
      return {
        passed: false,
        details: `no argument match for ${call.worker}.${call.tool}`
      };
    }
  }

  return { passed: true, details: "all expected tool arguments matched" };
}
```

- [ ] **Step 4: Run score tests**

Run:

```bash
bun test src/harness/score.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run project checks**

Run:

```bash
bun run typecheck
bun run check
```

Expected: PASS. If Biome requests formatting, run `bun run format` and repeat both commands.

- [ ] **Step 6: Commit scoring**

Run:

```bash
git add src/harness/score.ts src/harness/score.test.ts
git commit -m "feat: add benchmark scoring"
```

Expected: commit succeeds.

---

### Task 8: Trace Extraction and Row Runner

**Files:**
- Create: `src/harness/hash.ts`
- Create: `src/harness/trace.ts`
- Create: `src/harness/run.ts`

- [ ] **Step 1: Write deterministic hash helper**

Create `src/harness/hash.ts`:

```ts
export function hashRowId(rowId: string): number {
  let hash = 2166136261;

  for (const char of rowId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
```

- [ ] **Step 2: Write trace extraction helpers**

Create `src/harness/trace.ts`:

```ts
import type { ObservedToolCall, WorkerName } from "../types.ts";

const handoffPattern = /^transfer_to_(payments|risk|support)_worker$/;

export type TraceObservation = {
  route: WorkerName[];
  toolCalls: ObservedToolCall[];
  messages: unknown[];
  stepCounts: {
    supervisor: number;
    per_worker: Record<WorkerName, number>;
  };
};

export function createEmptyObservation(): TraceObservation {
  return {
    route: [],
    toolCalls: [],
    messages: [],
    stepCounts: {
      supervisor: 0,
      per_worker: { payments: 0, risk: 0, support: 0 }
    }
  };
}

export function observeUpdate(observation: TraceObservation, update: unknown): TraceObservation {
  const text = JSON.stringify(update);

  for (const match of text.matchAll(/"name":"([^"]+)"/g)) {
    const toolName = match[1];
    const handoff = toolName.match(handoffPattern);
    if (handoff?.[1]) {
      observation.route.push(handoff[1] as WorkerName);
    }
  }

  observation.messages.push(update);
  return observation;
}
```

- [ ] **Step 3: Write Row runner**

Create `src/harness/run.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAssistantGraph } from "../agents/assistant.ts";
import { WorldStore } from "../domain/world-store.ts";
import { DEFAULT_MODEL_ID } from "../llm/client.ts";
import { PROMPTS_VERSION } from "../prompts/v1.ts";
import type { BenchmarkRow, CompletionFailure, RowTrace } from "../types.ts";
import { hashRowId } from "./hash.ts";
import { scoreRun } from "./score.ts";
import { createEmptyObservation, observeUpdate } from "./trace.ts";

export type RunRowOptions = {
  datasetVersion: string;
  outputDir: string;
  commit: string | null;
};

export async function runRow(row: BenchmarkRow, options: RunRowOptions): Promise<RowTrace> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const store = new WorldStore(row.world_state_seed, "2026-05-23T00:00:00.000Z");
  const seed = hashRowId(row.id);
  const graph = createAssistantGraph({ seed, store });
  const observation = createEmptyObservation();
  let completionFailure: CompletionFailure | null = null;

  try {
    const stream = await graph.stream(
      { messages: [{ role: "user", content: row.query }] },
      { streamMode: "updates", recursionLimit: 40 }
    );

    for await (const update of stream) {
      observeUpdate(observation, update);
    }
  } catch (error) {
    completionFailure = "error_thrown";
    observation.messages.push({
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const finished = Date.now();
  const finalWorldState = store.snapshot();
  const score = scoreRun({
    row,
    route: observation.route,
    toolCalls: observation.toolCalls,
    finalWorldState,
    completionFailure
  });

  const trace: RowTrace = {
    row_id: row.id,
    started_at: startedAt,
    finished_at: new Date(finished).toISOString(),
    duration_ms: finished - started,
    model_id: process.env.LEMONADE_MODEL ?? DEFAULT_MODEL_ID,
    prompts_version: PROMPTS_VERSION,
    dataset_version: options.datasetVersion,
    commit: options.commit,
    query: row.query,
    world_state_seed: row.world_state_seed,
    route: observation.route,
    tool_calls: observation.toolCalls,
    world_state_log: store.mutations(),
    final_world_state: finalWorldState,
    messages: observation.messages,
    expected: row.expected,
    score,
    warnings: [],
    step_counts: observation.stepCounts
  };

  const traceDir = join(options.outputDir, "traces");
  await mkdir(traceDir, { recursive: true });
  await writeFile(join(traceDir, `${row.id}.json`), `${JSON.stringify(trace, null, 2)}\n`);

  return trace;
}
```

- [ ] **Step 4: Typecheck runner**

Run:

```bash
bun run typecheck
```

Expected: PASS. If `graph.stream` return types changed in LangGraphJS 1.3.0, update only the local `runRow` stream loop to match the installed type signature and keep the trace shape unchanged.

- [ ] **Step 5: Run Biome**

Run:

```bash
bun run check
```

Expected: PASS. If Biome requests formatting, run `bun run format` and repeat `bun run check`.

- [ ] **Step 6: Commit runner**

Run:

```bash
git add src/harness/hash.ts src/harness/trace.ts src/harness/run.ts
git commit -m "feat: add row runner and trace output"
```

Expected: commit succeeds.

---

### Task 9: Report Aggregation and CLI

**Files:**
- Create: `src/harness/report.ts`
- Create: `src/cli.ts`

- [ ] **Step 1: Write report aggregation**

Create `src/harness/report.ts`:

```ts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RowTrace } from "../types.ts";

type AxisName = "routing" | "tool_selection" | "tool_args" | "world_state" | "completion";

export type Summary = {
  total_rows: number;
  passed_rows: number;
  failed_rows: number;
  pass_rate: number;
  axis_pass_rates: Record<AxisName, number>;
  row_results: Array<{
    row_id: string;
    passed: boolean;
    duration_ms: number;
  }>;
};

export async function writeSummary(outputDir: string, traces: RowTrace[]): Promise<Summary> {
  const axes: AxisName[] = ["routing", "tool_selection", "tool_args", "world_state", "completion"];
  const total = traces.length;
  const passed = traces.filter((trace) => trace.score.overall).length;

  const summary: Summary = {
    total_rows: total,
    passed_rows: passed,
    failed_rows: total - passed,
    pass_rate: ratio(passed, total),
    axis_pass_rates: Object.fromEntries(
      axes.map((axis) => [
        axis,
        ratio(
          traces.filter((trace) => trace.score[axis].passed).length,
          total
        )
      ])
    ) as Record<AxisName, number>,
    row_results: traces.map((trace) => ({
      row_id: trace.row_id,
      passed: trace.score.overall,
      duration_ms: trace.duration_ms
    }))
  };

  await writeFile(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}
```

- [ ] **Step 2: Write CLI**

Create `src/cli.ts`:

```ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DATASET_VERSION, rows } from "../dataset/v1/index.ts";
import { runRow } from "./harness/run.ts";
import { writeSummary } from "./harness/report.ts";

type CliOptions = {
  rowId: string | null;
  outputDir: string;
};

const options = parseArgs(Bun.argv.slice(2));
await mkdir(options.outputDir, { recursive: true });

const selectedRows = options.rowId ? rows.filter((row) => row.id === options.rowId) : rows;

if (options.rowId && selectedRows.length === 0) {
  console.error(`Unknown row id: ${options.rowId}`);
  process.exit(1);
}

const commit = await currentCommit();
const traces = [];

for (const row of selectedRows) {
  console.log(`running ${row.id}`);
  traces.push(
    await runRow(row, {
      datasetVersion: DATASET_VERSION,
      outputDir: options.outputDir,
      commit
    })
  );
}

const summary = await writeSummary(options.outputDir, traces);
console.log(JSON.stringify(summary, null, 2));

function parseArgs(args: string[]): CliOptions {
  let rowId: string | null = null;
  let outputDir = join("runs", new Date().toISOString().replaceAll(":", "-"));

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--row") {
      rowId = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      outputDir = args[index + 1] ?? outputDir;
      index += 1;
      continue;
    }
    if (arg === "--dataset") {
      const dataset = args[index + 1];
      if (dataset !== "v1") {
        console.error(`Unsupported dataset: ${dataset}`);
        process.exit(1);
      }
      index += 1;
    }
  }

  return { rowId, outputDir };
}

async function currentCommit(): Promise<string | null> {
  const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return null;
  }

  return output.trim();
}
```

- [ ] **Step 3: Typecheck CLI**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run unit tests**

Run:

```bash
bun test
```

Expected: PASS.

- [ ] **Step 5: Run Biome**

Run:

```bash
bun run check
```

Expected: PASS. If Biome requests formatting, run `bun run format` and repeat `bun run check`.

- [ ] **Step 6: Commit CLI and reporting**

Run:

```bash
git add src/harness/report.ts src/cli.ts
git commit -m "feat: add benchmark cli and reports"
```

Expected: commit succeeds.

---

### Task 10: End-to-End Smoke Run

**Files:**
- Modify only if needed after the smoke run identifies a type/API mismatch:
  - `src/agents/*.ts`
  - `src/harness/run.ts`
  - `src/harness/trace.ts`

- [ ] **Step 1: Start Lemonade server outside this process**

Run the local LLM server so the OpenAI-compatible endpoint is available:

```bash
curl http://localhost:13305/v1/models
```

Expected: JSON response listing a model compatible with `Qwen3.5-9B-GGUF`.

- [ ] **Step 2: Run one read-only Row**

Run:

```bash
bun run bench --row support-status-001 --out runs/smoke-support-status
```

Expected:
- CLI prints `running support-status-001`.
- `runs/smoke-support-status/summary.json` exists.
- `runs/smoke-support-status/traces/support-status-001.json` exists.
- `summary.json.total_rows` is `1`.

- [ ] **Step 3: Inspect summary output**

Run:

```bash
bun -e 'const s = await import("./runs/smoke-support-status/summary.json"); console.log(s.default)'
```

Expected: printed summary object has `total_rows: 1`, numeric `pass_rate`, and axis rates for `routing`, `tool_selection`, `tool_args`, `world_state`, and `completion`.

- [ ] **Step 4: Run one multi-worker Row**

Run:

```bash
bun run bench --row risk-refund-001 --out runs/smoke-risk-refund
```

Expected:
- CLI prints `running risk-refund-001`.
- `runs/smoke-risk-refund/traces/risk-refund-001.json` exists.
- The trace contains the original `query`, the `world_state_seed`, a `final_world_state`, and a `score`.

- [ ] **Step 5: Run full unit suite after smoke fixes**

Run:

```bash
bun test
bun run typecheck
bun run check
```

Expected: PASS for all three commands.

- [ ] **Step 6: Commit smoke-run fixes**

Run:

```bash
git add src dataset package.json tsconfig.json biome.json .gitignore
git commit -m "fix: align benchmark with langgraph runtime"
```

Expected: commit succeeds if files changed. If no files changed, skip this commit.

---

## Self-Review

Spec coverage:
- Bun, Biome, TypeScript: Task 1.
- LangGraphJS latest and `createSupervisor`: Task 5.
- Local OpenAI-compatible Lemonade endpoint at `http://localhost:13305/v1`: Task 5 and Task 10.
- Hierarchical Assistant -> Worker hand-off: Task 5.
- Payment benchmark domain: Tasks 3, 4, and 6.
- Tool-calling Workers and structured tool Results: Tasks 3 and 4.
- Dataset, trace, scoring, and reporting: Tasks 6 through 9.
- Operational prompts with risk threshold: Task 5.
- End-to-end benchmark run: Task 10.

Placeholder scan:
- The plan avoids undefined file paths, undefined function names, and unspecified test expectations.
- The only conditional instruction is for upstream LangGraph API drift; it gives the exact local key rename to try and keeps the public file shapes stable.

Type consistency:
- `WorkerName` values are `payments`, `risk`, and `support`.
- LangGraph agent names are `payments_worker`, `risk_worker`, and `support_worker`.
- Expected routes use domain Worker names; hand-off extraction maps `transfer_to_<worker>_worker` into the domain Worker names.
- Shared type names (`BenchmarkRow`, `WorldState`, `ArgMatcher`, `RowTrace`, `RowScore`) are introduced in Task 2 and reused consistently.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-23-payment-agent-benchmark.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
