import { describe, expect, test } from "bun:test";
import type { WorldState } from "../types.ts";
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

describe("WorldStore", () => {
  test("refund mutates a payment and records a mutation", () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");

    const result = store.refund("pay_001", 400000, "suspected fraud");

    expect(result.ok).toBe(true);
    expect(store.snapshot().payments[0]?.status).toBe("refunded");
    expect(store.mutations()).toHaveLength(1);
    expect(store.mutations()[0]?.tool).toBe("refund");
  });

  test("refund can infer the full amount from the payment id", () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");

    const result = store.refund("pay_001", undefined, "customer requested refund");

    expect(result.ok).toBe(true);
    expect(store.snapshot().payments[0]?.status).toBe("refunded");
  });

  test("refund returns structured error for missing payment", () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");

    expect(store.refund("pay_missing", 100, "missing")).toEqual({
      ok: false,
      error: { code: "not_found", message: "payment pay_missing not found" },
    });
  });

  test("blockCard mutates a card and records a mutation", () => {
    const store = new WorldStore(seed, "2026-05-23T00:00:00.000Z");

    const result = store.blockCard("card_001", "risk score 0.92");

    expect(result.ok).toBe(true);
    expect(store.snapshot().cards[0]?.blocked).toBe(true);
    expect(store.mutations()[0]?.tool).toBe("block_card");
  });
});
