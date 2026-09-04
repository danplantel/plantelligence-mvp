/**
 * Curates the "Choose a Default Image" background picker set.
 *
 * The full data/gallery-metadata.json manifest is ~600 KB and every record is a
 * wide, 16:9, "Default Image Library" banner — so importing the whole manifest
 * into the client picker is both heavy and unfiltered. Instead this script picks
 * a small, editorial subset of banner-appropriate images that read well as an
 * advisor profile / benefits header background (aspirational, corporate,
 * people/lifestyle, financial & retirement scenes) and writes them to a tiny
 * derived file that the client modal imports directly.
 *
 * Run: pnpm gallery:curate
 *
 * - Source of truth: data/gallery-metadata.json (id, title, category, src, altText)
 * - Output: data/gallery-default-backgrounds.json (only the curated fields)
 * - Aborts with a clear message if a curated id is missing from the manifest or
 *   its `src` does not resolve to a real file under public/gallery.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const PROJECT_ROOT = resolve(__dirname, "..", "..");
const MANIFEST_PATH = join(PROJECT_ROOT, "data", "gallery-metadata.json");
const OUTPUT_PATH = join(PROJECT_ROOT, "data", "gallery-default-backgrounds.json");
const IMAGES_DIR = join(PROJECT_ROOT, "public", "gallery");

interface GalleryRecord {
  id: string;
  title: string;
  category: string;
  mode: string;
  src: string;
  altText: string;
  visualStyles?: string[];
  composition?: string[];
  useCases?: string[];
}

/**
 * Editorial curated set (ordered). IDs come from data/gallery-metadata.json.
 * Chosen to be professional, banner-safe, and broad enough for the advisor's
 * profile background header — which also pre-populates the Benefits Wizard
 * Step 1 "Background Image" for the advisor's primary service categories.
 */
const CURATED_IDS = [
  "7c8bd5a07bb4", // 001 Destination Possibility
  "10dc58c349a2", // 003 Home And Stability
  "18ee9ce1029e", // 005 Personal Achievement
  "685b9096a77a", // 007 Community Belonging
  "f3f801ed55b4", // 009 Discovery And Travel
  "89e95b8f8701", // 013 Corporate Scale Mixed Architecture
  "c6fe6534fee7", // 014 Future Horizon Coastal Inlet
  "f7286930e5fb", // 027 Retirement Adventure
  "bcf3334fb856", // 028 Financial Planning Conversation
  "9922f3aeebc3", // 100 A Destination Of Your Own
  "d7b326ba0e90", // 111 The Destination Beyond The Ridge
  "57f4b4eb8efe", // 145 Reaching The Next Summit
  "27df1ce59129", // 165 Corporate City Momentum
  "9ef75246698d", // 168 Connected Corporate City
  "5e9274f4c472", // 178 Active Retirement On The Lake
  "e720cebf7791", // 199 Retirement Outlook Together
  "0ec97bd0ef87", // 207 Travel On The Horizon
  "71cfc3a21df9", // 240 Morning Wellness Practice
];

if (!existsSync(MANIFEST_PATH)) {
  console.error("[gallery:curate] data/gallery-metadata.json is missing. Run `pnpm gallery:sync` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as GalleryRecord[];
const byId = new Map(manifest.map((r) => [r.id, r]));

// 1. Resolve + validate every curated id. Also assert each candidate is a
//    banner-appropriate default (Wide Banner + 16:9 Banner Safe + part of the
//    Default Image Library), so a future replacement can't silently regress the
//    picker to a non-banner image.
const has = (value: unknown, term: string) =>
  Array.isArray(value) && value.includes(term);

const curated: GalleryRecord[] = [];
for (const id of CURATED_IDS) {
  const record = byId.get(id);
  if (!record) {
    console.error(`[gallery:curate] curated id "${id}" was not found in data/gallery-metadata.json.`);
    process.exit(1);
  }
  const file = join(IMAGES_DIR, record.src.replace("/gallery/", ""));
  if (!existsSync(file)) {
    console.error(`[gallery:curate] "${record.id}" src does not resolve to a real file: ${record.src}`);
    process.exit(1);
  }
  const bannerSafe =
    has(record.visualStyles, "Wide Banner") &&
    has(record.composition, "16:9 Banner Safe") &&
    has(record.useCases, "Default Image Library");
  if (!bannerSafe) {
    console.error(
      `[gallery:curate] "${record.id}" (${record.title}) is not banner-appropriate ` +
        `(requires visualStyles "Wide Banner", composition "16:9 Banner Safe", and ` +
        `useCases "Default Image Library").`,
    );
    process.exit(1);
  }
  curated.push(record);
}

// 2. Emit only the fields the picker needs (keeps the client payload tiny).
const payload = curated.map(({ id, title, category, mode, src, altText }) => ({
  id,
  title,
  category,
  mode,
  src,
  altText,
}));

writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `[gallery:curate] wrote ${payload.length} curated default backgrounds to data/gallery-default-backgrounds.json`,
);
