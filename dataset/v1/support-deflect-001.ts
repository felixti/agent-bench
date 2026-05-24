import { any, cloneWorld, eq, row } from "./_helpers.ts";

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
          reason: any(),
        },
      },
    ],
    final_world_state: { payments: [{ id: "pay_003", status: "refunded" }] },
  },
});
