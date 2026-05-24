import { describe, expect, test } from "bun:test";
import type { ArgMatcher, WorldState } from "../types.ts";
import { argsMatch, partialWorldMatches } from "./matchers.ts";

describe("argsMatch", () => {
  test("passes exact, approximate, regex, and any matchers", () => {
    const matchers: Record<string, ArgMatcher> = {
      payment_id: { kind: "eq", value: "pay_001" },
      amount_cents: { kind: "approx", value: 400000, tolerance: 0 },
      reason: { kind: "regex", pattern: "fraud|suspicious" },
      risk_score: { kind: "any" },
    };

    const actual = {
      payment_id: "pay_001",
      amount_cents: 400000,
      reason: "suspected fraud",
      risk_score: 0.92,
      optional_note: "extra fields are ignored",
    };

    expect(argsMatch(actual, matchers)).toEqual({ passed: true, details: "all arguments matched" });
  });

  test("fails when a pinned argument is missing", () => {
    expect(argsMatch({}, { payment_id: { kind: "eq", value: "pay_001" } })).toEqual({
      passed: false,
      details: 'payment_id: expected eq "pay_001", got undefined',
    });
  });
});

describe("partialWorldMatches", () => {
  test("matches listed entities by id and ignores unlisted fields", () => {
    const actual: WorldState = {
      customers: [{ id: "cus_001", name: "Ada" }],
      cards: [{ id: "card_001", customer_id: "cus_001", last4: "4242", blocked: false }],
      payments: [
        {
          id: "pay_001",
          customer_id: "cus_001",
          card_id: "card_001",
          amount_cents: 400000,
          currency: "USD",
          country: "BY",
          status: "refunded",
          created_at: "2026-01-10T00:00:00.000Z",
        },
      ],
    };

    expect(
      partialWorldMatches(actual, { payments: [{ id: "pay_001", status: "refunded" }] }),
    ).toEqual({
      passed: true,
      details: "world state matched",
    });
  });
});
