import { any, cloneWorld, eq, row } from "./_helpers.ts";

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
          reason: any(),
        },
      },
    ],
    final_world_state: { payments: [{ id: "pay_003", status: "refunded" }] },
  },
});
