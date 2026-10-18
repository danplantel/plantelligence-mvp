/**
 * Generate the PWA icon set from the platform mark.
 *
 * The source (`public/plantelligence-logos/pt_icon_light.png`) is the dark mark on transparency for
 * light surfaces, 110×161 portrait — not a valid app icon by itself. Browsers require square PNGs at
 * 192 and 512 (plus a maskable 512 for Android's adaptive icon), and iOS wants a 180 apple-touch
 * icon. This script centres the mark on a square canvas at the padding each format expects.
 *
 * Run: `npx tsx scripts/pwa/generate-icons.ts`
 *
 * Output is committed under `public/pwa/` — the app reads it at runtime, never at build time, so a
 * deploy does not need this script to run.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** The mark for LIGHT surfaces (centred on white). */
const SOURCE_ON_LIGHT = path.join(
  process.cwd(),
  "public",
  "plantelligence-logos",
  "pt_icon_light.png",
);
/** The mark for DARK surfaces (centred on brand navy for the maskable icon). */
const SOURCE_ON_DARK = path.join(
  process.cwd(),
  "public",
  "plantelligence-logos",
  "pt_icon_dark.png",
);
const OUT_DIR = path.join(process.cwd(), "public", "pwa");

/** Brand navy used behind the maskable icon so Android's mask has a solid field. */
const MASK_BACKGROUND = "#1F3A60";
const LIGHT_BACKGROUND = "#FFFFFF";

interface IconSpec {
  file: string;
  size: number;
  /** Height of the mark as a fraction of the canvas. */
  ratio: number;
  background: string;
  source: string;
}

const SPECS: IconSpec[] = [
  {
    file: "icon-192.png",
    size: 192,
    ratio: 0.72,
    background: LIGHT_BACKGROUND,
    source: SOURCE_ON_LIGHT,
  },
  {
    file: "icon-512.png",
    size: 512,
    ratio: 0.72,
    background: LIGHT_BACKGROUND,
    source: SOURCE_ON_LIGHT,
  },
  // Maskable: the mark must survive a circular crop, so it sits well inside the safe zone — and it
  // is the dark-surface mark, because the field behind it is brand navy.
  {
    file: "icon-maskable-512.png",
    size: 512,
    ratio: 0.5,
    background: MASK_BACKGROUND,
    source: SOURCE_ON_DARK,
  },
  {
    file: "apple-touch-icon.png",
    size: 180,
    ratio: 0.72,
    background: LIGHT_BACKGROUND,
    source: SOURCE_ON_LIGHT,
  },
];

async function render(spec: IconSpec): Promise<void> {
  const mark = await sharp(spec.source)
    .resize({
      height: Math.round(spec.size * spec.ratio),
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: spec.size,
      height: spec.size,
      channels: 4,
      background: spec.background,
    },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(path.join(OUT_DIR, spec.file));

  console.log(`[pwa] wrote public/pwa/${spec.file} (${spec.size}×${spec.size})`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const spec of SPECS) await render(spec);
}

main().catch((error) => {
  console.error("[pwa] icon generation failed:", error);
  process.exit(1);
});
