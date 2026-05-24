import { describe, expect, test } from "bun:test";
import type { Payment } from "../types.ts";
import { RISK_BLOCK_THRESHOLD, scoreRisk } from "./risk.ts";

const basePayment: Payment = {
  id: "pay_001",
  customer_id: "cus_001",
  card_id: "card_001",
  amount_cents: 3000,
  currency: "USD",
  country: "US",
  status: "captured",
  created_at: "2026-01-10T00:00:00.000Z",
};

describe("scoreRisk", () => {
  test("returns low score for small domestic payment", () => {
    const risk = scoreRisk(basePayment);

    expect(risk.risk_score).toBeLessThanOrEqual(RISK_BLOCK_THRESHOLD);
    expect(risk.signals).toEqual(["baseline"]);
  });

  test("returns high score for large payment from elevated-risk country", () => {
    const risk = scoreRisk({ ...basePayment, amount_cents: 400000, country: "BY" });

    expect(risk.risk_score).toBeGreaterThan(RISK_BLOCK_THRESHOLD);
    expect(risk.signals).toContain("amount_outlier");
    expect(risk.signals).toContain("geo_anomaly");
  });
});
