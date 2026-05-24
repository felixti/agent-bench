import type { ArgMatcher, BenchmarkRow, WorldState } from "../../src/types.ts";

export const now = "2026-05-23T00:00:00.000Z";

export const baseWorld: WorldState = {
  customers: [
    { id: "cus_001", name: "Ada Lovelace" },
    { id: "cus_007", name: "Grace Hopper" },
  ],
  cards: [
    { id: "card_001", customer_id: "cus_001", last4: "4242", blocked: false },
    { id: "card_007", customer_id: "cus_007", last4: "7777", blocked: false },
  ],
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
    {
      id: "pay_002",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 2500,
      currency: "USD",
      country: "US",
      status: "refunded",
      created_at: "2026-02-10T00:00:00.000Z",
    },
    {
      id: "pay_003",
      customer_id: "cus_001",
      card_id: "card_001",
      amount_cents: 9999,
      currency: "USD",
      country: "US",
      status: "captured",
      created_at: "2026-03-10T00:00:00.000Z",
    },
    {
      id: "pay_007",
      customer_id: "cus_007",
      card_id: "card_007",
      amount_cents: 3000,
      currency: "USD",
      country: "US",
      status: "captured",
      created_at: "2026-04-10T00:00:00.000Z",
    },
  ],
};

export function cloneWorld(): WorldState {
  return structuredClone(baseWorld);
}

export function eq(value: unknown): ArgMatcher {
  return { kind: "eq", value };
}

export function approx(value: number, tolerance = 0): ArgMatcher {
  return { kind: "approx", value, tolerance };
}

export function regex(pattern: string): ArgMatcher {
  return { kind: "regex", pattern };
}

export function any(): ArgMatcher {
  return { kind: "any" };
}

export function row(input: BenchmarkRow): BenchmarkRow {
  return input;
}
