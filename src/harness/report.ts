import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RowTrace } from "../types.ts";

type AxisName = "routing" | "tool_selection" | "tool_args" | "world_state" | "completion";

export type Summary = {
  total_rows: number;
  passed_rows: number;
  failed_rows: number;
  pass_rate: number;
  axis_pass_rates: Record<AxisName, number>;
  row_results: Array<{
    row_id: string;
    passed: boolean;
    duration_ms: number;
  }>;
};

export async function writeSummary(outputDir: string, traces: RowTrace[]): Promise<Summary> {
  const axes: AxisName[] = ["routing", "tool_selection", "tool_args", "world_state", "completion"];
  const total = traces.length;
  const passed = traces.filter((trace) => trace.score.overall).length;

  const summary: Summary = {
    total_rows: total,
    passed_rows: passed,
    failed_rows: total - passed,
    pass_rate: ratio(passed, total),
    axis_pass_rates: Object.fromEntries(
      axes.map((axis) => [
        axis,
        ratio(traces.filter((trace) => trace.score[axis].passed).length, total),
      ]),
    ) as Record<AxisName, number>,
    row_results: traces.map((trace) => ({
      row_id: trace.row_id,
      passed: trace.score.overall,
      duration_ms: trace.duration_ms,
    })),
  };

  await writeFile(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}
