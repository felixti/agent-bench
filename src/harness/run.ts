import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAssistantGraph } from "../agents/assistant.ts";
import { WorldStore } from "../domain/world-store.ts";
import { DEFAULT_MODEL_ID } from "../llm/client.ts";
import { PROMPTS_VERSION } from "../prompts/v1.ts";
import type { BenchmarkRow, CompletionFailure, RowTrace } from "../types.ts";
import { hashRowId } from "./hash.ts";
import { scoreRun } from "./score.ts";
import { createEmptyObservation, observeUpdate } from "./trace.ts";

export type RunRowOptions = {
  datasetVersion: string;
  outputDir: string;
  commit: string | null;
};

export async function runRow(row: BenchmarkRow, options: RunRowOptions): Promise<RowTrace> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const store = new WorldStore(row.world_state_seed, "2026-05-23T00:00:00.000Z");
  const seed = hashRowId(row.id);
  const graph = createAssistantGraph({ seed, store });
  const observation = createEmptyObservation();
  let completionFailure: CompletionFailure | null = null;

  try {
    const stream = await graph.stream(
      { messages: [{ role: "user", content: row.query }] },
      { streamMode: "updates", recursionLimit: 40 },
    );

    for await (const update of stream) {
      observeUpdate(observation, update);
    }
  } catch (error) {
    completionFailure = "error_thrown";
    observation.messages.push({
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const finished = Date.now();
  const finalWorldState = store.snapshot();
  const score = scoreRun({
    row,
    route: observation.route,
    toolCalls: observation.toolCalls,
    finalWorldState,
    completionFailure,
  });

  const trace: RowTrace = {
    row_id: row.id,
    started_at: startedAt,
    finished_at: new Date(finished).toISOString(),
    duration_ms: finished - started,
    model_id: DEFAULT_MODEL_ID,
    prompts_version: PROMPTS_VERSION,
    dataset_version: options.datasetVersion,
    commit: options.commit,
    query: row.query,
    world_state_seed: row.world_state_seed,
    route: observation.route,
    tool_calls: observation.toolCalls,
    world_state_log: store.mutations(),
    final_world_state: finalWorldState,
    messages: observation.messages,
    expected: row.expected,
    score,
    warnings: [],
    step_counts: observation.stepCounts,
  };

  const traceDir = join(options.outputDir, "traces");
  await mkdir(traceDir, { recursive: true });
  await writeFile(join(traceDir, `${row.id}.json`), `${JSON.stringify(trace, null, 2)}\n`);

  return trace;
}
