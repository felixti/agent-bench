import { ChatOpenAI } from "@langchain/openai";

const FALLBACK_MODEL_ID = "Qwen3.5-9B-GGUF";

export const DEFAULT_MODEL_ID = process.env.LEMONADE_MODEL ?? FALLBACK_MODEL_ID;
export const DEFAULT_BASE_URL = "http://localhost:13305/v1";

export type LlmConfig = {
  modelId?: string;
  baseUrl?: string;
  seed?: number;
};

export function createLemonadeChatModel(config: LlmConfig = {}) {
  return new ChatOpenAI({
    model: config.modelId ?? DEFAULT_MODEL_ID,
    apiKey: process.env.LEMONADE_API_KEY ?? "not-needed-for-local-lemonade",
    configuration: {
      baseURL: config.baseUrl ?? process.env.LEMONADE_BASE_URL ?? DEFAULT_BASE_URL,
    },
    temperature: 0,
    topP: 1,
    maxTokens: 1024,
    timeout: 60_000,
    maxRetries: 2,
    modelKwargs: {
      seed: config.seed ?? 0,
    },
  });
}
