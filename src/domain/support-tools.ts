import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { WorldStore } from "./world-store.ts";

export function makeSupportTools(store: WorldStore) {
  const getPaymentStatus = tool(
    async ({ payment_id }) => JSON.stringify(store.getPaymentStatus(payment_id)),
    {
      name: "get_payment_status",
      description: "Look up a payment by id and return its current status and details.",
      schema: z.object({
        payment_id: z.string(),
      }),
    },
  );

  const listPayments = tool(
    async ({ customer_id }) => JSON.stringify(store.listPayments(customer_id)),
    {
      name: "list_payments",
      description: "List payments belonging to a customer.",
      schema: z.object({
        customer_id: z.string(),
      }),
    },
  );

  return [getPaymentStatus, listPayments] as const;
}
