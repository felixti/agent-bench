import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadDashboardData } from "./load-runs.ts";

const outputPath = join(import.meta.dir, "../../dashboard.html");

const data = await loadDashboardData();
const html = renderDashboard(data);

await writeFile(outputPath, html);
console.error(`wrote ${outputPath} (${data.models.length} models)`);

function renderDashboard(data: Awaited<ReturnType<typeof loadDashboardData>>): string {
  const payload = JSON.stringify(data).replaceAll("<", "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Agent Benchmark — Model Comparison</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f14;
      --panel: #121821;
      --panel-2: #171f2b;
      --border: #243041;
      --text: #e7edf5;
      --muted: #8b9bb0;
      --accent: #5b9dff;
      --pass: #3ecf8e;
      --fail: #ff6b6b;
      --warn: #f0b429;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      --radius: 14px;
      font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(91, 157, 255, 0.12), transparent 28%),
        radial-gradient(circle at top right, rgba(62, 207, 142, 0.08), transparent 24%),
        var(--bg);
      color: var(--text);
      line-height: 1.5;
    }

    main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }

    header {
      display: flex;
      flex-wrap: wrap;
      gap: 16px 24px;
      align-items: end;
      justify-content: space-between;
      margin-bottom: 28px;
    }

    h1 {
      margin: 0 0 6px;
      font-size: clamp(1.6rem, 2vw, 2.2rem);
      letter-spacing: -0.02em;
    }

    .subtitle {
      color: var(--muted);
      margin: 0;
      font-size: 0.95rem;
    }

    .meta {
      color: var(--muted);
      font-size: 0.85rem;
      text-align: right;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }

    .card {
      background: linear-gradient(180deg, var(--panel-2), var(--panel));
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 18px;
      box-shadow: var(--shadow);
    }

    .card-label {
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .card-value {
      font-size: 1.7rem;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .card-note {
      color: var(--muted);
      font-size: 0.82rem;
      margin-top: 4px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      margin-bottom: 22px;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.02);
    }

    .panel-header h2 {
      margin: 0;
      font-size: 1.05rem;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    label {
      color: var(--muted);
      font-size: 0.85rem;
    }

    select, input[type="search"] {
      background: var(--panel-2);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 10px;
      font: inherit;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }

    th, td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: middle;
    }

    th {
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      user-select: none;
      cursor: pointer;
      white-space: nowrap;
    }

    th.sorted-asc::after { content: " ▲"; color: var(--accent); }
    th.sorted-desc::after { content: " ▼"; color: var(--accent); }

    tbody tr:hover { background: rgba(255, 255, 255, 0.03); }

    .model-name {
      font-weight: 600;
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.86rem;
    }

    .rate-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 160px;
    }

    .rate-track {
      flex: 1;
      height: 8px;
      background: #1d2735;
      border-radius: 999px;
      overflow: hidden;
    }

    .rate-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #3ecf8e, #5b9dff);
    }

    .rate-text {
      width: 48px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-size: 0.85rem;
    }

    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .pill-pass { background: rgba(62, 207, 142, 0.15); color: var(--pass); }
    .pill-fail { background: rgba(255, 107, 107, 0.15); color: var(--fail); }

    .axis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      padding: 18px;
    }

    .axis-card {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
    }

    .axis-card h3 {
      margin: 0 0 12px;
      font-size: 0.92rem;
      color: var(--muted);
      text-transform: capitalize;
    }

    .axis-row {
      display: grid;
      grid-template-columns: minmax(120px, 1fr) 1fr 44px;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
      font-size: 0.82rem;
    }

    .axis-row:last-child { margin-bottom: 0; }

    .heatmap-wrap {
      overflow: auto;
      padding: 0 0 8px;
    }

    .heatmap {
      min-width: 720px;
    }

    .heatmap th.sticky, .heatmap td.sticky {
      position: sticky;
      left: 0;
      background: var(--panel);
      z-index: 1;
    }

    .cell {
      width: 34px;
      min-width: 34px;
      height: 34px;
      text-align: center;
      padding: 0;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: default;
    }

    .cell-pass { background: rgba(62, 207, 142, 0.22); color: var(--pass); }
    .cell-fail { background: rgba(255, 107, 107, 0.22); color: var(--fail); }
    .cell-missing { background: rgba(139, 155, 176, 0.08); color: var(--muted); }

    .row-id {
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .empty {
      padding: 40px 20px;
      text-align: center;
      color: var(--muted);
    }

    .tooltip {
      position: fixed;
      pointer-events: none;
      background: #0f1520;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 0.8rem;
      max-width: 360px;
      white-space: pre-line;
      box-shadow: var(--shadow);
      z-index: 20;
      display: none;
    }

    @media (max-width: 720px) {
      .meta { text-align: left; }
      th, td { padding: 10px 8px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Payment Agent Benchmark</h1>
        <p class="subtitle">Compare GGUF model runs from <code>runs/</code></p>
      </div>
      <div class="meta" id="meta"></div>
    </header>

    <section class="cards" id="summary-cards"></section>

    <section class="panel">
      <div class="panel-header">
        <h2>Model leaderboard</h2>
        <div class="controls">
          <label for="sort-select">Sort by</label>
          <select id="sort-select">
            <option value="pass_rate">Pass rate</option>
            <option value="model_id">Model name</option>
            <option value="duration">Total duration</option>
            <option value="routing">Routing</option>
            <option value="tool_selection">Tool selection</option>
            <option value="tool_args">Tool args</option>
            <option value="world_state">World state</option>
          </select>
        </div>
      </div>
      <div id="leaderboard-wrap"></div>
    </section>

    <section class="panel">
      <div class="panel-header"><h2>Axis pass rates by model</h2></div>
      <div class="axis-grid" id="axis-grid"></div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Row pass matrix</h2>
        <div class="controls">
          <label for="row-filter">Filter rows</label>
          <input id="row-filter" type="search" placeholder="e.g. risk-refund">
        </div>
      </div>
      <div class="heatmap-wrap" id="heatmap-wrap"></div>
    </section>
  </main>

  <div class="tooltip" id="tooltip"></div>

  <script>
    const DATA = ${payload};

    const AXES = ["routing", "tool_selection", "tool_args", "world_state", "completion"];
    const AXIS_LABELS = {
      routing: "Routing",
      tool_selection: "Tool selection",
      tool_args: "Tool args",
      world_state: "World state",
      completion: "Completion",
    };

    const state = {
      sortKey: "pass_rate",
      sortDir: "desc",
      rowFilter: "",
    };

    function pct(value) {
      return (value * 100).toFixed(1) + "%";
    }

    function formatMs(ms) {
      if (ms >= 60000) return (ms / 60000).toFixed(1) + " min";
      if (ms >= 1000) return (ms / 1000).toFixed(1) + " s";
      return ms + " ms";
    }

    function bestModel(models) {
      if (!models.length) return null;
      return [...models].sort((a, b) => b.summary.pass_rate - a.summary.pass_rate)[0];
    }

    function renderSummaryCards() {
      const models = DATA.models;
      const best = bestModel(models);
      const avgPass =
        models.length === 0
          ? 0
          : models.reduce((sum, model) => sum + model.summary.pass_rate, 0) / models.length;

      document.getElementById("meta").innerHTML =
        \`<div>Generated \${new Date(DATA.generated_at).toLocaleString()}</div>\` +
        \`<div>\${models.length} GGUF model\${models.length === 1 ? "" : "s"}</div>\`;

      document.getElementById("summary-cards").innerHTML = [
        card("Models compared", String(models.length), "folders with GGUF in runs/"),
        card("Best pass rate", best ? pct(best.summary.pass_rate) : "—", best ? best.model_id : "no runs yet"),
        card("Average pass rate", pct(avgPass), "across all models"),
        card(
          "Dataset rows",
          models[0] ? String(models[0].summary.total_rows) : "—",
          "per benchmark run",
        ),
      ].join("");
    }

    function card(label, value, note) {
      return \`
        <article class="card">
          <div class="card-label">\${label}</div>
          <div class="card-value">\${value}</div>
          <div class="card-note">\${note}</div>
        </article>
      \`;
    }

    function rateBar(rate) {
      return \`
        <div class="rate-bar">
          <div class="rate-track"><div class="rate-fill" style="width:\${Math.max(rate * 100, 2)}%"></div></div>
          <div class="rate-text">\${pct(rate)}</div>
        </div>
      \`;
    }

    function sortedModels() {
      const models = [...DATA.models];
      const dir = state.sortDir === "asc" ? 1 : -1;

      models.sort((left, right) => {
        let a;
        let b;

        switch (state.sortKey) {
          case "model_id":
            return dir * left.model_id.localeCompare(right.model_id);
          case "duration":
            a = left.total_duration_ms;
            b = right.total_duration_ms;
            break;
          case "routing":
          case "tool_selection":
          case "tool_args":
          case "world_state":
          case "completion":
            a = left.summary.axis_pass_rates[state.sortKey];
            b = right.summary.axis_pass_rates[state.sortKey];
            break;
          default:
            a = left.summary.pass_rate;
            b = right.summary.pass_rate;
        }

        if (a === b) return left.model_id.localeCompare(right.model_id);
        return dir * (a - b);
      });

      return models;
    }

    function renderLeaderboard() {
      const models = sortedModels();
      const wrap = document.getElementById("leaderboard-wrap");

      if (!models.length) {
        wrap.innerHTML = '<div class="empty">No GGUF runs found. Run benchmarks with <code>bun run bench --out runs/&lt;model-name&gt;</code>.</div>';
        return;
      }

      wrap.innerHTML = \`
        <table>
          <thead>
            <tr>
              <th data-key="model_id">Model</th>
              <th data-key="pass_rate">Pass rate</th>
              <th>Passed</th>
              <th data-key="routing">Routing</th>
              <th data-key="tool_selection">Tools</th>
              <th data-key="tool_args">Args</th>
              <th data-key="world_state">World</th>
              <th data-key="completion">Done</th>
              <th data-key="duration">Duration</th>
            </tr>
          </thead>
          <tbody>
            \${models
              .map(
                (model) => \`
                  <tr>
                    <td class="model-name">\${model.model_id}</td>
                    <td>\${rateBar(model.summary.pass_rate)}</td>
                    <td>\${model.summary.passed_rows}/\${model.summary.total_rows}</td>
                    <td>\${pct(model.summary.axis_pass_rates.routing)}</td>
                    <td>\${pct(model.summary.axis_pass_rates.tool_selection)}</td>
                    <td>\${pct(model.summary.axis_pass_rates.tool_args)}</td>
                    <td>\${pct(model.summary.axis_pass_rates.world_state)}</td>
                    <td>\${pct(model.summary.axis_pass_rates.completion)}</td>
                    <td>\${formatMs(model.total_duration_ms)}</td>
                  </tr>
                \`,
              )
              .join("")}
          </tbody>
        </table>
      \`;

      wrap.querySelectorAll("th[data-key]").forEach((header) => {
        header.classList.toggle("sorted-asc", header.dataset.key === state.sortKey && state.sortDir === "asc");
        header.classList.toggle("sorted-desc", header.dataset.key === state.sortKey && state.sortDir === "desc");
        header.addEventListener("click", () => {
          const key = header.dataset.key;
          if (state.sortKey === key) {
            state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
          } else {
            state.sortKey = key;
            state.sortDir = key === "model_id" ? "asc" : "desc";
          }
          document.getElementById("sort-select").value = state.sortKey;
          renderLeaderboard();
        });
      });
    }

    function renderAxisGrid() {
      const grid = document.getElementById("axis-grid");
      const models = sortedModels();

      if (!models.length) {
        grid.innerHTML = "";
        return;
      }

      grid.innerHTML = AXES.map((axis) => {
        const rows = models
          .map((model) => {
            const rate = model.summary.axis_pass_rates[axis];
            return \`
              <div class="axis-row">
                <div class="model-name">\${model.model_id}</div>
                <div class="rate-track"><div class="rate-fill" style="width:\${Math.max(rate * 100, 2)}%"></div></div>
                <div class="rate-text">\${pct(rate)}</div>
              </div>
            \`;
          })
          .join("");

        return \`
          <article class="axis-card">
            <h3>\${AXIS_LABELS[axis]}</h3>
            \${rows}
          </article>
        \`;
      }).join("");
    }

    function allRowIds() {
      const ids = new Set();
      for (const model of DATA.models) {
        for (const row of model.rows) ids.add(row.row_id);
      }
      return [...ids].sort((a, b) => a.localeCompare(b));
    }

    function rowLookup(model, rowId) {
      return model.rows.find((row) => row.row_id === rowId) ?? null;
    }

    function renderHeatmap() {
      const wrap = document.getElementById("heatmap-wrap");
      const models = sortedModels();
      const rowIds = allRowIds().filter((rowId) =>
        rowId.toLowerCase().includes(state.rowFilter.trim().toLowerCase()),
      );

      if (!models.length) {
        wrap.innerHTML = "";
        return;
      }

      wrap.innerHTML = \`
        <table class="heatmap">
          <thead>
            <tr>
              <th class="sticky">Row</th>
              \${models.map((model) => \`<th>\${model.model_id.replace(/-GGUF.*/, "")}</th>\`).join("")}
            </tr>
          </thead>
          <tbody>
            \${rowIds
              .map((rowId) => {
                const cells = models
                  .map((model) => {
                    const row = rowLookup(model, rowId);
                    if (!row) {
                      return '<td class="cell cell-missing">—</td>';
                    }
                    const klass = row.passed ? "cell-pass" : "cell-fail";
                    const label = row.passed ? "✓" : "✗";
                    const axisLines = AXES.map((axis) => {
                      const outcome = row.axes[axis];
                      const mark = outcome.passed ? "✓" : "✗";
                      return mark + " " + AXIS_LABELS[axis] + ": " + outcome.details;
                    }).join("\\n");
                    const tip =
                      model.model_id + " / " + rowId + " (" + formatMs(row.duration_ms) + ")\\n" + axisLines;
                    return \`<td class="cell \${klass}" data-tip="\${escapeAttr(tip)}">\${label}</td>\`;
                  })
                  .join("");

                return \`
                  <tr>
                    <td class="sticky row-id">\${rowId}</td>
                    \${cells}
                  </tr>
                \`;
              })
              .join("")}
          </tbody>
        </table>
      \`;

      const tooltip = document.getElementById("tooltip");
      wrap.querySelectorAll("[data-tip]").forEach((cell) => {
        cell.addEventListener("mouseenter", (event) => {
          tooltip.textContent = cell.dataset.tip;
          tooltip.style.display = "block";
          moveTooltip(event);
        });
        cell.addEventListener("mousemove", moveTooltip);
        cell.addEventListener("mouseleave", () => {
          tooltip.style.display = "none";
        });
      });

      function moveTooltip(event) {
        tooltip.style.left = event.clientX + 14 + "px";
        tooltip.style.top = event.clientY + 14 + "px";
      }
    }

    function escapeAttr(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;");
    }

    function renderAll() {
      renderSummaryCards();
      renderLeaderboard();
      renderAxisGrid();
      renderHeatmap();
    }

    document.getElementById("sort-select").addEventListener("change", (event) => {
      state.sortKey = event.target.value;
      state.sortDir = state.sortKey === "model_id" ? "asc" : "desc";
      renderLeaderboard();
      renderAxisGrid();
      renderHeatmap();
    });

    document.getElementById("row-filter").addEventListener("input", (event) => {
      state.rowFilter = event.target.value;
      renderHeatmap();
    });

    renderAll();
  </script>
</body>
</html>`;
}
