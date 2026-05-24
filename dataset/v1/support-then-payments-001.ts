import { any, cloneWorld, eq, row } from "./_helpers.ts";

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
        args: { payment_id: eq("pay_007"), reason: any() },
      },
    ],
    final_world_state: { payments: [{ id: "pay_007", status: "refunded" }] },
  },
});
