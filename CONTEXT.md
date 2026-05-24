# Payment Multi-Agent Benchmark

A benchmark harness that exercises a hierarchical multi-agent topology against a local OpenAI-compatible LLM (Lemonade, `http://localhost:13305`). The payments domain is the *workload*; the goal is to measure how reliably the Assistant routes Queries and how correctly each Worker executes its tools — not to move money.

## Language

### Roles

**Assistant**:
The single client-facing agent that receives the Query, classifies it into an Intent, delegates to one or more Workers, and composes the final Response. There is exactly one Assistant per run.
_Avoid_: Supervisor, router, orchestrator, manager.

**Worker**:
A specialised sub-agent that owns a distinct tool surface and runs its own tool-calling loop. A Worker is invoked by the Assistant, returns a Result to the Assistant, and never addresses the Client directly.
_Avoid_: Expertise, sub-agent, expert, specialist.

**Client**:
The benchmark harness on the other side of the Assistant — concretely, a test driver feeding Queries from a dataset. There is no human user and no HTTP caller in this system.
_Avoid_: User, caller, consumer.

### Inputs and Outputs

**Query**:
The raw free-text string from the Client. Always a string; never structured.
_Avoid_: Prompt, message, request.

**Intent**:
The Assistant's classified routing decision derived from a Query — i.e. which Worker(s) should handle it and in what order. Internal to the system; not visible to the Client.
_Avoid_: PaymentIntent (explicitly NOT Stripe's PaymentIntent), goal, task.

**Result**:
A Worker's structured output handed back to the Assistant. Always returns to the Assistant; never to the Client.
_Avoid_: Reply, answer (these are reserved for the Response).

**Response**:
The final natural-language message the Assistant sends to the Client after consuming one or more Results.
_Avoid_: Reply, answer.

### Workers

**Payments worker**:
Owns mutating money operations. Tools: `charge`, `refund`.

**Risk worker**:
Owns fraud and risk decisions. Tools: `assess_risk`, `block_card`.

**Support worker**:
Owns read-only payment data. Tools: `get_payment_status`, `list_payments`.

### Benchmark

**Row**:
A single self-contained benchmark unit, consisting of a Query, a World State seed, and the Expected route + tool calls. Rows are independent — no Row depends on another.
_Avoid_: Test case, sample, example.

**World State**:
The simulated payments universe a Row runs against — payments, cards, customers, etc. Each Row starts from its own seed and mutations are isolated to that Row's run.
_Avoid_: Database, fixture, world.

**Expected route**:
The ordered sequence of Workers a Row asserts the Assistant must invoke. Order-sensitive.
_Avoid_: Plan, trajectory, path.

**Score**:
A per-Row vector across five axes — `routing`, `tool_selection`, `tool_args`, `world_state`, `completion` — plus an overall pass/fail (all axes pass).
_Avoid_: Result (Result is the Worker's output to the Assistant), grade.

## Flagged ambiguities

- **"Intent" vs Stripe's `PaymentIntent`.** In this system, *Intent* is the Assistant's routing classification. It is never a payment-lifecycle object. If we ever need that concept it will be named `Charge` or `PaymentRecord`.
- **"Expertise" / "worker" / "sub-agent".** Used interchangeably in the original brief. Canonical term is **Worker**.
- **"Supervisor" vs "Assistant".** Both were used. Canonical term is **Assistant** (it matches the client-facing framing); *Supervisor* is reserved for code-level naming if it appears in LangGraph idioms, but the domain term is Assistant.

## Example dialogue

**Dev**: The Client sends *"there's a $4,000 charge from Belarus, refund it"*. What happens?
**Domain**: That string is the Query. The Assistant runs an LLM classification and emits an Intent — here, route first to Risk, then to Payments.
**Dev**: Does the Risk worker reply to the Client?
**Domain**: No. Risk returns a Result to the Assistant — say `{ risk_score: 0.92, recommended_action: "block_and_refund" }`. The Assistant then delegates to Payments, gets another Result, and only then composes a Response for the Client.
**Dev**: So the Assistant always speaks last?
**Domain**: Always. Workers never address the Client directly.
**Dev**: And what if the user just asks *"did my refund go through?"*
**Domain**: That's a read. Assistant routes to Support, gets a Result with the payment status, and Responds. Payments is not involved — Payments is for mutations only.

## Revision history

- **2026-05-23 — V1 fairness pass.** Removed prompt and tool-schema steering that caused models to emit `reason: "risk"` on every refund, regardless of fraud context. Relaxed the `reason` matcher to `any()` on non-risk refund rows and made refund amount optional so Workers can refund by `payment_id` without hidden world-state knowledge. Added an out-of-scope refusal rule and a lookup-first rule to the supervisor prompt. Redesigned `payments-not-found-001` to expect a safe `payments_worker.refund` `not_found` result with no world-state mutation. All `runs/` and `benchmarks/` snapshots created before this date were discarded. Dataset and prompt version labels remain `v1`.
