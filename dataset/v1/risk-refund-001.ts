import { any, cloneWorld, eq, regex, row } from "./_helpers.ts";

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
          reason: regex("fraud|suspicious|risk"),
        },
      },
    ],
    final_world_state: {
      payments: [{ id: "pay_001", status: "refunded" }],
      cards: [{ id: "card_001", blocked: true }],
    },
  },
});
