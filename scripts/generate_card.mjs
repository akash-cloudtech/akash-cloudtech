// Builds the signature "neofetch --incident" card (dark + light) for the profile README.
// Run: node scripts/generate_card.mjs
// Local iteration without hitting the GitHub API: node scripts/preview.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const THEMES = {
  dark: {
    bgTop: "#0D1117", bgBottom: "#131A2A",
    text: "#C9D1D9", dim: "#7D8590", rule: "#30363D",
    cyan: "#22D3EE", green: "#39D353", amber: "#FFA657", magenta: "#FF2BD6",
  },
  light: {
    bgTop: "#FFFFFF", bgBottom: "#FFFFFF",
    text: "#24292F", dim: "#57606A", rule: "#D0D7DE",
    cyan: "#0969DA", green: "#1A7F37", amber: "#9A6700", magenta: "#BF3989",
  },
};

const W = 900, H = 480;
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function xe(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function loadProfile() {
  const raw = await readFile(path.join(ROOT, "data", "profile.json"), "utf-8");
  return JSON.parse(raw);
}

export async function fetchLiveStats(username) {
  const headers = { "User-Agent": "akash-cloudtech-profile-card" };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${username}`, { headers });
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const json = await res.json();
  return {
    publicRepos: String(json.public_repos ?? "?"),
    followers: String(json.followers ?? "?"),
  };
}

// ---- Left column: identity, revealed row by row with a clipPath typewriter sweep ----
const ROW_DUR = 0.14;
const ROW_H = 24;
const COL_TEXT_WIDTH = 418;
const LEFT_X = 24;
const LABEL_X = LEFT_X + 28;
const VALUE_X = LEFT_X + 112;
const ROW_FONT_SIZE = 12.5;
const LEFT_TOP_Y = 78;

function buildLeftColumn(c, profile, liveStats) {
  const rows = [
    { kind: "header" },
    { icon: "🛡️", label: "Role", value: profile.role },
    { icon: "🏢", label: "Company", value: profile.company },
    { icon: "⏳", label: "Experience", value: profile.experienceLabel },
    { icon: "📦", label: "Repos", value: liveStats.publicRepos },
    { icon: "👥", label: "Followers", value: liveStats.followers },
  ];

  let svg = "";
  rows.forEach((row, i) => {
    const begin = i * ROW_DUR;
    const yTop = LEFT_TOP_Y + i * ROW_H - 15;
    const yText = LEFT_TOP_Y + i * ROW_H;

    let inner, fontSize;
    if (row.kind === "header") {
      fontSize = 13;
      inner = `<tspan fill="${c.green}" font-weight="700">${xe(profile.handle)}</tspan>` +
        `<tspan fill="${c.dim}">@</tspan>` +
        `<tspan fill="${c.cyan}" font-weight="700">github</tspan>`;
    } else {
      fontSize = ROW_FONT_SIZE;
      inner = `<tspan>${xe(row.icon)}</tspan>` +
        `<tspan x="${LABEL_X}" fill="${c.dim}">${xe(row.label)}</tspan>` +
        `<tspan x="${VALUE_X}" fill="${c.text}">${xe(row.value)}</tspan>`;
    }

    svg += `<clipPath id="lrow${i}"><rect x="${LEFT_X}" y="${yTop}" height="${ROW_H}" width="0">` +
      `<animate attributeName="width" from="0" to="${COL_TEXT_WIDTH}" begin="${begin.toFixed(3)}s" dur="${ROW_DUR}s" fill="freeze"/>` +
      `</rect></clipPath>\n` +
      `<g clip-path="url(#lrow${i})"><text xml:space="preserve" x="${LEFT_X}" y="${yText}" fill="${c.text}" font-size="${fontSize}">${inner}</text></g>\n`;

    if (row.kind === "header") {
      const ruleY = yText - 8;
      svg += `<line x1="${LEFT_X}" y1="${ruleY}" x2="${LEFT_X + COL_TEXT_WIDTH}" y2="${ruleY}" stroke="${c.rule}" opacity="0">` +
        `<set attributeName="opacity" to="0.8" begin="${(begin + ROW_DUR).toFixed(3)}s"/></line>\n`;
    }
  });

  return { svg, totalDuration: rows.length * ROW_DUR };
}

// ---- Right column: 2x3 incident-dashboard tiles, staggered slide + fade ----
const GRID_X = 466, GRID_TOP = 68;
const TILE_W = 198, TILE_H = 92, GAP = 14;
const SLIDE_DUR = 0.4, STEP = 0.12;

function tile(c, { label, value, border, glow, caption }) {
  return { label, value, border, glow, caption };
}

function buildRightTiles(c, profile, startTime) {
  const tiles = [
    tile(c, { label: "SLO / UPTIME", value: `✅ ${profile.stats.uptimeSlo}`, border: c.cyan }),
    tile(c, { label: "NODES MANAGED", value: `🖥️ ${profile.stats.nodesManaged}`, border: c.cyan }),
    tile(c, { label: "MANUAL TOIL", value: `📉 down ${profile.stats.toilReduced}`, border: c.green }),
    tile(c, { label: "ON-CALL", value: `📟 ${profile.onCall.status}`, border: c.amber, glow: true, caption: profile.onCall.note }),
    tile(c, { label: `NAMESPACE \`${profile.joke.namespace}\``, value: `💀 ${profile.joke.verdict}`, border: c.magenta, caption: profile.joke.caption }),
    tile(c, { label: "COMPUTE FOOTPRINT", value: `☁️ ${profile.stats.computeResources} · ${profile.stats.clouds} clouds`, border: c.cyan }),
  ];

  let svg = "";
  let maxEnd = 0;
  tiles.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = GRID_X + col * (TILE_W + GAP);
    const y = GRID_TOP + row * (TILE_H + GAP);
    const begin = startTime + i * STEP;
    maxEnd = Math.max(maxEnd, begin + SLIDE_DUR);

    svg += `<g opacity="0" transform="translate(0,8)">` +
      `<rect x="${x}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="10" fill="none" stroke="${t.border}" stroke-width="1.4"/>` +
      `<text x="${x + 12}" y="${y + 22}" fill="${c.dim}" font-size="10.5" font-weight="700" letter-spacing="0.5">${xe(t.label)}</text>` +
      `<text x="${x + 12}" y="${y + 46}" fill="${c.text}" font-size="16" font-weight="700">${xe(t.value)}</text>` +
      (t.caption ? `<text x="${x + 12}" y="${y + 68}" fill="${c.dim}" font-size="9.5" font-style="italic">${xe(t.caption)}</text>` : "") +
      `<animate attributeName="opacity" from="0" to="1" begin="${begin.toFixed(3)}s" dur="${SLIDE_DUR}s" fill="freeze"/>` +
      `<animateTransform attributeName="transform" type="translate" from="0 8" to="0 0" begin="${begin.toFixed(3)}s" dur="${SLIDE_DUR}s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1"/>` +
      (t.glow ? `<animate attributeName="stroke-opacity" values="1;0.35;1" begin="${(begin + SLIDE_DUR).toFixed(3)}s" dur="2.2s" repeatCount="indefinite"/>` : "") +
      `</g>\n`;
  });

  return { svg, maxEnd };
}

function buildCard(theme, profile, liveStats) {
  const c = THEMES[theme];
  const left = buildLeftColumn(c, profile, liveStats);
  const right = buildRightTiles(c, profile, left.totalDuration);
  const footerBegin = right.maxEnd + 0.15;

  const title = `${profile.handle}@sre: neofetch --incident`;
  const titleCursorX = W / 2 + (title.length * 7.15) / 2 + 4;

  const footer = `<line x1="0" y1="404" x2="${W}" y2="404" stroke="${c.rule}"/>` +
    `<polyline points="24,392 90,384 156,394 222,378 288,390 354,382 420,392" fill="none" stroke="${c.cyan}" stroke-width="1.6" opacity="0.85"/>` +
    `<text x="24" y="418" fill="${c.dim}" font-size="10" font-style="italic">${xe(profile.sparklineCaption)}</text>` +
    `<g opacity="0"><text x="24" y="444" fill="${c.dim}" font-size="12.5">${xe(profile.footer.prompt)}</text>` +
    `<animate attributeName="opacity" from="0" to="1" begin="${footerBegin.toFixed(3)}s" dur="0.3s" fill="freeze"/></g>` +
    `<g opacity="0"><text x="24" y="464" fill="${c.text}" font-size="12.5">${xe(profile.footer.response)}</text>` +
    `<animate attributeName="opacity" from="0" to="1" begin="${(footerBegin + 0.4).toFixed(3)}s" dur="0.3s" fill="freeze"/>` +
    `<rect x="${24 + profile.footer.response.length * 6.9}" y="452" width="7" height="13" fill="${c.text}">` +
    `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.51;1" begin="${(footerBegin + 0.7).toFixed(3)}s" dur="1s" repeatCount="indefinite"/></rect></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<defs>
  <linearGradient id="bg-${theme}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c.bgTop}"/>
    <stop offset="1" stop-color="${c.bgBottom}"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" rx="14" fill="url(#bg-${theme})"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${c.rule}"/>
<line x1="0" y1="32" x2="${W}" y2="32" stroke="${c.rule}"/>
<circle cx="20" cy="16" r="5" fill="#ff5f56"/>
<circle cx="36" cy="16" r="5" fill="#ffbd2e"/>
<circle cx="52" cy="16" r="5" fill="#27c93f"/>
<text x="${W / 2}" y="20.5" fill="${c.dim}" font-size="12" text-anchor="middle">${xe(title)}</text>
<rect x="${titleCursorX.toFixed(1)}" y="9" width="7" height="14" fill="${c.dim}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.51;1" dur="1s" repeatCount="indefinite"/></rect>
<line x1="450" y1="40" x2="450" y2="384" stroke="${c.rule}"/>
${left.svg}
${right.svg}
${footer}
</svg>`;
}

async function main() {
  const profile = await loadProfile();
  let liveStats;
  try {
    liveStats = await fetchLiveStats(profile.handle);
  } catch (err) {
    console.warn(`[warn] Falling back, GitHub API call failed: ${err.message}`);
    liveStats = { publicRepos: "?", followers: "?" };
  }

  for (const theme of ["dark", "light"]) {
    const svg = buildCard(theme, profile, liveStats);
    const outPath = path.join(ROOT, "assets", `signature-card-${theme}.svg`);
    await writeFile(outPath, svg, "utf-8");
    console.log(`[ok] wrote ${outPath}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { buildCard };
