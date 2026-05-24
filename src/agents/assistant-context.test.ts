import { describe, expect, test } from "bun:test";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { buildAssistantPrompt } from "./assistant-context.ts";

describe("assistant context", () => {
  test("prompts mandatory payments handoff after support lookup", () => {
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

    const prompt = buildAssistantPrompt(messages);

    expect(prompt).toContain("Your ONLY next action is transfer_to_payments_worker");
    expect(prompt).toContain("pay_007");
  });
});
