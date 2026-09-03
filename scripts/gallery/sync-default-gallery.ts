/**
 * Sync the PlanTelligence "Default Image Library" (250 AI-generated banner images)
 * into this repo and emit a normalized metadata manifest.
 *
 *   npx tsx scripts/gallery/sync-default-gallery.ts [--dry-run] [--force]
 *
 * What it does:
 *   1. Reads metadata.json from the source library folder.
 *   2. Copies every referenced image from <source>/images into public/gallery/,
 *      preserving the real sequenced filenames (NNN-<id>-<slug>.<ext>).
 *   3. Normalizes each record so src matches the deployed file (/gallery/<file>)
 *      and writes data/gallery-metadata.json.
 *   4. Generates data/gallery-controlled-vocabulary.json on first run (if absent)
 *      from the current facet values, so later typos fail validation.
 *   5. Skips files already present with an identical size unless --force is set.
 *
 * Env:
 *   GALLERY_SOURCE_DIR  absolute path to the library folder containing /images and
 *                       metadata.json (defaults to the Downloads copy on this machine).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { asStringArray, VOCAB_FACETS } from "./shared";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_SOURCE_DIR =
  "C:\\Users\\eddie\\Downloads\\plantelligence-benefits-image-library-250";

/** Where to start looking for the library (env overrides the default). */
const SOURCE_START_DIR = process.env.GALLERY_SOURCE_DIR ?? DEFAULT_SOURCE_DIR;

/** Resolved folder that actually contains /images and metadata.json. */
const SOURCE_DIR = findLibraryDir(SOURCE_START_DIR) ?? SOURCE_START_DIR;
const SOURCE_IMAGES_DIR = path.join(SOURCE_DIR, "images");
const SOURCE_MANIFEST_PATH = path.join(SOURCE_DIR, "metadata.json");

const TARGET_IMAGES_DIR = path.join(PROJECT_ROOT, "public", "gallery");
const TARGET_MANIFEST_PATH = path.join(PROJECT_ROOT, "data", "gallery-metadata.json");
const TARGET_VOCAB_PATH = path.join(PROJECT_ROOT, "data", "gallery-controlled-vocabulary.json");
const PUBLIC_URL_PREFIX = "/gallery/";

const LARGE_MASTER_BYTES = 1_500_000;

interface ManifestEntry {
  id?: string;
  src?: string;
  filename?: string;
  originalFilename?: string;
  [key: string]: unknown;
}

function parseFlags(argv: string[]): { dryRun: boolean; force: boolean } {
  const flags = new Set(argv.slice(2));
  return { dryRun: flags.has("--dry-run"), force: flags.has("--force") };
}

/** True when a directory is a library root (contains metadata.json + an images folder). */
function isLibraryDir(dir: string): boolean {
  try {
    return (
      fs.statSync(path.join(dir, "metadata.json")).isFile() &&
      fs.statSync(path.join(dir, "images")).isDirectory()
    );
  } catch {
    return false;
  }
}

/**
 * Find the library root under `start`, handling both flat layouts and common
 * double-nested zip extractions (Downloads/<name>/<name>/…). Bounded search.
 */
function findLibraryDir(start: string): string | null {
  if (isLibraryDir(start)) return start;

  const queue: Array<[string, number]> = [[start, 0]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const [dir, depth] = queue.shift() as [string, number];
    if (depth > 4 || visited.has(dir)) continue;
    visited.add(dir);

    let children: string[] = [];
    try {
      children = fs.readdirSync(dir);
    } catch {
      continue;
    }

    for (const child of children) {
      const full = path.join(dir, child);
      let isDir = false;
      try {
        isDir = fs.statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;
      if (isLibraryDir(full)) return full;
      queue.push([full, depth + 1]);
    }
  }

  return null;
}

function main(): void {
  const { dryRun, force } = parseFlags(process.argv);

  if (!fs.existsSync(SOURCE_MANIFEST_PATH)) {
    console.error(
      `[gallery] metadata.json not found under:\n  ${SOURCE_START_DIR}\n` +
        `Searched for a folder containing /images and metadata.json (flat or nested).\n` +
        `Point GALLERY_SOURCE_DIR at that library folder and re-run.`
    );
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(SOURCE_MANIFEST_PATH, "utf8")) as ManifestEntry[];
  if (!Array.isArray(entries)) {
    console.error("[gallery] metadata.json must contain an array of image records.");
    process.exit(1);
  }

  const sourceNames = new Set(
    fs.existsSync(SOURCE_IMAGES_DIR)
      ? fs.readdirSync(SOURCE_IMAGES_DIR).filter((name) => !name.startsWith("."))
      : []
  );

  fs.mkdirSync(TARGET_IMAGES_DIR, { recursive: true });
  if (!dryRun) fs.mkdirSync(path.dirname(TARGET_MANIFEST_PATH), { recursive: true });

  const normalized: ManifestEntry[] = [];
  const missing: string[] = [];
  let copied = 0;
  let skipped = 0;
  const largeAssets: string[] = [];

  for (const entry of entries) {
    const rawFilename = String(entry.filename ?? entry.originalFilename ?? entry.src ?? "");
    const fileName = path.basename(rawFilename);

    if (!sourceNames.has(fileName)) {
      missing.push(fileName);
      continue;
    }

    const sourceFile = path.join(SOURCE_IMAGES_DIR, fileName);
    const targetFile = path.join(TARGET_IMAGES_DIR, fileName);

    const targetExists = fs.existsSync(targetFile);
    const sameSize =
      targetExists && fs.statSync(sourceFile).size === fs.statSync(targetFile).size;

    if (targetExists && sameSize && !force) {
      skipped += 1;
    } else {
      if (!dryRun) fs.copyFileSync(sourceFile, targetFile);
      copied += 1;
    }

    const sizeBytes = fs.statSync(sourceFile).size;
    if (sizeBytes > LARGE_MASTER_BYTES) {
      largeAssets.push(`${fileName} (${(sizeBytes / 1_000_000).toFixed(1)} MB)`);
    }

    normalized.push({ ...entry, filename: fileName, src: `${PUBLIC_URL_PREFIX}${fileName}` });
  }

  if (!dryRun) {
    fs.writeFileSync(TARGET_MANIFEST_PATH, JSON.stringify(normalized, null, 2) + "\n");
    writeVocabIfAbsent(normalized);
  }

  console.log(`[gallery] source       : ${SOURCE_DIR}`);
  console.log(`[gallery] entries read : ${entries.length}`);
  console.log(`[gallery] copied       : ${copied}${dryRun ? " (dry run — nothing written)" : ""}`);
  console.log(`[gallery] unchanged    : ${skipped}`);
  console.log(`[gallery] missing      : ${missing.length}`);
  if (missing.length > 0) console.log(missing.map((name) => `  - ${name}`).join("\n"));
  if (!dryRun) console.log(`[gallery] manifest     : ${TARGET_MANIFEST_PATH}`);

  if (largeAssets.length > 0) {
    console.warn("[gallery] NOTE large masters (convert to WebP/AVIF before shipping):");
    for (const item of largeAssets) console.warn(`  - ${item}`);
  }

  if (missing.length > 0) process.exit(1);
}

/** Create the controlled-vocabulary file from the manifest if one does not exist yet. */
function writeVocabIfAbsent(entries: ManifestEntry[]): void {
  if (fs.existsSync(TARGET_VOCAB_PATH)) {
    console.log(`[gallery] vocab exists : ${TARGET_VOCAB_PATH} (kept)`);
    return;
  }

  const vocab: Record<string, string[]> = {};
  for (const facet of VOCAB_FACETS) {
    const values = new Set<string>();
    for (const entry of entries) {
      for (const value of asStringArray(entry[facet])) values.add(value);
    }
    vocab[facet] = [...values].sort((a, b) => a.localeCompare(b));
  }

  fs.writeFileSync(TARGET_VOCAB_PATH, JSON.stringify(vocab, null, 2) + "\n");
  console.log(`[gallery] vocab created: ${TARGET_VOCAB_PATH}`);
}

main();
