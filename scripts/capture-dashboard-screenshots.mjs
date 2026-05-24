import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const repoRoot = join(import.meta.dirname, "..");
const outDir = join(repoRoot, "docs/images");
const port = 4173;
const baseUrl = `http://127.0.0.1:${port}/dashboard.html`;

const server = spawn("bunx", ["serve", ".", "-p", String(port)], {
  cwd: repoRoot,
  stdio: "pipe",
});

await new Promise((resolve) => setTimeout(resolve, 1500));

try {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#leaderboard-wrap table tbody tr");

  await page.screenshot({
    path: join(outDir, "dashboard-leaderboard.png"),
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });

  const resultsPanel = page.locator(".panel:has(#heatmap-wrap)");
  await resultsPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const completionCard = page.locator(".axis-card h3", { hasText: "Completion" }).locator("..");
  const heatmapPanel = page.locator(".panel:has(#heatmap-wrap)");

  const completionBox = await completionCard.boundingBox();
  const heatmapBox = await heatmapPanel.boundingBox();

  if (completionBox && heatmapBox) {
    const y = Math.max(0, completionBox.y - 8);
    const height = heatmapBox.y + heatmapBox.height - y + 8;
    await page.screenshot({
      path: join(outDir, "dashboard-heatmap.png"),
      clip: { x: 0, y, width: 1440, height: Math.min(height, 1200) },
    });
  } else {
    await heatmapPanel.screenshot({ path: join(outDir, "dashboard-heatmap.png") });
  }

  await browser.close();
  console.error(`wrote ${join(outDir, "dashboard-leaderboard.png")}`);
  console.error(`wrote ${join(outDir, "dashboard-heatmap.png")}`);
} finally {
  server.kill("SIGTERM");
}
