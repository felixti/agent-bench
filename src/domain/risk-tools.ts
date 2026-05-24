import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { scoreRisk } from "./risk.ts";
import type { WorldStore } from "./world-store.ts";

export function makeRiskTools(store: WorldStore) {
  const assessRisk = tool(
    async ({ payment_id }) => {
      const payment = store.getPayment(payment_id);
      if (!payment) {
        return JSON.stringify({
          ok: false,
          error: { code: "not_found", message: `payment ${payment_id} not found` },
        });
      }

      return JSON.stringify({ ok: true, data: scoreRisk(payment) });
    },
    {
      name: "assess_risk",
      description: "Assess fraud risk for an existing payment.",
      schema: z.object({
        payment_id: z.string().describe("Payment id to assess; required before any response."),
      }),
    },
  );

  const blockCard = tool(
    async ({ card_id, reason }) => JSON.stringify(store.blockCard(card_id, reason)),
    {
      name: "block_card",
      description: "Block a card when the risk policy says the card should no longer be used.",
      schema: z.object({
        card_id: z.string(),
        reason: z.string(),
      }),
    },
  );

  return [assessRisk, blockCard] as const;
}
