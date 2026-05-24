import { describe, expect, test } from "bun:test";
import type { WorldState } from "../types.ts";
import { makePaymentsTools } from "./payments-tools.ts";
import { makeRiskTools } from "./risk-tools.ts";
import { makeSupportTools } from "./support-tools.ts";
import { WorldStore } from "./world-store.ts";

const seed: WorldState = {
  customers: [{ id: "cus_001", name: "Ada Lovelace" }],
  cards: [{ id: "card_001", customer_id: "cus_001", last4: "4242", blocked: false }],
  payments: [
    {
      id: "pay_001",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 400000,
      currency: "USD",
      country: "BY",
      status: "captured",
      created_at: "2026-01-10T00:00:00.000Z",
    },
  ],
};

describe("domain tools", () => {
  test("payments refund tool returns structured success", async () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");
    const [charge, refund] = makePaymentsTools(store);

    expect(charge.name).toBe("charge");
    const result = await refund.invoke({
      payment_id: "pay_001",
      amount_cents: 400000,
      reason: "suspected fraud",
    });

    expect(result).toContain('"ok":true');
    expect(store.snapshot().payments[0]?.status).toBe("refunded");
  });

  test("payments refund tool can refund in full without amount_cents", async () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");
    const [, refund] = makePaymentsTools(store);

    const result = await refund.invoke({
      payment_id: "pay_001",
      reason: "customer requested refund",
    });

    expect(result).toContain('"ok":true');
    expect(store.snapshot().payments[0]?.status).toBe("refunded");
  });

  test("risk assess tool returns deterministic score", async () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");
    const [assessRisk] = makeRiskTools(store);

    const result = await assessRisk.invoke({ payment_id: "pay_001" });

    expect(result).toContain('"risk_score":0.9');
    expect(result).toContain('"geo_anomaly"');
  });

  test("support get status tool returns payment data", async () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");
    const [getPaymentStatus] = makeSupportTools(store);

    const result = await getPaymentStatus.invoke({ payment_id: "pay_001" });

    expect(result).toContain('"status":"captured"');
  });
});
