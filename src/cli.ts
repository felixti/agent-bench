import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DATASET_VERSION, rows } from "../dataset/v1/index.ts";
import { saveBenchmarkComparison } from "./harness/comparison.ts";
import { writeSummary } from "./harness/report.ts";
import { runRow } from "./harness/run.ts";

type CliOptions = {
  rowId: string | null;
  outputDir: string;
  saveComparison: boolean;
};

const options = parseArgs(Bun.argv.slice(2));
await mkdir(options.outputDir, { recursive: true });

const selectedRows = options.rowId ? rows.filter((row) => row.id === options.rowId) : rows;

if (options.rowId && selectedRows.length === 0) {
  console.error(`Unknown row id: ${options.rowId}`);
  process.exit(1);
}

const commit = await currentCommit();
const traces = [];

for (const row of selectedRows) {
  console.log(`running ${row.id}`);
  traces.push(
    await runRow(row, {
      datasetVersion: DATASET_VERSION,
      outputDir: options.outputDir,
      commit,
    }),
  );
}

const summary = await writeSummary(options.outputDir, traces);
console.log(JSON.stringify(summary, null, 2));

if (options.saveComparison) {
  if (options.rowId) {
    console.error("--save-comparison requires a full dataset run (omit --row)");
    process.exit(1);
  }

  const saved = await saveBenchmarkComparison(options.outputDir, traces, summary);
  console.error(
    `saved comparison for ${saved.model_id} -> benchmarks/models/${saved.model_id}.json`,
  );
}

function parseArgs(args: string[]): CliOptions {
  let rowId: string | null = null;
  let outputDir = join("runs", new Date().toISOString().replaceAll(":", "-"));
  let saveComparison = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--save-comparison") {
      saveComparison = true;
      continue;
    }
    if (arg === "--row") {
      rowId = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      outputDir = args[index + 1] ?? outputDir;
      index += 1;
      continue;
    }
    if (arg === "--dataset") {
      const dataset = args[index + 1];
      if (dataset !== "v1") {
        console.error(`Unsupported dataset: ${dataset}`);
        process.exit(1);
      }
      index += 1;
    }
  }

  return { rowId, outputDir, saveComparison };
}

async function currentCommit(): Promise<string | null> {
  const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return null;
  }

  return output.trim();
}
