import type { ObservedToolCall, WorkerName } from "../types.ts";

const handoffPattern = /^transfer_to_(payments|risk|support)_worker$/;

const workerGraphNames: Record<string, WorkerName> = {
  payments_worker: "payments",
  risk_worker: "risk",
  support_worker: "support",
};

const domainTools = new Set([
  "charge",
  "refund",
  "assess_risk",
  "block_card",
  "get_payment_status",
  "list_payments",
]);

export type TraceObservation = {
  route: WorkerName[];
  toolCalls: ObservedToolCall[];
  messages: unknown[];
  stepCounts: {
    supervisor: number;
    per_worker: Record<WorkerName, number>;
  };
  seenToolCallIds: Set<string>;
  pendingByCallId: Map<string, number>;
};

export function createEmptyObservation(): TraceObservation {
  return {
    route: [],
    toolCalls: [],
    messages: [],
    stepCounts: {
      supervisor: 0,
      per_worker: { payments: 0, risk: 0, support: 0 },
    },
    seenToolCallIds: new Set<string>(),
    pendingByCallId: new Map<string, number>(),
  };
}

export function observeUpdate(observation: TraceObservation, update: unknown): TraceObservation {
  if (update && typeof update === "object") {
    for (const [nodeName, nodeUpdate] of Object.entries(update as Record<string, unknown>)) {
      if (nodeName === "assistant") {
        observation.stepCounts.supervisor += 1;
      }

      const worker = workerGraphNames[nodeName];
      if (worker) {
        observation.stepCounts.per_worker[worker] += 1;
      }

      for (const message of extractMessages(nodeUpdate)) {
        processMessage(observation, worker ?? null, message);

        if (nodeName === "assistant") {
          extractHandoffsFromMessage(observation, message);
        }
      }
    }
  }

  observation.messages.push(update);
  return observation;
}

function extractMessages(nodeUpdate: unknown): unknown[] {
  if (nodeUpdate && typeof nodeUpdate === "object" && "messages" in nodeUpdate) {
    const messages = (nodeUpdate as { messages: unknown }).messages;
    return Array.isArray(messages) ? messages : [];
  }

  return [];
}

function extractHandoffsFromMessage(observation: TraceObservation, message: unknown): void {
  if (getMessageType(message) !== "AIMessage") {
    return;
  }

  const toolCalls = getMessageField(message, "tool_calls");
  if (!Array.isArray(toolCalls)) {
    return;
  }

  for (const call of toolCalls) {
    if (!call || typeof call !== "object") {
      continue;
    }

    const name = (call as { name?: string }).name;
    if (!name) {
      continue;
    }

    const id = (call as { id?: string }).id;
    const dedupeKey = id ? `handoff:${id}` : `handoff:${name}`;
    if (observation.seenToolCallIds.has(dedupeKey)) {
      continue;
    }
    observation.seenToolCallIds.add(dedupeKey);

    const handoff = name.match(handoffPattern);
    if (handoff?.[1]) {
      observation.route.push(handoff[1] as WorkerName);
    }
  }
}

function processMessage(
  observation: TraceObservation,
  worker: WorkerName | null,
  message: unknown,
): void {
  const type = getMessageType(message);

  if (type === "AIMessage" && worker) {
    const toolCalls = getMessageField(message, "tool_calls");
    if (!Array.isArray(toolCalls)) {
      return;
    }

    for (const call of toolCalls) {
      if (!call || typeof call !== "object") {
        continue;
      }

      const name = (call as { name?: string }).name;
      const args = (call as { args?: Record<string, unknown> }).args ?? {};
      const id = (call as { id?: string }).id;

      if (!name || !domainTools.has(name) || !id || observation.seenToolCallIds.has(id)) {
        continue;
      }

      observation.seenToolCallIds.add(id);
      observation.toolCalls.push({
        worker,
        tool: name,
        args,
        result: null,
      });
      observation.pendingByCallId.set(id, observation.toolCalls.length - 1);
    }
  }

  if (type === "ToolMessage" && worker) {
    const toolName = getMessageField(message, "name") as string | undefined;
    const toolCallId = getMessageField(message, "tool_call_id") as string | undefined;
    const content = getMessageField(message, "content");

    if (!toolName || !domainTools.has(toolName) || !toolCallId) {
      return;
    }

    const index = observation.pendingByCallId.get(toolCallId);
    if (index === undefined) {
      return;
    }

    const call = observation.toolCalls[index];
    if (!call) {
      return;
    }

    call.result = parseToolResult(content);
  }
}

function getMessageType(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const msg = message as Record<string, unknown>;

  if (typeof msg.getType === "function") {
    const type = (msg.getType as () => string)();
    if (type === "ai") {
      return "AIMessage";
    }
    if (type === "tool") {
      return "ToolMessage";
    }
    if (type === "human") {
      return "HumanMessage";
    }

    return type;
  }

  const constructorName = (msg.constructor as { name?: string } | undefined)?.name;
  if (constructorName) {
    return constructorName;
  }

  const id = msg.id;
  return Array.isArray(id) ? ((id.at(-1) as string | undefined) ?? null) : null;
}

function getMessageField(message: unknown, field: string): unknown {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  const msg = message as Record<string, unknown>;
  if (field in msg) {
    return msg[field];
  }

  const kwargs = msg.kwargs;
  if (kwargs && typeof kwargs === "object" && field in kwargs) {
    return (kwargs as Record<string, unknown>)[field];
  }

  return undefined;
}

function parseToolResult(content: unknown): unknown {
  if (typeof content !== "string") {
    return content;
  }

  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}
