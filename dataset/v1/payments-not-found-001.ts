import { any, approx, cloneWorld, eq, row } from "./_helpers.ts";

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
          reason: any(),
        },
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
