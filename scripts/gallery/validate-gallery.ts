/**
 * Build-time validation for the Default Image Library manifest.
 *
 *   npx tsx scripts/gallery/validate-gallery.ts [--required]
 *
 * Checks data/gallery-metadata.json against the guide's quality gates:
 *   - every image has the required metadata facets + alt text
 *   - every src resolves to a real file under public/gallery
 *   - no duplicate ids or duplicate srcs
 *   - technical dimensions are present and consistent with the aspect ratio
 *   - when data/gallery-controlled-vocabulary.json exists, every facet value is
 *     inside the controlled vocabulary
 *
 * Exit codes:
 *   0  OK, or manifest not generated yet (unless --required)
 *   1  validation errors found, or manifest required but missing (--required)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { asStringArray, REQUIRED_FACETS } from "./shared";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const MANIFEST_PATH = path.join(PROJECT_ROOT, "data", "gallery-metadata.json");
const IMAGES_DIR = path.join(PROJECT_ROOT, "public", "gallery");
const VOCAB_PATH = path.join(PROJECT_ROOT, "data", "gallery-controlled-vocabulary.json");

interface ManifestEntry {
  id?: string;
  src?: string;
  altText?: string;
  technical?: {
    width?: number;
    height?: number;
    aspectRatio?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function parseFlags(argv: string[]): { required: boolean } {
  const flags = new Set(argv.slice(2));
  return { required: flags.has("--required") || flags.has("--strict") };
}

function main(): void {
  const { required } = parseFlags(process.argv);

  if (!fs.existsSync(MANIFEST_PATH)) {
    if (required) {
      console.error(
        `[gallery] ${MANIFEST_PATH} is required but missing — run "pnpm gallery:sync" first.`
      );
      process.exit(1);
    }
    console.log(
      "[gallery] no manifest yet (data/gallery-metadata.json missing) — skipping validation."
    );
    return;
  }

  const entries = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ManifestEntry[];
  if (!Array.isArray(entries)) {
    console.error("[gallery] data/gallery-metadata.json must be an array.");
    process.exit(1);
  }

  let vocab: Record<string, string[]> | null = null;
  if (fs.existsSync(VOCAB_PATH)) {
    const raw = JSON.parse(fs.readFileSync(VOCAB_PATH, "utf8")) as Record<string, unknown>;
    vocab =
      raw && typeof raw === "object"
        ? (Object.fromEntries(
            Object.entries(raw).map(([key, value]) => [key, asStringArray(value)])
          ) as Record<string, string[]>)
        : null;
  } else {
    console.log("[gallery] no controlled-vocabulary file — skipping vocabulary checks.");
  }

  const errors: string[] = [];
  const ids = new Set<string>();
  const srcs = new Set<string>();

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const label = entry.id ? `[${entry.id}]` : `[entry ${index}]`;

    if (!entry.id) {
      errors.push(`${label} missing id`);
    } else if (ids.has(entry.id)) {
      errors.push(`${label} duplicate id "${entry.id}"`);
    } else {
      ids.add(entry.id);
    }

    const src = typeof entry.src === "string" ? entry.src : "";
    if (!src) {
      errors.push(`${label} missing src`);
    } else {
      if (srcs.has(src)) {
        errors.push(`${label} duplicate src "${src}"`);
      } else {
        srcs.add(src);
      }
      const rel = src.replace(/^\/+/, "");
      if (!fs.existsSync(path.join(IMAGES_DIR, rel))) {
        errors.push(`${label} src points to missing file: ${src}`);
      }
    }

    if (!entry.altText || !String(entry.altText).trim()) {
      errors.push(`${label} missing alt text`);
    }

    for (const facet of REQUIRED_FACETS) {
      if (asStringArray(entry[facet]).length === 0) {
        errors.push(`${label} missing ${facet}`);
      }
    }

    const tech = entry.technical;
    const width = Number(tech?.width ?? 0);
    const height = Number(tech?.height ?? 0);
    const ratio = Number(tech?.aspectRatio ?? 0);
    if (!width || !height || !ratio) {
      errors.push(`${label} technical dimensions incomplete (width/height/aspectRatio)`);
    } else if (Math.abs(width / height - ratio) > 0.01) {
      errors.push(
        `${label} aspect ratio mismatch: expected ${(width / height).toFixed(3)}, got ${ratio}`
      );
    }

    if (vocab) {
      for (const facet of REQUIRED_FACETS) {
        const allowed = new Set(vocab[facet] ?? []);
        if (allowed.size === 0) continue;
        for (const value of asStringArray(entry[facet])) {
          if (!allowed.has(value)) {
            errors.push(`${label} unknown ${facet} value: "${value}"`);
          }
        }
      }
    }
  }

  console.log(`[gallery] checked ${entries.length} images — ${errors.length} problem(s).`);
  for (const error of errors) console.error(`  ✗ ${error}`);

  if (errors.length > 0) process.exit(1);
  console.log("[gallery] OK");
}

main();
