import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import {
  buildUploadKey,
  deleteObjectFromR2,
  isR2Configured,
  putObjectBuffer,
} from "@/lib/r2";

/**
 * The advisor's upload library: files brought in with a .zip and kept so they
 * can be picked again from any image or document uploader, without dragging the
 * archive into that section too.
 *
 * Stored per USER (see `UserAsset`): the pickers are account-level surfaces and
 * the same logo pack or document bundle is usually reused across plans. The
 * bytes go to R2 under `org/{userId}/uploads/library/…`; this route is the index.
 *
 * The library is deliberately short-lived: 24 hours from the drop (the DB fills
 * `expiresAt`), so a one-off archive does not become permanent storage. Every
 * read and write sweeps what has lapsed first — including its R2 object — so an
 * expired file is never offered and never counted against the cap.
 */

const KINDS = ["image", "document"] as const;
type LibraryKind = (typeof KINDS)[number];

/** A single .zip's worth of picks, with room for a few re-drops. */
const MAX_FILES_PER_REQUEST = 20;
/** Matches the image compressors' ceiling; anything larger is not a logo/PDF. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** How many files one account may keep at once. Oldest are NOT auto-deleted. */
const MAX_LIBRARY_FILES = 200;

function isLibraryKind(value: unknown): value is LibraryKind {
  return (
    typeof value === "string" && (KINDS as readonly string[]).includes(value)
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Same-origin URL that streams the object, as the other upload routes return. */
function signedUrl(key: string): string {
  return `/api/r2/signed-url?key=${encodeURIComponent(key)}&redirect=1`;
}

function toAsset(row: {
  id: string;
  kind: string;
  fileName: string;
  key: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  sourceZipName: string | null;
  createdAt: Date;
  expiresAt: Date;
}) {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.fileName,
    url: signedUrl(row.key),
    contentType: row.contentType,
    size: row.size,
    width: row.width,
    height: row.height,
    sourceZipName: row.sourceZipName,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

/**
 * Drop everything past its 24 hours, bytes included, before a caller sees the
 * library. Best-effort on the object delete: a leftover object costs storage but
 * cannot resurface, because the row that pointed at it is gone.
 */
async function purgeExpiredAssets(userId: string): Promise<void> {
  const expired = await prisma.userAsset.findMany({
    where: { userId, expiresAt: { lte: new Date() } },
    select: { id: true, key: true },
  });
  if (expired.length === 0) return;

  await prisma.userAsset.deleteMany({
    where: { id: { in: expired.map((row) => row.id) } },
  });
  await Promise.all(expired.map((row) => deleteObjectFromR2(row.key)));
}

/** GET /api/profile/library?kind=image|document — newest first. */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await purgeExpiredAssets(session.user.id);

    const kindParam = request.nextUrl.searchParams.get("kind");
    const kind = isLibraryKind(kindParam) ? kindParam : null;

    const assets = await prisma.userAsset.findMany({
      where: {
        userId: session.user.id,
        ...(kind ? { kind } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: MAX_LIBRARY_FILES,
    });

    return NextResponse.json({ assets: assets.map(toAsset) });
  } catch (error) {
    console.error("[profile/library] list failed:", error);
    return NextResponse.json(
      { error: "Could not load your library" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/profile/library — multipart.
 *
 *   kind            "image" | "document"
 *   sourceZipName   optional, the archive the files came from
 *   files           one or more File entries
 *   widths/heights  parallel arrays, measured in the browser
 *
 * A file already in the library (same name and size) is skipped rather than
 * duplicated, so re-dropping the same archive is harmless.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "File storage is not configured." },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const kindValue = form.get("kind");
    if (!isLibraryKind(kindValue)) {
      return NextResponse.json({ error: "Unknown file kind" }, { status: 400 });
    }
    const kind = kindValue;
    const sourceZipName = text(form.get("sourceZipName")) || null;

    const files = form
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    const widths = form.getAll("widths").map((value) => Number(value) || 0);
    const heights = form.getAll("heights").map((value) => Number(value) || 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files sent" }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Too many files at once (${files.length}). Add up to ${MAX_FILES_PER_REQUEST} at a time.`,
        },
        { status: 400 },
      );
    }
    const oversized = files.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      return NextResponse.json(
        { error: `${oversized.name} is larger than 25 MB.` },
        { status: 400 },
      );
    }

    await purgeExpiredAssets(userId);
    const existingCount = await prisma.userAsset.count({ where: { userId } });
    let stored = 0;
    let skipped = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fileName = text(form.get(`name-${index}`)) || file.name;
      const size = file.size;

      if (existingCount + stored >= MAX_LIBRARY_FILES) {
        skipped += 1;
        continue;
      }

      const duplicate = await prisma.userAsset.findFirst({
        where: { userId, kind, fileName, size },
        select: { id: true },
      });
      if (duplicate) {
        skipped += 1;
        continue;
      }

      const key = buildUploadKey({
        orgId: userId,
        subPath: "library",
        fileName,
      });
      const ok = await putObjectBuffer({
        key,
        body: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || "application/octet-stream",
      });
      if (!ok) {
        skipped += 1;
        continue;
      }

      await prisma.userAsset.create({
        data: {
          userId,
          kind,
          fileName,
          key,
          contentType: file.type || "application/octet-stream",
          size,
          width: widths[index] ?? 0,
          height: heights[index] ?? 0,
          sourceZipName,
        },
      });
      stored += 1;
    }

    return NextResponse.json({ success: true, stored, skipped });
  } catch (error) {
    console.error("[profile/library] store failed:", error);
    return NextResponse.json(
      { error: "Could not save those files to your library" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/profile/library?kind=image|document — clear the library, or just
 * one kind of it (the picker's "Delete All").
 *
 * Rows go first so the library is empty from the advisor's point of view even if
 * R2 is slow; the object deletes then run best-effort, exactly like the
 * single-file route.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const kindParam = request.nextUrl.searchParams.get("kind");
    const kind = isLibraryKind(kindParam) ? kindParam : null;

    const rows = await prisma.userAsset.findMany({
      where: { userId, ...(kind ? { kind } : {}) },
      select: { id: true, key: true },
    });
    if (rows.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    await prisma.userAsset.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    await Promise.all(rows.map((row) => deleteObjectFromR2(row.key)));

    return NextResponse.json({ success: true, deleted: rows.length });
  } catch (error) {
    console.error("[profile/library] clear failed:", error);
    return NextResponse.json(
      { error: "Could not clear your library" },
      { status: 500 },
    );
  }
}
