import { cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "support-status-001",
  query: "Did my refund on pay_002 go through?",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["support"],
    tool_calls: [
      { worker: "support", tool: "get_payment_status", args: { payment_id: eq("pay_002") } },
    ],
  },
});
