import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { makeSupportTools } from "../domain/support-tools.ts";
import type { WorldStore } from "../domain/world-store.ts";
import type { createLemonadeChatModel } from "../llm/client.ts";
import { SUPPORT_WORKER_PROMPT } from "../prompts/v1.ts";

export function createSupportWorker(
  llm: ReturnType<typeof createLemonadeChatModel>,
  store: WorldStore,
) {
  return createReactAgent({
    llm,
    tools: [...makeSupportTools(store)],
    prompt: SUPPORT_WORKER_PROMPT,
    name: "support_worker",
  });
}
