import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Summary } from "../harness/report.ts";

const AXES = ["routing", "tool_selection", "tool_args", "world_state", "completion"] as const;

export type AxisName = (typeof AXES)[number];

export type AxisOutcome = { passed: boolean; details: string };

export type DashboardRow = {
  row_id: string;
  passed: boolean;
  duration_ms: number;
  axes: Record<AxisName, AxisOutcome>;
};

export type DashboardModel = {
  model_id: string;
  run_dir: string;
  summary: Summary;
  total_duration_ms: number;
  rows: DashboardRow[];
};

export type DashboardData = {
  generated_at: string;
  runs_root: string;
  models: DashboardModel[];
};

type TraceScore = {
  routing: { passed: boolean; details: string };
  tool_selection: { passed: boolean; details: string };
  tool_args: { passed: boolean; details: string };
  world_state: { passed: boolean; details: string };
  completion: { passed: boolean; details: string };
  overall: boolean;
};

type TraceFile = {
  row_id: string;
  duration_ms: number;
  score: TraceScore;
};

export function isGgufModelRunDir(name: string): boolean {
  return name.includes("GGUF");
}

export async function loadDashboardData(
  runsRoot = join(import.meta.dir, "../../runs"),
): Promise<DashboardData> {
  const entries = await readdir(runsRoot, { withFileTypes: true });
  const modelDirs = entries
    .filter((entry) => entry.isDirectory() && isGgufModelRunDir(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const models: DashboardModel[] = [];

  for (const modelId of modelDirs) {
    const runDir = join(runsRoot, modelId);
    const summaryPath = join(runDir, "summary.json");
    const tracesDir = join(runDir, "traces");

    try {
      await stat(summaryPath);
    } catch {
      continue;
    }

    const summary = JSON.parse(await readFile(summaryPath, "utf8")) as Summary;
    const rows = await loadTraceRows(tracesDir, summary);
    const totalDurationMs = rows.reduce((total, row) => total + row.duration_ms, 0);

    models.push({
      model_id: modelId,
      run_dir: `runs/${modelId}`,
      summary,
      total_duration_ms: totalDurationMs,
      rows,
    });
  }

  return {
    generated_at: new Date().toISOString(),
    runs_root: runsRoot,
    models,
  };
}

async function loadTraceRows(tracesDir: string, summary: Summary): Promise<DashboardRow[]> {
  const scoreByRow = new Map<string, TraceScore>();

  try {
    const traceFiles = await readdir(tracesDir);
    for (const fileName of traceFiles) {
      if (!fileName.endsWith(".json")) {
        continue;
      }

      const trace = JSON.parse(await readFile(join(tracesDir, fileName), "utf8")) as TraceFile;
      scoreByRow.set(trace.row_id, trace.score);
    }
  } catch {
    // traces directory may be missing; fall back to summary-only data
  }

  return summary.row_results.map((result) => {
    const score = scoreByRow.get(result.row_id);
    const axes = Object.fromEntries(
      AXES.map((axis) => [
        axis,
        score
          ? { passed: score[axis].passed, details: score[axis].details }
          : { passed: result.passed, details: "no trace available" },
      ]),
    ) as Record<AxisName, AxisOutcome>;

    return {
      row_id: result.row_id,
      passed: result.passed,
      duration_ms: result.duration_ms,
      axes,
    };
  });
}
