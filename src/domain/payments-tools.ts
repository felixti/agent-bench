import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { WorldStore } from "./world-store.ts";

export function makePaymentsTools(store: WorldStore) {
  const charge = tool(async (input) => JSON.stringify(store.charge(input)), {
    name: "charge",
    description: "Charge a customer's card for an amount in cents.",
    schema: z.object({
      customer_id: z.string(),
      card_id: z.string(),
      amount_cents: z.number().int().positive(),
      country: z.string().length(2),
    }),
  });

  const refund = tool(
    async ({ payment_id, amount_cents, reason }) =>
      JSON.stringify(store.refund(payment_id, amount_cents, reason)),
    {
      name: "refund",
      description:
        "Refund an existing captured payment in full. Include amount_cents only when the user provided an explicit amount.",
      schema: z.object({
        payment_id: z.string(),
        amount_cents: z.number().int().positive().optional(),
        reason: z
          .string()
          .describe(
            "Short human-readable reason for the refund. Infer from the user's refund request when they did not give explicit wording.",
          ),
      }),
    },
  );

  return [charge, refund] as const;
}
