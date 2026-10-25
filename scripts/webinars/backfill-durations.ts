/**
 * Backfill `Webinar.duration` for videos uploaded before the column existed.
 *
 *   npx tsx scripts/webinars/backfill-durations.ts [--dry-run]
 *
 * The portal card prints the runtime from this column. Nothing measured it in
 * the past — the card tried to read it out of the video element instead, which
 * meant fetching a multi-MB base64 payload before it could show "3:42", and
 * showed nothing at all when that fetch was slow or blocked.
 *
 * This reads the runtime straight out of the stored file, without a browser:
 * for an MP4 the `moov/mvhd` box carries `duration / timescale` in seconds. Rows
 * the parser cannot read (WebM, a fragmented MP4 whose `mvhd` duration is 0, an
 * embed URL) are left alone and reported, so the next upload of that video fills
 * them in.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");

/** Prisma's CLI loads `.env`; a plain `npx tsx` run does not. */
function loadEnv(): void {
  try {
    if (!fs.existsSync(ENV_PATH)) return;
    const content = fs.readFileSync(ENV_PATH, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Best-effort: fall back to whatever the shell already exports.
  }
}

/** The same `m:ss` / `h:mm:ss` shape the portal card and the upload form use. */
function formatRuntime(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

interface Box {
  /** Offset of the box payload (just past the header). */
  start: number;
  /** Offset one past the box. */
  end: number;
}

/**
 * Walk the boxes in `[start, end)` and return the payload range of the first
 * `type`. ISO-BMFF box headers are `size(4) type(4)`, with `size === 1` meaning a
 * 64-bit size follows the type and `size === 0` meaning "rest of the parent".
 */
function findBox(
  buffer: Buffer,
  type: string,
  start: number,
  end: number,
): Box | null {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const boxType = buffer.toString("latin1", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) return null;
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) return null;
    if (boxType === type) {
      return { start: offset + header, end: offset + size };
    }
    offset += size;
  }
  return null;
}

/** Runtime from `moov/mvhd`, in seconds. 0 when the file does not say. */
function mp4DurationSeconds(buffer: Buffer): number {
  const moov = findBox(buffer, "moov", 0, buffer.length);
  const mvhd = findBox(buffer, "mvhd", moov ? moov.start : 0, moov ? moov.end : buffer.length);
  if (!mvhd) return 0;

  const version = buffer[mvhd.start];
  // version(1) + flags(3), then creation/modification times whose width depends
  // on the version.
  const at = mvhd.start + 4;
  const timescaleOffset = version === 1 ? at + 16 : at + 8;
  const durationOffset = version === 1 ? at + 20 : at + 12;
  if (durationOffset + (version === 1 ? 8 : 4) > mvhd.end) return 0;

  const timescale = buffer.readUInt32BE(timescaleOffset);
  const duration =
    version === 1
      ? Number(buffer.readBigUInt64BE(durationOffset))
      : buffer.readUInt32BE(durationOffset);

  if (!timescale || !duration) return 0;
  return duration / timescale;
}

async function main(): Promise<void> {
  loadEnv();
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.webinar.findMany({
      where: { videoFileUrl: { not: null }, duration: null },
      select: { id: true, webinarTitle: true, videoFileUrl: true },
    });

    if (rows.length === 0) {
      console.log("No webinars are missing a duration.");
      return;
    }

    console.log(
      `Checking ${rows.length} webinar${rows.length === 1 ? "" : "s"}${
        dryRun ? " (dry run)" : ""
      }…`,
    );

    let written = 0;
    for (const row of rows) {
      const base64 = String(row.videoFileUrl ?? "")
        // Tolerate a data-URL prefix and any line wrapping from older writes.
        .replace(/^data:[^,]*,/, "")
        .replace(/\s+/g, "");
      const buffer = Buffer.from(base64, "base64");
      const label = formatRuntime(mp4DurationSeconds(buffer));

      if (!label) {
        console.warn(
          `  skip  ${row.id} — no MP4 runtime found ("${row.webinarTitle}")`,
        );
        continue;
      }

      if (!dryRun) {
        await prisma.webinar.update({
          where: { id: row.id },
          data: { duration: label },
        });
      }
      written += 1;
      console.log(`  ${dryRun ? "would set" : "set"} ${row.id} → ${label}`);
    }

    console.log(
      `${dryRun ? "Would backfill" : "Backfilled"} ${written} of ${rows.length}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
