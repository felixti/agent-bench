import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { CompiledStateGraph } from "@langchain/langgraph";
import {
  type LangGraphRunnableConfig,
  type MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { createReactAgent, createReactAgentAnnotation } from "@langchain/langgraph/prebuilt";
import {
  createAgentHandoffTool,
  createHandoffBackMessages,
  createStructuredPaymentsHandoffTool,
} from "./handoff.ts";

type SupervisorAgent = CompiledStateGraph<unknown, unknown, string>;
type SupervisorState = typeof MessagesAnnotation.State;

const PROVIDERS_WITH_PARALLEL_TOOL_CALLS_PARAM = new Set(["ChatOpenAI"]);

function isChatModelWithBindTools(llm: LanguageModelLike): llm is LanguageModelLike & {
  bindTools: (...args: unknown[]) => LanguageModelLike;
  getName: () => string;
  _modelType?: () => string;
} {
  return (
    typeof llm === "object" &&
    llm !== null &&
    "_modelType" in llm &&
    typeof llm._modelType === "function" &&
    llm._modelType() === "base_chat_model" &&
    "bindTools" in llm &&
    typeof llm.bindTools === "function"
  );
}

function bindSupervisorTools(
  llm: LanguageModelLike,
  tools: ReturnType<typeof createAgentHandoffTool>[],
) {
  if (!isChatModelWithBindTools(llm)) {
    return llm;
  }

  if (llm.bindTools.length >= 2 && PROVIDERS_WITH_PARALLEL_TOOL_CALLS_PARAM.has(llm.getName())) {
    return llm.bindTools(tools, { parallel_tool_calls: false });
  }

  return llm.bindTools(tools);
}

function isRemoteGraph(agent: SupervisorAgent): boolean {
  if (agent == null || typeof agent !== "object") {
    return false;
  }

  if (!("lc_id" in agent)) {
    return false;
  }

  if (!Array.isArray(agent.lc_id)) {
    return false;
  }

  return agent.lc_id.join(".") === "langgraph.pregel.RemoteGraph";
}

function makeCallAgent(
  agent: SupervisorAgent,
  outputMode: "full_history" | "last_message",
  supervisorName: string,
) {
  return async (state: SupervisorState, config?: LangGraphRunnableConfig) => {
    const output = (await agent.invoke(state, config)) as SupervisorState;
    let messages = output.messages;

    if (outputMode === "last_message") {
      messages = messages.slice(-1);
    }

    messages = messages.concat(createHandoffBackMessages(agent.name ?? "agent", supervisorName));

    return {
      ...output,
      messages,
    };
  };
}

export type CreatePaymentSupervisorParams = {
  agents: SupervisorAgent[];
  llm: LanguageModelLike;
  prompt: NonNullable<Parameters<typeof createReactAgent>[0]["prompt"]>;
  supervisorName?: string;
  outputMode?: "full_history" | "last_message";
};

export function createPaymentSupervisor({
  agents,
  llm,
  prompt,
  supervisorName = "assistant",
  outputMode = "last_message",
}: CreatePaymentSupervisorParams) {
  const agentNames = new Set<string>();

  for (const agent of agents) {
    if (!agent.name || agent.name === "LangGraph") {
      throw new Error("Each agent must have a unique name.");
    }

    if (agentNames.has(agent.name)) {
      throw new Error(`Duplicate agent name: ${agent.name}`);
    }

    agentNames.add(agent.name);
  }

  const handoffTools = agents.map((agent) => {
    const agentName = agent.name as string;

    if (agentName === "payments_worker") {
      return createStructuredPaymentsHandoffTool({
        agentName,
        agentDescription: "Execute payment charges and refunds.",
      });
    }

    return createAgentHandoffTool({ agentName });
  });

  const schema = createReactAgentAnnotation();
  const supervisorAgent = createReactAgent({
    name: supervisorName,
    llm: bindSupervisorTools(llm, handoffTools),
    tools: handoffTools,
    prompt,
    stateSchema: schema,
  });

  let builder = new StateGraph(schema)
    .addNode(supervisorAgent.name as string, supervisorAgent, { ends: [...agentNames] })
    .addEdge(START, supervisorAgent.name as string);

  for (const agent of agents) {
    const nodeOptions = isRemoteGraph(agent) ? {} : { subgraphs: [agent] };
    builder = builder.addNode(
      agent.name as string,
      makeCallAgent(agent, outputMode, supervisorName),
      nodeOptions,
    );
    builder = builder.addEdge(agent.name as string, supervisorAgent.name as string);
  }

  return builder;
}
