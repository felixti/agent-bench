import { SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { makePaymentsTools } from "../domain/payments-tools.ts";
import type { WorldStore } from "../domain/world-store.ts";
import type { createLemonadeChatModel } from "../llm/client.ts";
import { buildPaymentsWorkerPrompt } from "./refund-context.ts";

export function createPaymentsWorker(
  llm: ReturnType<typeof createLemonadeChatModel>,
  store: WorldStore,
) {
  return createReactAgent({
    llm,
    tools: [...makePaymentsTools(store)],
    prompt: (state) => [
      new SystemMessage(buildPaymentsWorkerPrompt(state.messages)),
      ...state.messages,
    ],
    name: "payments_worker",
  });
}
