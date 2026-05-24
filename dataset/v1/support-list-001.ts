import { cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "support-list-001",
  query: "Show me payments for customer cus_007.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["support"],
    tool_calls: [
      { worker: "support", tool: "list_payments", args: { customer_id: eq("cus_007") } },
    ],
  },
});
