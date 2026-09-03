/**
 * Convert large PNG masters in the Default Image Library source folder to lossy
 * WebP and keep the source metadata.json consistent.
 *
 *   npx tsx scripts/gallery/convert-png-to-webp.ts [--dry-run]
 *
 * For every metadata record that references a `.png` file:
 *   1. encodes `<source>/images/<file>.png` -> `<source>/images/<file>.webp`
 *   2. deletes the original `.png`
 *   3. rewrites the record's filename / originalFilename / src extensions and
 *      updates technical.format ("WebP") + technical.fileSizeBytes
 *
 * metadata.json is written back in place (2-space pretty print). PNGs not
 * referenced by the manifest are left untouched. Env GALLERY_SOURCE_DIR
 * overrides the library location.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const DEFAULT_SOURCE_DIR =
  "C:\\Users\\eddie\\Downloads\\plantelligence-benefits-image-library-250";

/** Where to start looking for the library (env overrides the default). */
const SOURCE_START_DIR = process.env.GALLERY_SOURCE_DIR ?? DEFAULT_SOURCE_DIR;

/** Resolved folder that actually contains /images and metadata.json. */
const SOURCE_DIR = findLibraryDir(SOURCE_START_DIR) ?? SOURCE_START_DIR;
const SOURCE_IMAGES_DIR = path.join(SOURCE_DIR, "images");
const SOURCE_MANIFEST_PATH = path.join(SOURCE_DIR, "metadata.json");

const WEBP_QUALITY = 80;

type ManifestEntry = Record<string, unknown>;

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

/** Find the library root under `start`, handling flat and nested extractions. */
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

/** Replace the final extension (e.g. "x.png" -> "x.webp"). */
function withExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)}.${ext}` : `${name}.${ext}`;
}

/** Normalize a URL/path value's final extension to `.webp`. */
function swapUrlExtension(value: string): string {
  const clean = value.replace(/\.png$/i, "");
  return `${clean}.webp`;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  if (!fs.existsSync(SOURCE_MANIFEST_PATH)) {
    console.error(
      `[webp] metadata.json not found under:\n  ${SOURCE_START_DIR}\n` +
        `Point GALLERY_SOURCE_DIR at the library folder and re-run.`
    );
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(SOURCE_MANIFEST_PATH, "utf8")) as ManifestEntry[];
  if (!Array.isArray(entries)) {
    console.error("[webp] metadata.json must contain an array of image records.");
    process.exit(1);
  }

  let converted = 0;
  let skipped = 0;

  for (const entry of entries) {
    const filename = String(entry.filename ?? "");
    const fileName = path.basename(filename);
    if (!/\.png$/i.test(fileName)) continue;

    const sourceFile = path.join(SOURCE_IMAGES_DIR, fileName);
    if (!fs.existsSync(sourceFile)) {
      console.warn(`[webp] missing source (skipped): ${fileName}`);
      skipped += 1;
      continue;
    }

    const webpName = withExtension(fileName, "webp");
    const webpFile = path.join(SOURCE_IMAGES_DIR, webpName);
    const oldSize = fs.statSync(sourceFile).size;

    if (!dryRun) {
      await sharp(sourceFile)
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toFile(webpFile);
      fs.unlinkSync(sourceFile);
    }

    const sizeBytes = dryRun ? oldSize : fs.statSync(webpFile).size;

    const originalFilename = String(entry.originalFilename ?? "");
    const src = String(entry.src ?? "");
    entry.filename = `images/${webpName}`;
    if (originalFilename) entry.originalFilename = swapUrlExtension(originalFilename);
    if (src) entry.src = swapUrlExtension(src);
    if (entry.technical && typeof entry.technical === "object") {
      const technical = entry.technical as Record<string, unknown>;
      technical.format = "WebP";
      technical.fileSizeBytes = sizeBytes;
    }

    converted += 1;
    const savedMb = ((oldSize - sizeBytes) / 1_000_000).toFixed(1);
    console.log(
      `[webp] ${fileName} -> ${webpName} (${(oldSize / 1_000_000).toFixed(1)} MB -> ${(sizeBytes / 1_000_000).toFixed(2)} MB, saves ${savedMb} MB)`
    );
  }

  if (!dryRun) {
    fs.writeFileSync(SOURCE_MANIFEST_PATH, JSON.stringify(entries, null, 2) + "\n");
  }

  console.log(
    `[webp] converted: ${converted}${dryRun ? " (dry run — nothing written)" : ""}, skipped/missing: ${skipped}`
  );
  console.log(`[webp] library      : ${SOURCE_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
