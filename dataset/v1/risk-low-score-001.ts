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
