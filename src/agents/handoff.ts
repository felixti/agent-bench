import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { Command, getCurrentTaskInput } from "@langchain/langgraph";
import { z } from "zod";
import { buildStructuredRefundHandoff, resolveRefundPaymentId } from "./refund-context.ts";

const WHITESPACE_RE = /\s+/;

type HandoffState = {
  messages: BaseMessage[];
};

function normalizeAgentName(agentName: string): string {
  return agentName.trim().replace(WHITESPACE_RE, "_").toLowerCase();
}

function readHandoffState(): HandoffState {
  return getCurrentTaskInput() as HandoffState;
}

export function createAgentHandoffTool(input: { agentName: string; agentDescription?: string }) {
  const toolName = `transfer_to_${normalizeAgentName(input.agentName)}`;

  return tool(
    async (_, config) => {
      const state = readHandoffState();
      const toolMessage = new ToolMessage({
        content: `Successfully transferred to ${input.agentName}`,
        name: toolName,
        tool_call_id: config.toolCall.id,
      });

      return new Command({
        goto: input.agentName,
        graph: Command.PARENT,
        update: { messages: state.messages.concat(toolMessage) },
      });
    },
    {
      name: toolName,
      schema: z.object({}),
      description: input.agentDescription ?? "Ask another agent for help.",
    },
  );
}

export function createStructuredPaymentsHandoffTool(input: {
  agentName: string;
  agentDescription?: string;
}) {
  const toolName = `transfer_to_${normalizeAgentName(input.agentName)}`;

  return tool(
    async (_, config) => {
      const state = readHandoffState();
      const paymentId = resolveRefundPaymentId(state.messages);
      const handoffMessages: Array<ToolMessage | HumanMessage> = [
        new ToolMessage({
          content: paymentId
            ? `Successfully transferred to ${input.agentName} to refund ${paymentId}`
            : `Successfully transferred to ${input.agentName}`,
          name: toolName,
          tool_call_id: config.toolCall.id,
        }),
      ];

      if (paymentId) {
        handoffMessages.push(new HumanMessage(buildStructuredRefundHandoff(paymentId)));
      }

      return new Command({
        goto: input.agentName,
        graph: Command.PARENT,
        update: { messages: state.messages.concat(handoffMessages) },
      });
    },
    {
      name: toolName,
      schema: z.object({}),
      description:
        input.agentDescription ??
        "Hand off payment mutations to payments_worker. When a payment_id is known, the refund instruction is included automatically.",
    },
  );
}

export function createHandoffBackMessages(agentName: string, supervisorName: string) {
  const toolCallId = crypto.randomUUID();
  const toolName = `transfer_back_to_${normalizeAgentName(supervisorName)}`;
  const toolCalls = [{ name: toolName, args: {}, id: toolCallId }];

  return [
    new AIMessage({
      content: `Transferring back to ${supervisorName}`,
      tool_calls: toolCalls,
      name: agentName,
    }),
    new ToolMessage({
      content: `Successfully transferred back to ${supervisorName}`,
      name: toolName,
      tool_call_id: toolCallId,
    }),
  ];
}
