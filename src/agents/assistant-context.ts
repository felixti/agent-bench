import type { BaseMessage } from "@langchain/core/messages";
import { ASSISTANT_PROMPT } from "../prompts/v1.ts";
import {
  extractPaymentIdsFromLookupTools,
  extractPaymentIdsFromMessages,
  extractPaymentIdsFromText,
  resolveRefundPaymentId,
  riskAssessmentCompleted,
} from "./refund-context.ts";

function messageText(message: BaseMessage): string {
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          return String(part.text);
        }
        return "";
      })
      .join("\n");
  }

  return JSON.stringify(content);
}

function userRequestedRefund(messages: BaseMessage[]): boolean {
  return messages.some(
    (message) => message.getType() === "human" && /refund/i.test(messageText(message)),
  );
}

function supportLookupCompleted(messages: BaseMessage[]): boolean {
  return messages.some(
    (message) => message.getType() === "tool" && message.name === "list_payments",
  );
}

export function buildAssistantPrompt(messages: BaseMessage[]): string {
  const lines = [ASSISTANT_PROMPT];
  const paymentIds = extractPaymentIdsFromMessages(messages);
  const refundRequested = userRequestedRefund(messages);
  const lookupDone = supportLookupCompleted(messages);
  const afterRisk = riskAssessmentCompleted(messages);
  const userPaymentIds = messages.flatMap((message) =>
    message.getType() === "human" ? extractPaymentIdsFromText(messageText(message)) : [],
  );

  if (refundRequested && userPaymentIds.length > 0) {
    lines.push(
      "",
      `The user provided payment_id ${userPaymentIds[0]} in the refund request. Transfer to payments_worker to refund it.`,
    );
  }

  if (lookupDone && refundRequested && paymentIds.length > 0) {
    const lookupPaymentId = extractPaymentIdsFromLookupTools(messages).at(-1) ?? paymentIds[0];
    lines.push(
      "",
      `Support lookup is complete. Refund payment_id ${lookupPaymentId}.`,
      "Your ONLY next action is transfer_to_payments_worker. Do not transfer back to support_worker. Do not reply to the user yet.",
    );
  }

  const resolvedPaymentId = resolveRefundPaymentId(messages);
  if (refundRequested && resolvedPaymentId && !lookupDone && userPaymentIds.length === 0) {
    lines.push(
      "",
      `Refund payment_id ${resolvedPaymentId} is ready. Transfer to payments_worker now.`,
    );
  }

  if (afterRisk && refundRequested && paymentIds.length > 0) {
    lines.push(
      "",
      `Risk assessment is complete. Transfer to payments_worker to refund ${paymentIds[0]} from the user's request.`,
    );
  }

  if (refundRequested) {
    lines.push(
      "",
      "Do not tell the user a refund succeeded until payments_worker returned a successful refund tool result.",
    );
  }

  return lines.join("\n");
}
