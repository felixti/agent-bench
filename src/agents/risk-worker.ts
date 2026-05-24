import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { makeRiskTools } from "../domain/risk-tools.ts";
import type { WorldStore } from "../domain/world-store.ts";
import type { createLemonadeChatModel } from "../llm/client.ts";
import { RISK_WORKER_PROMPT } from "../prompts/v1.ts";

export function createRiskWorker(
  llm: ReturnType<typeof createLemonadeChatModel>,
  store: WorldStore,
) {
  return createReactAgent({
    llm,
    tools: [...makeRiskTools(store)],
    prompt: RISK_WORKER_PROMPT,
    name: "risk_worker",
  });
}
