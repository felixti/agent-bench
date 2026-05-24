import { describe, expect, test } from "bun:test";
import { ASSISTANT_PROMPT, PAYMENTS_WORKER_PROMPT, SUPPORT_WORKER_PROMPT } from "./v1.ts";

describe("v1 prompts", () => {
  test("payments worker is explicitly required to call refund before replying", () => {
    expect(PAYMENTS_WORKER_PROMPT).toContain("MUST call the refund tool before replying");
    expect(PAYMENTS_WORKER_PROMPT).toContain(
      "For refunds, required tool arguments are payment_id and reason",
    );
  });

  test("support worker can do lookup-only work for refund handoffs", () => {
    expect(SUPPORT_WORKER_PROMPT).toContain("lookup-only step for a refund");
  });

  test("support worker treats refund status as read-only lookup work", () => {
    expect(SUPPORT_WORKER_PROMPT).toContain("Refund status questions are read-only");
    expect(SUPPORT_WORKER_PROMPT).toContain("A refund status question is not a refund request");
    expect(SUPPORT_WORKER_PROMPT).toContain("MUST call get_payment_status");
  });

  test("support worker looks up customer payment history without asking permission", () => {
    expect(SUPPORT_WORKER_PROMPT).toContain("MUST call list_payments");
    expect(SUPPORT_WORKER_PROMPT).toContain("Do not ask permission first");
  });

  test("support worker performs lookup even when user wants a refund", () => {
    expect(SUPPORT_WORKER_PROMPT).toContain("Lookup-first for refunds");
    expect(SUPPORT_WORKER_PROMPT).toContain(
      "you MUST call list_payments before replying, even though you cannot execute the refund yourself",
    );
  });

  test("assistant routes nonexistent payment refunds consistently through payments", () => {
    expect(ASSISTANT_PROMPT).toContain("If a refund names a payment_id directly");
  });

  test("assistant only forwards looked-up payment ids from tool results", () => {
    expect(ASSISTANT_PROMPT).toContain(
      "When support_worker returned a payment_id from a tool result",
    );
  });

  test("payments worker does not delegate refund execution", () => {
    expect(PAYMENTS_WORKER_PROMPT).toContain("You are already payments_worker");
    expect(PAYMENTS_WORKER_PROMPT).toContain("Do not say another worker will process the refund");
  });

  test("payments worker infers refund reason instead of asking the user", () => {
    expect(PAYMENTS_WORKER_PROMPT).toContain("Do not ask the user for a reason");
    expect(PAYMENTS_WORKER_PROMPT).toContain("Infer reason from the refund request itself");
    expect(PAYMENTS_WORKER_PROMPT).toContain("Do not invent payment_ids");
  });

  test("assistant handles lookup-then-refund without returning to support", () => {
    expect(ASSISTANT_PROMPT).toContain("Lookup-then-refund workflow");
    expect(ASSISTANT_PROMPT).toContain("Do not transfer back to support_worker");
  });

  test("payments worker uses payment_id from support lookup context", () => {
    expect(PAYMENTS_WORKER_PROMPT).toContain(
      "If support_worker already returned a payment_id in the conversation",
    );
    expect(PAYMENTS_WORKER_PROMPT).toContain(
      "Never say you transferred or will transfer to payments_worker",
    );
  });
});
