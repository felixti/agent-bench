import { SystemMessage } from "@langchain/core/messages";
import type { MessagesAnnotation } from "@langchain/langgraph";
import type { WorldStore } from "../domain/world-store.ts";
import { createLemonadeChatModel } from "../llm/client.ts";
import { buildAssistantPrompt } from "./assistant-context.ts";
import { createPaymentSupervisor } from "./build-supervisor.ts";
import { createPaymentsWorker } from "./payments-worker.ts";
import { createRiskWorker } from "./risk-worker.ts";
import { createSupportWorker } from "./support-worker.ts";

export type AssistantGraphConfig = {
  seed: number;
  store: WorldStore;
};

export function createAssistantGraph(config: AssistantGraphConfig) {
  const llm = createLemonadeChatModel({ seed: config.seed });

  const agents = [
    createPaymentsWorker(llm, config.store),
    createRiskWorker(llm, config.store),
    createSupportWorker(llm, config.store),
  ];

  const workflow = createPaymentSupervisor({
    agents,
    llm,
    prompt: (state: typeof MessagesAnnotation.State) => [
      new SystemMessage(buildAssistantPrompt(state.messages)),
      ...state.messages,
    ],
    outputMode: "full_history",
    supervisorName: "assistant",
  });

  return workflow.compile({ name: "payment_agent_benchmark" });
}
