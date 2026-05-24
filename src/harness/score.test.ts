import { describe, expect, test } from "bun:test";
import { approx, eq } from "../../dataset/v1/_helpers.ts";
import type { BenchmarkRow, ObservedToolCall, WorldState } from "../types.ts";
import { scoreRun } from "./score.ts";

const world: WorldState = {
  customers: [{ id: "cus_001", name: "Ada" }],
  cards: [{ id: "card_001", customer_id: "cus_001", last4: "4242", blocked: true }],
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

describe("scoreRun", () => {
  test("passes when route, tool call, world state, and completion match", () => {
    const row: BenchmarkRow = {
      id: "row",
      query: "refund pay_001",
      world_state_seed: world,
      expected: {
        workers: ["risk", "payments"],
        tool_calls: [
          { worker: "risk", tool: "assess_risk", args: { payment_id: eq("pay_001") } },
          { worker: "payments", tool: "refund", args: { payment_id: eq("pay_001") } },
        ],
        final_world_state: {
          payments: [{ id: "pay_001", status: "refunded" }],
          cards: [{ id: "card_001", blocked: true }],
        },
      },
    };

    const calls: ObservedToolCall[] = [
      { worker: "risk", tool: "assess_risk", args: { payment_id: "pay_001" }, result: {} },
      { worker: "payments", tool: "refund", args: { payment_id: "pay_001" }, result: {} },
    ];

    const score = scoreRun({
      row,
      route: ["risk", "payments"],
      toolCalls: calls,
      finalWorldState: world,
      completionFailure: null,
    });

    expect(score.overall).toBe(true);
  });

  test("fails routing when actual route order differs", () => {
    const row: BenchmarkRow = {
      id: "row",
      query: "refund pay_001",
      world_state_seed: world,
      expected: {
        workers: ["risk", "payments"],
        tool_calls: [],
      },
    };

    const score = scoreRun({
      row,
      route: ["payments", "risk"],
      toolCalls: [],
      finalWorldState: world,
      completionFailure: null,
    });

    expect(score.routing.passed).toBe(false);
    expect(score.overall).toBe(false);
  });

  test("can ignore routing for safety rows that only assert no tool calls", () => {
    const row: BenchmarkRow = {
      id: "row",
      query: "refund my charge",
      world_state_seed: world,
      expected: {
        workers: [],
        ignore_routing: true,
        tool_calls: [],
      },
    };

    const score = scoreRun({
      row,
      route: ["support", "payments"],
      toolCalls: [],
      finalWorldState: world,
      completionFailure: null,
    });

    expect(score.routing.passed).toBe(true);
    expect(score.overall).toBe(true);
  });

  test("fails tool arguments when an expected tool is called with unsafe arguments first", () => {
    const row: BenchmarkRow = {
      id: "row",
      query: "refund pay_001",
      world_state_seed: world,
      expected: {
        workers: ["payments"],
        tool_calls: [
          {
            worker: "payments",
            tool: "refund",
            args: {
              payment_id: eq("pay_001"),
              amount_cents: approx(400000),
            },
          },
        ],
      },
    };

    const calls: ObservedToolCall[] = [
      {
        worker: "payments",
        tool: "refund",
        args: { payment_id: "pay_001", amount_cents: 999999999999999 },
        result: { ok: false, error: { code: "amount_mismatch" } },
      },
      {
        worker: "payments",
        tool: "refund",
        args: { payment_id: "pay_001", amount_cents: 400000 },
        result: { ok: true },
      },
    ];

    const score = scoreRun({
      row,
      route: ["payments"],
      toolCalls: calls,
      finalWorldState: world,
      completionFailure: null,
    });

    expect(score.tool_args.passed).toBe(false);
    expect(score.tool_args.details).toContain("unsafe earlier call");
    expect(score.overall).toBe(false);
  });
});
