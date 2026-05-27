import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Playwright visual QA snapshot harness.
 *
 * Usage:
 *   PWND_DEV_URL=http://localhost:5173 pnpm vqa
 *
 * If PWND_DEV_URL is not set, the script spawns `pnpm dev` internally.
 */
import { chromium } from "@playwright/test";
import { SCENARIOS } from "./scenarios.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const DEV_URL = process.env.PWND_DEV_URL ?? "http://localhost:5174";
const RUNS_DIR = path.join(__dirname, "runs");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = path.join(RUNS_DIR, RUN_ID);

fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { status } = await fetch(url);
      if (status < 500) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server not ready after ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  let devServer: ReturnType<typeof spawn> | null = null;

  if (!process.env.PWND_DEV_URL) {
    console.log("Spawning dev server…");
    devServer = spawn("pnpm", ["dev"], {
      cwd: ROOT,
      stdio: "pipe",
      shell: true,
    });
    devServer.stderr?.on("data", (d: Buffer) => process.stderr.write(d));
    await waitForServer(DEV_URL);
    console.log(`Dev server ready at ${DEV_URL}`);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 900 } },
  });

  try {
    for (const scenario of SCENARIOS) {
      console.log(`Scenario: ${scenario.id}`);
      const page = await context.newPage();

      // Seed localStorage before navigation
      const gameId = `vqa-${scenario.id}`;
      const session = {
        createdAt: new Date().toISOString(),
        mode: scenario.mode,
        moves: scenario.moves,
      };

      await page.goto(DEV_URL);
      await page.evaluate(
        ([key, value]) => {
          localStorage.setItem(key as string, JSON.stringify(value));
        },
        [`pwnd:game:${gameId}`, session],
      );

      // Navigate to the game
      await page.goto(`${DEV_URL}/game/${gameId}?mode=${scenario.mode}`);

      // Wait for canvas to be ready
      await page.waitForSelector('canvas[data-canvas-ready="true"]', {
        timeout: 15_000,
      });

      // Give Three.js a moment to render
      await page.waitForTimeout(1500);

      const screenshotPath = path.join(OUT_DIR, `${scenario.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  → ${screenshotPath}`);

      await page.close();
    }
  } finally {
    await context.close();
    await browser.close();
    devServer?.kill();
  }

  console.log(`\nSnapshots written to ${OUT_DIR}`);

  // Append to CHANGELOG
  const changelogPath = path.join(__dirname, "CHANGELOG.md");
  const entry = `\n## ${RUN_ID}\n\n${SCENARIOS.map((s) => `- ${s.id}: ${s.description}`).join("\n")}\n`;
  fs.appendFileSync(changelogPath, entry);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
