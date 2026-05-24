import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROMPTS_VERSION } from "../prompts/v1.ts";
import type { RowTrace } from "../types.ts";
import type { Summary } from "./report.ts";

export type SavedBenchmark = {
  model_id: string;
  recorded_at: string;
  dataset_version: string;
  prompts_version: string;
  commit: string | null;
  run_dir: string;
  total_duration_ms: number;
  summary: Summary;
};

export type ComparisonIndex = {
  updated_at: string;
  dataset_version: string;
  prompts_version: string;
  benchmarks: SavedBenchmark[];
};

const comparisonRoot = join(import.meta.dir, "../../benchmarks");
const comparisonPath = join(comparisonRoot, "comparison.json");
const modelsDir = join(comparisonRoot, "models");

export async function saveBenchmarkComparison(
  runDir: string,
  traces: RowTrace[],
  summary: Summary,
): Promise<SavedBenchmark> {
  const first = traces[0];
  if (!first) {
    throw new Error("cannot save comparison without benchmark traces");
  }

  const entry: SavedBenchmark = {
    model_id: first.model_id,
    recorded_at: new Date().toISOString(),
    dataset_version: first.dataset_version,
    prompts_version: first.prompts_version,
    commit: first.commit,
    run_dir: runDir,
    total_duration_ms: traces.reduce((total, trace) => total + trace.duration_ms, 0),
    summary,
  };

  await mkdir(modelsDir, { recursive: true });

  const index = await readComparisonIndex();
  const benchmarks = index.benchmarks.filter((item) => item.model_id !== entry.model_id);
  benchmarks.push(entry);
  benchmarks.sort((left, right) => left.model_id.localeCompare(right.model_id));

  const nextIndex: ComparisonIndex = {
    updated_at: entry.recorded_at,
    dataset_version: entry.dataset_version,
    prompts_version: entry.prompts_version,
    benchmarks,
  };

  await writeFile(comparisonPath, `${JSON.stringify(nextIndex, null, 2)}\n`);
  await writeFile(modelSnapshotPath(entry.model_id), `${JSON.stringify(entry, null, 2)}\n`);

  return entry;
}

export async function readComparisonIndex(): Promise<ComparisonIndex> {
  try {
    const raw = await readFile(comparisonPath, "utf8");
    return JSON.parse(raw) as ComparisonIndex;
  } catch {
    return {
      updated_at: new Date(0).toISOString(),
      dataset_version: "v1",
      prompts_version: PROMPTS_VERSION,
      benchmarks: [],
    };
  }
}

function modelSnapshotPath(modelId: string): string {
  return join(modelsDir, `${modelId}.json`);
}
