/**
 * Curates the "Choose a Default Image" background picker sets.
 *
 * The full data/gallery-metadata.json manifest is ~600 KB and every record is a
 * wide, 16:9, "Default Image Library" banner — so importing the whole manifest
 * into a client picker is both heavy and unfiltered. Instead this script picks
 * small editorial subsets and writes lightweight derived files that client
 * pickers import directly.
 *
 * Produced datasets:
 *
 * 1. data/gallery-default-backgrounds.json — benefit-hub / advisor backgrounds.
 *    Chosen to read well behind an advisor profile / benefit-hub header
 *    (aspirational, corporate, people/lifestyle, financial & retirement scenes).
 *
 * 2. data/gallery-homepage-backgrounds.json — company "home page of the website"
 *    backgrounds (used by the new-client Step 1 Brand Images picker). Chosen as
 *    general / corporate / workplace / community / aspirational scenes — with NO
 *    medical/clinical or tabletop benefit-prop imagery.
 *
 * 3. data/gallery-benefit-category-backgrounds.json — per-benefit-category
 *    gallery for the Create Benefits wizard. Each list is derived from the
 *    metadata (every image whose top-level `category` matches), so the images
 *    shown for Retirement / Group Health / Group Life / Wellness genuinely align
 *    with the benefit being configured (Custom / Company hubs use Wellness).
 *
 * Run: pnpm gallery:curate
 *
 * - Source of truth: data/gallery-metadata.json (id, title, category, src, altText)
 * - Aborts with a clear message if a curated id is missing from the manifest,
 *   its `src` does not resolve to a real file under public/gallery, or the image
 *   is not banner-appropriate. Category subsets skip (with a warning) any record
 *   that isn't banner-safe or whose file is missing.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const PROJECT_ROOT = resolve(__dirname, "..", "..");
const MANIFEST_PATH = join(PROJECT_ROOT, "data", "gallery-metadata.json");
const BENEFIT_OUTPUT_PATH = join(
  PROJECT_ROOT,
  "data",
  "gallery-default-backgrounds.json",
);
const HOMEPAGE_OUTPUT_PATH = join(
  PROJECT_ROOT,
  "data",
  "gallery-homepage-backgrounds.json",
);
const CATEGORY_OUTPUT_PATH = join(
  PROJECT_ROOT,
  "data",
  "gallery-benefit-category-backgrounds.json",
);
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

/** Benefit-hub / advisor profile backgrounds (editorial order). */
const BENEFIT_CURATED_IDS = [
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

/** Company "home page of the website" backgrounds (editorial order). These are
 *  general / corporate / workplace / community / aspirational — intentionally
 *  excluding medical/clinical and tabletop benefit-prop scenes. */
const HOMEPAGE_CURATED_IDS = [
  "18ee9ce1029e", // 005 Personal Achievement
  "685b9096a77a", // 007 Community Belonging
  "f3f801ed55b4", // 009 Discovery And Travel
  "89e95b8f8701", // 013 Corporate Scale Mixed Architecture
  "4fa1edf01591", // 073 Financial Services Analysts
  "6b7c28f7a50a", // 074 Financial Services Branch Team
  "20c7857c5a60", // 075 Professional Services Mentoring
  "977824de2d0d", // 076 Professional Services Team
  "5ffd2f78d491", // 087 Corporate Architecture Growth
  "9922f3aeebc3", // 100 A Destination Of Your Own
  "cbb7ccfb7f7d", // 120 Workplace Momentum In The City
  "aeac2b2d6ff8", // 135 Hallway Collaboration
  "57f4b4eb8efe", // 145 Reaching The Next Summit
  "27df1ce59129", // 165 Corporate City Momentum
  "127a76b43c56", // 166 Workplace Momentum
  "9ef75246698d", // 168 Connected Corporate City
  "8a6938649145", // 175 Creative Team Design Review
  "eb7b8fbf0971", // 177 Coworker Check-in
  "649ffe8d9d75", // 182 Technology Team Problem Solving
  "9573431c612e", // 208 Community Volunteer Day
];

/**
 * Metadata category for each Create Benefits benefit category key. Custom /
 * Company (Plan Sponsor) hubs are wellness-focused, so they use the "Wellness"
 * metadata category.
 */
const CATEGORY_KEYS: Record<string, string> = {
  Retirement: "Retirement",
  "Group Health": "Group Health",
  "Group Life": "Group Life",
  Wellness: "Wellness", // used for "Custom" / "Company / Plan Sponsor"
};

interface CuratedSet {
  outputPath: string;
  ids: string[];
  label: string;
}

const SETS: CuratedSet[] = [
  {
    outputPath: BENEFIT_OUTPUT_PATH,
    ids: BENEFIT_CURATED_IDS,
    label: "benefit-hub default backgrounds",
  },
  {
    outputPath: HOMEPAGE_OUTPUT_PATH,
    ids: HOMEPAGE_CURATED_IDS,
    label: "homepage default backgrounds",
  },
];

if (!existsSync(MANIFEST_PATH)) {
  console.error("[gallery:curate] data/gallery-metadata.json is missing. Run `pnpm gallery:sync` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as GalleryRecord[];
const byId = new Map(manifest.map((r) => [r.id, r]));

const has = (value: unknown, term: string) =>
  Array.isArray(value) && value.includes(term);

const isBannerSafe = (record: GalleryRecord) =>
  has(record.visualStyles, "Wide Banner") &&
  has(record.composition, "16:9 Banner Safe") &&
  has(record.useCases, "Default Image Library");

const fileExists = (record: GalleryRecord) =>
  existsSync(join(IMAGES_DIR, record.src.replace("/gallery/", "")));

// Resolve + validate every curated id.
const resolveCurated = (ids: string[]): GalleryRecord[] => {
  const curated: GalleryRecord[] = [];
  for (const id of ids) {
    const record = byId.get(id);
    if (!record) {
      console.error(`[gallery:curate] curated id "${id}" was not found in data/gallery-metadata.json.`);
      process.exit(1);
    }
    if (!fileExists(record)) {
      console.error(`[gallery:curate] "${record.id}" src does not resolve to a real file: ${record.src}`);
      process.exit(1);
    }
    if (!isBannerSafe(record)) {
      console.error(
        `[gallery:curate] "${record.id}" (${record.title}) is not banner-appropriate ` +
          `(requires visualStyles "Wide Banner", composition "16:9 Banner Safe", and ` +
          `useCases "Default Image Library").`,
      );
      process.exit(1);
    }
    curated.push(record);
  }
  return curated;
};

// Emit only the fields the picker needs (keeps the client payload tiny).
const toPayload = (records: GalleryRecord[]) =>
  records.map(({ id, title, category, mode, src, altText }) => ({
    id,
    title,
    category,
    mode,
    src,
    altText,
  }));

for (const set of SETS) {
  const payload = toPayload(resolveCurated(set.ids));
  writeFileSync(set.outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `[gallery:curate] wrote ${payload.length} ${set.label} to ${set.outputPath}`,
  );
}

// ── Per-benefit-category gallery (Create Benefits wizard) ─────────────────
// Every image whose metadata `category` matches the benefit is included, so the
// "Choose a Default Image" modal offers category-relevant banners. Records that
// aren't banner-safe or whose file is missing are skipped (never fatal).
const categoryPayload: Record<string, ReturnType<typeof toPayload>> = {};
for (const [key, category] of Object.entries(CATEGORY_KEYS)) {
  const records = manifest.filter((r) => r.category === category);
  const valid = records.filter((r) => {
    if (!isBannerSafe(r) || !fileExists(r)) {
      console.warn(
        `[gallery:curate] skipping "${r.id}" (${r.title}) for "${key}" — not banner-safe or file missing.`,
      );
      return false;
    }
    return true;
  });
  categoryPayload[key] = toPayload(valid);
  console.log(
    `[gallery:curate] category "${key}": ${valid.length} backgrounds (${records.length} total in metadata).`,
  );
}
writeFileSync(
  CATEGORY_OUTPUT_PATH,
  `${JSON.stringify(categoryPayload, null, 2)}\n`,
  "utf8",
);
console.log(`[gallery:curate] wrote per-category gallery to ${CATEGORY_OUTPUT_PATH}`);
