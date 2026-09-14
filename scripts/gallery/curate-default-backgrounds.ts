/**
 * Curates the "Choose a Default Image" background picker sets.
 *
 * The full data/gallery-metadata.json manifest is ~600 KB and every record is a
 * wide, 16:9, "Default Image Library" banner — so importing the whole manifest
 * into a client picker is heavy and unfiltered. Instead this script writes
 * lightweight derived files (id, title, category, mode, src, altText only) that
 * client pickers import directly.
 *
 * Goal: every one of the 250 library images is offered somewhere. The curated
 * ids below only control the *order* (editorial, best-first) at the top of each
 * gallery; the remaining eligible records are appended so nothing goes unused.
 *
 * Produced datasets:
 *
 * 1. data/gallery-default-backgrounds.json — the shared "Choose a Default Image"
 *    fallback used by the benefit-hub / advisor background picks, the new-client
 *    banner / welcome-thumbnail / hero-background pickers, the onboarding Step 3
 *    background, and the video wizard. Now contains the ENTIRE 250-image library
 *    (curated picks first, then every other record in manifest order).
 *
 * 2. data/gallery-homepage-backgrounds.json — company "home page of the website"
 *    backgrounds (used by the new-client Step 1 Brand Images picker). Starts with
 *    the curated general / corporate / workplace / community / aspirational scenes
 *    and then appends every remaining homepage-appropriate record. Medical /
 *    clinical (Group Health) and tabletop benefit-prop scenes are intentionally
 *    excluded so the site-home picker stays on-brand (those still appear in the
 *    default gallery and the per-category gallery).
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
 *   is not banner-appropriate. Appended (non-curated) and category records skip
 *   (with a warning) any record that isn't banner-safe or whose file is missing.
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
  environments?: string[];
}

/**
 * Editorial ordering hints. These ids are placed first (in this order) so the
 * strongest imagery leads each gallery; every remaining eligible record is
 * appended afterwards so the full library is reachable.
 */
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

if (!existsSync(MANIFEST_PATH)) {
  console.error(
    "[gallery:curate] data/gallery-metadata.json is missing. Run `pnpm gallery:sync` first.",
  );
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(MANIFEST_PATH, "utf8"),
) as GalleryRecord[];
const byId = new Map(manifest.map((r) => [r.id, r]));

const has = (value: unknown, term: string) =>
  Array.isArray(value) && value.includes(term);

const isBannerSafe = (record: GalleryRecord) =>
  has(record.visualStyles, "Wide Banner") &&
  has(record.composition, "16:9 Banner Safe") &&
  has(record.useCases, "Default Image Library");

const fileExists = (record: GalleryRecord) =>
  existsSync(join(IMAGES_DIR, record.src.replace("/gallery/", "")));

/** Every manifest record that is safe to show in a banner picker. */
const bannerSafe = manifest.filter(isBannerSafe);

// Resolve + validate the curated (editorial) ids. A curated id that is missing,
// has no file, or isn't banner-appropriate is a hard error so a broken manifest
// is caught during curation rather than at runtime.
const resolveCurated = (ids: string[]): GalleryRecord[] => {
  const curated: GalleryRecord[] = [];
  for (const id of ids) {
    const record = byId.get(id);
    if (!record) {
      console.error(
        `[gallery:curate] curated id "${id}" was not found in data/gallery-metadata.json.`,
      );
      process.exit(1);
    }
    if (!fileExists(record)) {
      console.error(
        `[gallery:curate] "${record.id}" src does not resolve to a real file: ${record.src}`,
      );
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

/** Curated ids first (editorial order), then every remaining eligible record. */
const withCuratedFirst = (
  curatedIds: string[],
  eligible: GalleryRecord[],
): GalleryRecord[] => {
  const ordered = resolveCurated(curatedIds);
  const seen = new Set(ordered.map((r) => r.id));
  for (const record of eligible) {
    if (!fileExists(record)) {
      console.warn(
        `[gallery:curate] skipping "${record.id}" (${record.title}) — file missing.`,
      );
      continue;
    }
    if (!seen.has(record.id)) {
      ordered.push(record);
      seen.add(record.id);
    }
  }
  return ordered;
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

// ── 1. Default "Choose a Default Image" gallery: the ENTIRE library ─────────
// Curated picks lead, then every remaining banner-safe record (manifest order)
// so no library image is unreachable from the shared default picker.
const benefitRecords = withCuratedFirst(BENEFIT_CURATED_IDS, bannerSafe);
const benefitPayload = toPayload(benefitRecords);
writeFileSync(
  BENEFIT_OUTPUT_PATH,
  `${JSON.stringify(benefitPayload, null, 2)}\n`,
  "utf8",
);
console.log(
  `[gallery:curate] wrote ${benefitPayload.length} benefit-hub default backgrounds ` +
    `(full library) to ${BENEFIT_OUTPUT_PATH}`,
);

// ── 2. Homepage / website-home backgrounds ──────────────────────────────────
// Curated general/corporate picks first, then every remaining record that is not
// medical/clinical (Group Health) or a tabletop benefit-prop scene.
const isHomepageAppropriate = (record: GalleryRecord) =>
  record.category !== "Group Health" &&
  !has(record.environments, "Studio / Tabletop");

const homepageRecords = withCuratedFirst(
  HOMEPAGE_CURATED_IDS,
  bannerSafe.filter(isHomepageAppropriate),
);
const homepagePayload = toPayload(homepageRecords);
writeFileSync(
  HOMEPAGE_OUTPUT_PATH,
  `${JSON.stringify(homepagePayload, null, 2)}\n`,
  "utf8",
);
console.log(
  `[gallery:curate] wrote ${homepagePayload.length} homepage backgrounds to ${HOMEPAGE_OUTPUT_PATH}`,
);

// ── 3. Per-benefit-category gallery (Create Benefits wizard) ────────────────
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
console.log(
  `[gallery:curate] wrote per-category gallery to ${CATEGORY_OUTPUT_PATH}`,
);
