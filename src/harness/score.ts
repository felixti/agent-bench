import type {
  AxisScore,
  BenchmarkRow,
  CompletionFailure,
  ObservedToolCall,
  RowScore,
  WorkerName,
  WorldState,
} from "../types.ts";
import { argsMatch, partialWorldMatches } from "./matchers.ts";

export type ScoreRunInput = {
  row: BenchmarkRow;
  route: WorkerName[];
  toolCalls: ObservedToolCall[];
  finalWorldState: WorldState;
  completionFailure: CompletionFailure | null;
};

export function scoreRun(input: ScoreRunInput): RowScore {
  const routing = input.row.expected.ignore_routing
    ? { passed: true, details: "routing ignored for this row" }
    : scoreRouting(input.row.expected.workers, input.route);
  const toolSelection = scoreToolSelection(input.row.expected.tool_calls, input.toolCalls);
  const toolArgs = scoreToolArgs(input.row.expected.tool_calls, input.toolCalls);
  const worldState = partialWorldMatches(
    input.finalWorldState,
    input.row.expected.final_world_state,
  );
  const completion = input.completionFailure
    ? {
        passed: false,
        failure: input.completionFailure,
        details: `completion failed: ${input.completionFailure}`,
      }
    : { passed: true, details: "completed cleanly" };

  return {
    routing,
    tool_selection: toolSelection,
    tool_args: toolArgs,
    world_state: worldState,
    completion,
    overall:
      routing.passed &&
      toolSelection.passed &&
      toolArgs.passed &&
      worldState.passed &&
      completion.passed,
  };
}

export function collapseConsecutiveDuplicates(route: WorkerName[]): WorkerName[] {
  const collapsed: WorkerName[] = [];

  for (const worker of route) {
    if (collapsed.at(-1) !== worker) {
      collapsed.push(worker);
    }
  }

  return collapsed;
}

function scoreRouting(expected: WorkerName[], actual: WorkerName[]): AxisScore {
  const collapsed = collapseConsecutiveDuplicates(actual);
  if (JSON.stringify(expected) === JSON.stringify(collapsed)) {
    return { passed: true, details: `route matched: ${collapsed.join(" -> ") || "none"}` };
  }

  return {
    passed: false,
    details: `expected route ${expected.join(" -> ") || "none"}, got ${collapsed.join(" -> ") || "none"}`,
  };
}

function scoreToolSelection(
  expected: BenchmarkRow["expected"]["tool_calls"],
  actual: ObservedToolCall[],
): AxisScore {
  for (const call of expected) {
    const found = actual.some(
      (observed) => observed.worker === call.worker && observed.tool === call.tool,
    );
    if (!found) {
      return { passed: false, details: `missing ${call.worker}.${call.tool}` };
    }
  }

  return { passed: true, details: "all expected tools were selected" };
}

function scoreToolArgs(
  expected: BenchmarkRow["expected"]["tool_calls"],
  actual: ObservedToolCall[],
): AxisScore {
  for (const call of expected) {
    const candidates = actual.filter(
      (observed) => observed.worker === call.worker && observed.tool === call.tool,
    );
    const argMatches = candidates.map((candidate) => argsMatch(candidate.args, call.args));
    const successfulMatchIndex = candidates.findIndex(
      (candidate, index) => argMatches[index]?.passed && !isFailedToolResult(candidate.result),
    );
    if (successfulMatchIndex > 0) {
      const unsafeEarlierCall = candidates
        .slice(0, successfulMatchIndex)
        .some(
          (candidate, index) => !argMatches[index]?.passed || isFailedToolResult(candidate.result),
        );
      if (unsafeEarlierCall) {
        return {
          passed: false,
          details: `unsafe earlier call before matching ${call.worker}.${call.tool}`,
        };
      }
    }

    const matchIndex =
      successfulMatchIndex >= 0
        ? successfulMatchIndex
        : argMatches.findIndex((candidate) => candidate.passed);

    if (matchIndex === -1) {
      return {
        passed: false,
        details: `no argument match for ${call.worker}.${call.tool}`,
      };
    }
  }

  return { passed: true, details: "all expected tool arguments matched" };
}

function isFailedToolResult(result: unknown): boolean {
  return (
    result !== null &&
    typeof result === "object" &&
    "ok" in result &&
    (result as { ok?: unknown }).ok === false
  );
}
