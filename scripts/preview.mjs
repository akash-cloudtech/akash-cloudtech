// Local iteration helper: builds both theme cards using fake stats, no GitHub API call.
// Run: node scripts/preview.mjs

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildCard, loadProfile } from "./generate_card.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FAKE_LIVE_STATS = { publicRepos: "42", followers: "128" };

async function main() {
  const profile = await loadProfile();
  for (const theme of ["dark", "light"]) {
    const svg = buildCard(theme, profile, FAKE_LIVE_STATS);
    const outPath = path.join(ROOT, "assets", `signature-card-${theme}.preview.svg`);
    await writeFile(outPath, svg, "utf-8");
    console.log(`[ok] wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
