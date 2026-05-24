import type { BaseMessage } from "@langchain/core/messages";
import { PAYMENTS_WORKER_PROMPT } from "../prompts/v1.ts";

const PAYMENT_ID_PATTERN = /\bpay_\d+\b/g;

type ListPaymentsResult = {
  ok?: boolean;
  data?: {
    payments?: Array<{ id?: string }>;
  };
};

export function extractPaymentIdsFromText(text: string): string[] {
  return [...new Set(text.match(PAYMENT_ID_PATTERN) ?? [])];
}

export function extractAmountCentsFromText(text: string): number | undefined {
  const refundAmountMatch = text.match(
    /refund\b[^.$]{0,80}?(?:for|amount)\s+\$?\s*([\d,]+(?:\.\d{2})?)/i,
  );
  if (refundAmountMatch?.[1]) {
    return parseDollarAmount(refundAmountMatch[1]);
  }

  const trailingAmountMatch = text.match(/\bfor\s+\$\s*([\d,]+(?:\.\d{2})?)\b/i);
  if (trailingAmountMatch?.[1] && /refund/i.test(text)) {
    return parseDollarAmount(trailingAmountMatch[1]);
  }

  return undefined;
}

function parseDollarAmount(raw: string): number | undefined {
  const normalized = raw.replaceAll(",", "");
  const [whole = "", fraction = "0"] = normalized.split(".");
  if (!/^\d+$/.test(whole) || !/^\d{1,2}$/.test(fraction)) {
    return undefined;
  }

  return (
    Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0").slice(0, 2), 10)
  );
}

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

function parseToolPayload(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function paymentIdsFromToolPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const result = payload as ListPaymentsResult;
  const payments = result.data?.payments;
  if (!Array.isArray(payments)) {
    return [];
  }

  return payments.flatMap((payment) => (payment.id ? [payment.id] : []));
}

export function extractPaymentIdsFromMessages(messages: BaseMessage[]): string[] {
  const ids = new Set<string>();

  for (const message of messages) {
    for (const id of extractPaymentIdsFromText(messageText(message))) {
      ids.add(id);
    }

    if (message.getType() !== "tool") {
      continue;
    }

    for (const id of paymentIdsFromToolPayload(parseToolPayload(messageText(message)))) {
      ids.add(id);
    }
  }

  return [...ids];
}

export function extractAmountCentsFromMessages(messages: BaseMessage[]): number | undefined {
  for (const message of messages) {
    if (message.getType() !== "human") {
      continue;
    }

    const amount = extractAmountCentsFromText(messageText(message));
    if (amount !== undefined) {
      return amount;
    }
  }

  return undefined;
}

export function riskAssessmentCompleted(messages: BaseMessage[]): boolean {
  return messages.some((message) => {
    if (message.getType() !== "tool") {
      return false;
    }

    const payload = parseToolPayload(messageText(message));
    return (
      payload !== null &&
      typeof payload === "object" &&
      "data" in payload &&
      payload.data !== null &&
      typeof payload.data === "object" &&
      "risk_score" in payload.data
    );
  });
}

export function buildPaymentsWorkerPrompt(messages: BaseMessage[]): string {
  const paymentIds = extractPaymentIdsFromMessages(messages);
  const amountCents = extractAmountCentsFromMessages(messages);
  const afterRisk = riskAssessmentCompleted(messages);

  const lines = [PAYMENTS_WORKER_PROMPT];

  if (paymentIds.length > 0) {
    lines.push(
      "",
      `Known payment_ids from the conversation: ${paymentIds.join(", ")}.`,
      "You are payments_worker. Execute the refund yourself with the refund tool. Never say you transferred to payments_worker.",
      "If a refund was requested, call the refund tool now with the correct payment_id before replying.",
    );
  }

  if (amountCents !== undefined) {
    lines.push(
      `The user specified refund amount_cents: ${amountCents}. Include it in the refund call.`,
    );
  }

  if (afterRisk) {
    lines.push(
      "A risk assessment already ran. Use a refund reason that includes one of: fraud, suspicious, or risk.",
    );
  }

  return lines.join("\n");
}

export type RefundExecutionContext = {
  refundRequested: boolean;
  paymentId: string | null;
};

export function refundExecutionContext(messages: BaseMessage[]): RefundExecutionContext {
  const refundRequested = messages.some(
    (message) => message.getType() === "human" && /refund/i.test(messageText(message)),
  );
  const paymentIds = extractPaymentIdsFromMessages(messages);

  return {
    refundRequested,
    paymentId: paymentIds.at(-1) ?? null,
  };
}

export function recentMessagesForRefund(messages: BaseMessage[], limit = 10): BaseMessage[] {
  return messages.slice(-limit);
}

export function extractPaymentIdsFromLookupTools(messages: BaseMessage[]): string[] {
  const ids: string[] = [];

  for (const message of messages) {
    if (message.getType() !== "tool") {
      continue;
    }

    if (message.name !== "list_payments" && message.name !== "get_payment_status") {
      continue;
    }

    ids.push(...paymentIdsFromToolPayload(parseToolPayload(messageText(message))));
  }

  return ids;
}

export function extractPaymentIdsFromUserMessages(messages: BaseMessage[]): string[] {
  const ids = new Set<string>();

  for (const message of messages) {
    if (message.getType() !== "human") {
      continue;
    }

    for (const id of extractPaymentIdsFromText(messageText(message))) {
      ids.add(id);
    }
  }

  return [...ids];
}

export function resolveRefundPaymentId(messages: BaseMessage[]): string | null {
  const { refundRequested } = refundExecutionContext(messages);
  if (!refundRequested) {
    return null;
  }

  const userPaymentIds = extractPaymentIdsFromUserMessages(messages);
  if (userPaymentIds.length > 0) {
    return userPaymentIds.at(-1) ?? null;
  }

  const lookupPaymentIds = extractPaymentIdsFromLookupTools(messages);
  if (lookupPaymentIds.length > 0) {
    return lookupPaymentIds.at(-1) ?? null;
  }

  return extractPaymentIdsFromMessages(messages).at(-1) ?? null;
}

export function buildStructuredRefundHandoff(paymentId: string): string {
  return `[Supervisor handoff] Refund payment_id ${paymentId}. You are payments_worker — call the refund tool now.`;
}
