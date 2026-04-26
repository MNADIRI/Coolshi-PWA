// Generates the pastel sky PNG backgrounds used by the OG image route
// (/api/og/card/[slug]). Run once after changing SKY_GRADIENT in
// src/components/sky/sky.tsx — the PNGs are committed.
//
//   node scripts/generate-sky-pngs.mjs
//
// Requires Chrome installed at the system path below (no Chromium download
// needed thanks to puppeteer-core).

import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_OG = join(__dirname, "..", "public", "og");

// Mirror of SKY_GRADIENT in src/components/sky/sky.tsx.
// Keep these two in sync — the OG image must match the in-app sky.
const SKY_GRADIENT = `
  radial-gradient(80% 60% at 20% 5%, #F7D9D0 0%, transparent 55%),
  radial-gradient(70% 50% at 85% 15%, #F9E3C9 0%, transparent 60%),
  radial-gradient(90% 60% at 10% 30%, #F5EBC5 0%, transparent 60%),
  radial-gradient(80% 55% at 75% 45%, #D7E4CC 0%, transparent 60%),
  radial-gradient(90% 55% at 15% 58%, #CFE4DA 0%, transparent 62%),
  radial-gradient(85% 55% at 80% 68%, #D4E2EC 0%, transparent 60%),
  radial-gradient(90% 55% at 20% 82%, #D8D3EA 0%, transparent 62%),
  radial-gradient(90% 60% at 85% 92%, #E4D2DE 0%, transparent 62%),
  linear-gradient(180deg, #F7D9D0 0%, #F9E3C9 14%, #F5EBC5 28%, #D7E4CC 42%, #CFE4DA 56%, #D4E2EC 70%, #D8D3EA 84%, #E4D2DE 96%)
`;

const VARIANTS = [
  { name: "sky-square.png", w: 1080, h: 1080 },
  { name: "sky-story.png", w: 1080, h: 1920 },
];

const CHROME_PATH_BY_PLATFORM = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
};

const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ?? CHROME_PATH_BY_PLATFORM[process.platform];

if (!executablePath) {
  console.error(`Unsupported platform ${process.platform}. Set PUPPETEER_EXECUTABLE_PATH.`);
  process.exit(1);
}

await mkdir(PUBLIC_OG, { recursive: true });

const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  for (const v of VARIANTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1 });
    const html = `<!doctype html><html><head><style>
      html, body { margin: 0; padding: 0; }
      body {
        width: ${v.w}px; height: ${v.h}px;
        background-image: ${SKY_GRADIENT};
        background-size: 100% 100%;
        background-repeat: no-repeat;
      }
    </style></head><body></body></html>`;
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.screenshot({ type: "png", omitBackground: false });
    const out = join(PUBLIC_OG, v.name);
    await writeFile(out, buffer);
    console.log(`✓ ${v.name} (${v.w}×${v.h}) → ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
}
