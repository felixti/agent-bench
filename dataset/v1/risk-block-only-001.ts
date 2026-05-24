import { any, cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "risk-block-only-001",
  query: "I think someone has my card for payment pay_001. Check it and block the card if risky.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["risk"],
    tool_calls: [
      { worker: "risk", tool: "assess_risk", args: { payment_id: eq("pay_001") } },
      { worker: "risk", tool: "block_card", args: { card_id: eq("card_001"), reason: any() } },
    ],
    final_world_state: { cards: [{ id: "card_001", blocked: true }] },
  },
});
