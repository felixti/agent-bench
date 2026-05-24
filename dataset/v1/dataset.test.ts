import { describe, expect, test } from "bun:test";
import { rows } from "./index.ts";

const REFUND_ROWS = ["payments-refund-001", "support-deflect-001", "support-then-payments-001"];

const RISK_REFUND_ROW = "risk-refund-001";

describe("dataset v1 refund matchers", () => {
  test("non-risk refund rows do not constrain reason wording", () => {
    for (const id of REFUND_ROWS) {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) continue;

      const refundCall = row.expected.tool_calls.find((call) => call.tool === "refund");
      if (!refundCall) continue;

      expect(refundCall.args.reason?.kind).toBe("any");
    }
  });

  test("refund rows do not require hidden amount knowledge", () => {
    for (const id of [...REFUND_ROWS, RISK_REFUND_ROW]) {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) continue;

      const refundCall = row.expected.tool_calls.find((call) => call.tool === "refund");
      if (!refundCall) continue;

      expect(refundCall.args.amount_cents).toBeUndefined();
    }
  });

  test("risk-refund-001 keeps the fraud-keyword regex", () => {
    const row = rows.find((candidate) => candidate.id === RISK_REFUND_ROW);
    expect(row).toBeDefined();
    const refundCall = row?.expected.tool_calls.find((call) => call.tool === "refund");
    expect(refundCall?.args.reason).toEqual({ kind: "regex", pattern: "fraud|suspicious|risk" });
  });
});
