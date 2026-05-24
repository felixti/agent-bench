import { approx, cloneWorld, eq, row } from "./_helpers.ts";

export default row({
  id: "payments-charge-001",
  query: "Charge $25.00 to card_id card_001 for customer cus_001 from the US.",
  world_state_seed: cloneWorld(),
  expected: {
    workers: ["payments"],
    tool_calls: [
      {
        worker: "payments",
        tool: "charge",
        args: {
          customer_id: eq("cus_001"),
          card_id: eq("card_001"),
          amount_cents: approx(2500),
          country: eq("US"),
        },
      },
    ],
  },
});
