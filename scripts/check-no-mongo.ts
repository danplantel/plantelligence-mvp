/**
 * Gate — prove no MongoDB coupling survives in the source tree.
 *
 *   npm run check:no-mongo
 *
 * The last step of the MongoDB → PostgreSQL migration (plans/postgres-migration.md §P6). It
 * exists because `tsc` cannot see most of the coupling that had to be removed:
 *
 *   - `ObjectId.isValid(x)` and `/^[0-9a-fA-F]{24}$/` are *valid TypeScript* — they compile
 *     fine and simply return `false` for a cuid, silently routing every by-id lookup down
 *     the slug path (the failure mode in plan §5).
 *   - `new ObjectId(id) as any` compiles because the cast swallows it.
 *   - `$runCommandRaw` only fails once a script is actually run.
 *
 * So the migration's completeness is verified by grep, and this script is that grep — the
 * one place that knows the full inventory. Exit code is non-zero on any finding, so it can
 * gate CI.
 *
 * Scope and exclusions:
 *   - `.ts`, `.tsx`, `.prisma` files. Markdown (plans/, docs/) legitimately names all of
 *     this while explaining the migration, so it is not scanned.
 *   - `node_modules`, `.next`, `.git`, `scripts/repair/backups`, and the generated client.
 *   - Whole-line comments are skipped, and a match that falls *after* a `//` on its line is
 *     treated as a comment and skipped. That keeps the two files that deliberately document
 *     the removed attributes (the schema's datasource block, the transform script) from
 *     failing their own gate.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  "backups",
  "chromium-bin",
  "models",
  "public",
  "data",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".prisma"]);

/**
 * Files that must *name* these patterns to do their job: this gate's own pattern table, and
 * the one-off schema transform (which matches the attributes it strips). Scanning them makes
 * the check fail on itself, which is noise, not signal.
 */
const SKIP_FILES = new Set([
  "scripts/check-no-mongo.ts",
  "scripts/repair/schema-mongo-to-postgres.ts",
]);

interface Pattern {
  label: string;
  regex: RegExp;
  /** Why it matters, printed once under the summary. */
  note: string;
}

const PATTERNS: Pattern[] = [
  {
    label: "ObjectId",
    // Covers `ObjectId.isValid(x)`, `new ObjectId(x)`, and the `from "mongodb"` import.
    regex: /ObjectId/,
    note: "ObjectId references — ids are cuid strings now, so any shape test is wrong.",
  },
  {
    label: 'from "mongodb"',
    regex: /from\s+["']mongodb["']|require\(\s*["']mongodb["']\s*\)/,
    note: "the mongodb driver must not be imported.",
  },
  {
    label: "$runCommandRaw",
    regex: /\$runCommandRaw/,
    note: "Mongo-only raw commands; replaced by prisma migrate.",
  },
  {
    label: "isSet",
    regex: /\bisSet\s*:/,
    note: "Mongo-only filter operator (null vs absent).",
  },
  {
    label: "@db.ObjectId",
    regex: /@db\.ObjectId/,
    note: "Mongo-only native type attribute.",
  },
  {
    label: '@map("_id")',
    regex: /@map\(\s*"_id"\s*\)/,
    note: "Mongo-only primary-key mapping.",
  },
  {
    label: "@default(auto())",
    regex: /@default\(auto\(\)\)/,
    note: "Mongo-only id generation.",
  },
  {
    label: "24-hex literal",
    regex: /\[0-9a-fA-F\]\{24\}/,
    note: "hand-written ObjectId shape test.",
  },
];

interface Finding {
  file: string;
  line: number;
  label: string;
  text: string;
}

/** A line that is entirely a comment, or whose match sits inside a trailing comment. */
function isCommentMatch(line: string, matchIndex: number): boolean {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
    return true;
  }
  const slash = line.indexOf("//");
  return slash !== -1 && slash < matchIndex;
}

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }
    if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
}

function main(): void {
  const files: string[] = [];
  walk(ROOT, files);

  const findings: Finding[] = [];
  let scanned = 0;

  for (const absolute of files) {
    const relative = path.relative(ROOT, absolute).replace(/\\/g, "/");
    if (SKIP_FILES.has(relative)) continue;
    scanned += 1;
    const content = fs.readFileSync(absolute, "utf-8");
    content.split(/\r?\n/).forEach((line, index) => {
      for (const pattern of PATTERNS) {
        const match = pattern.regex.exec(line);
        if (!match) continue;
        if (isCommentMatch(line, match.index)) return;
        findings.push({
          file: relative,
          line: index + 1,
          label: pattern.label,
          text: line.trim(),
        });
        return; // one finding per line is enough to act on
      }
    });
  }

  console.log(`MongoDB coupling check — ${scanned} source file(s) scanned`);
  console.log("");

  if (findings.length === 0) {
    console.log("  OK    no MongoDB coupling remains");
    console.log("");
    console.log("  Safe to drop the `mongodb` dependency and decommission the cluster.");
    return;
  }

  const byLabel = new Map<string, number>();
  for (const finding of findings) {
    byLabel.set(finding.label, (byLabel.get(finding.label) ?? 0) + 1);
  }

  for (const finding of findings) {
    console.log(`  ${finding.file}:${finding.line}  [${finding.label}]`);
    console.log(`      ${finding.text}`);
  }

  console.log("");
  console.log(`  FAIL  ${findings.length} finding(s) in ${new Set(findings.map((f) => f.file)).size} file(s)`);
  for (const [label, count] of [...byLabel].sort((a, b) => b[1] - a[1])) {
    const note = PATTERNS.find((p) => p.label === label)?.note ?? "";
    console.log(`        ${String(count).padStart(3)}  ${label} — ${note}`);
  }

  process.exitCode = 1;
}

main();
