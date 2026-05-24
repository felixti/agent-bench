import { describe, expect, test } from "bun:test";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import {
  buildPaymentsWorkerPrompt,
  buildStructuredRefundHandoff,
  extractAmountCentsFromText,
  extractPaymentIdsFromLookupTools,
  extractPaymentIdsFromMessages,
  extractPaymentIdsFromText,
  refundExecutionContext,
  resolveRefundPaymentId,
  riskAssessmentCompleted,
} from "./refund-context.ts";

describe("refund context extraction", () => {
  test("extracts payment ids from text", () => {
    expect(extractPaymentIdsFromText("Refund pay_003 in full.")).toEqual(["pay_003"]);
  });

  test("extracts dollar amounts as cents", () => {
    expect(extractAmountCentsFromText("Refund pay_999 for $10.00.")).toBe(1000);
    expect(
      extractAmountCentsFromText("There's a $4,000 charge from Belarus, refund it."),
    ).toBeUndefined();
  });

  test("extracts payment ids from support list_payments tool results", () => {
    const messages = [
      new HumanMessage("Refund my last charge for customer cus_007."),
      new ToolMessage({
        content: JSON.stringify({
          ok: true,
          data: {
            payments: [{ id: "pay_007", customer_id: "cus_007", status: "captured" }],
          },
        }),
        tool_call_id: "call_1",
        name: "list_payments",
      }),
    ];

    expect(extractPaymentIdsFromMessages(messages)).toEqual(["pay_007"]);
  });

  test("builds payments prompt with known payment id and amount", () => {
    const messages = [new HumanMessage("Refund pay_999 for $10.00.")];
    const prompt = buildPaymentsWorkerPrompt(messages);

    expect(prompt).toContain("Known payment_ids from the conversation: pay_999.");
    expect(prompt).toContain("amount_cents: 1000");
    expect(prompt).toContain("call the refund tool now");
  });

  test("builds structured refund handoff text", () => {
    expect(buildStructuredRefundHandoff("pay_007")).toContain("pay_007");
    expect(buildStructuredRefundHandoff("pay_007")).toContain("call the refund tool now");
  });

  test("resolves payment id from lookup tools when user did not provide one", () => {
    const messages = [
      new HumanMessage("Refund my last charge for customer cus_007."),
      new ToolMessage({
        content: JSON.stringify({
          ok: true,
          data: { payments: [{ id: "pay_007" }] },
        }),
        tool_call_id: "call_1",
        name: "list_payments",
      }),
    ];

    expect(resolveRefundPaymentId(messages)).toBe("pay_007");
    expect(extractPaymentIdsFromLookupTools(messages)).toEqual(["pay_007"]);
  });

  test("prefers user-provided payment id over lookup results", () => {
    const messages = [
      new HumanMessage("Refund pay_003 in full."),
      new ToolMessage({
        content: JSON.stringify({
          ok: true,
          data: { payments: [{ id: "pay_007" }] },
        }),
        tool_call_id: "call_1",
        name: "list_payments",
      }),
    ];

    expect(resolveRefundPaymentId(messages)).toBe("pay_003");
  });

  test("detects refund execution context from user query", () => {
    const messages = [new HumanMessage("Refund pay_003 in full.")];
    expect(refundExecutionContext(messages)).toEqual({
      refundRequested: true,
      paymentId: "pay_003",
    });
  });

  test("detects completed risk assessment from tool results", () => {
    const messages = [
      new ToolMessage({
        content: JSON.stringify({
          ok: true,
          data: { payment_id: "pay_001", risk_score: 0.9, signals: ["geo_anomaly"] },
        }),
        tool_call_id: "call_1",
        name: "assess_risk",
      }),
    ];

    expect(riskAssessmentCompleted(messages)).toBe(true);
  });
});
