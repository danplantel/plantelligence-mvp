/**
 * profile-library — the per-user "files I dropped in with a .zip" library.
 *
 * Every uploader in the product can take a .zip and let the advisor pick files
 * out of it (images in the logo/background pickers, PDFs and Word files in the
 * documents section). Without somewhere to keep them, the SAME archive had to be
 * dragged in again for the next slot, the next benefit and the next plan.
 *
 * So the picker offers an explicit "add to my library": the archive's contents
 * are kept for 24 hours and can be chosen from any other image/document section
 * in that window. It is a convenience, not permanent storage, and the advisor
 * opts in per archive — nothing is kept behind their back.
 *
 * This module is the browser-side client for the library stored on the user's
 * profile (`UserAsset` + R2 bytes):
 *
 *  - `persistFilesToLibrary` — the "add to my library" action;
 *  - `fetchLibraryAssets` — what the picker offers instead of a fresh .zip;
 *  - `libraryAssetToExtractedFile` — turn a stored asset back into the
 *    `ExtractedFile` the existing pickers already understand, so choosing from
 *    the library and choosing from a zip take the exact same code path.
 *
 * Everything here is best-effort: the library is a convenience, and a failed
 * write or read must never block the upload the advisor actually asked for.
 */

import type { ExtractedFile } from "@/lib/zip-image-extract";

/** Which picker a stored file belongs to. */
export type LibraryKind = "image" | "document";

export interface LibraryAsset {
  id: string;
  kind: LibraryKind;
  fileName: string;
  /** Same-origin URL that streams the stored bytes. */
  url: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  sourceZipName: string | null;
  createdAt: string;
  /** When the library stops offering it (creation + 24 hours). */
  expiresAt: string;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"];
const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx"];

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot).toLowerCase();
}

/**
 * The kind a file belongs to, or `null` for something neither picker handles.
 * Mirrors `lib/zip-image-extract.ts`: a file the extractor would never offer is
 * never stored either.
 */
export function libraryKindForFileName(fileName: string): LibraryKind | null {
  const ext = extensionOf(fileName);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (DOCUMENT_EXTENSIONS.includes(ext)) return "document";
  return null;
}

/** Every file in `files` that belongs to `kind`, in the order given. */
export function filesForLibraryKind(
  files: ExtractedFile[],
  kind: LibraryKind,
): ExtractedFile[] {
  return files.filter((file) => libraryKindForFileName(file.fileName) === kind);
}

/** Identity used to avoid storing the same file twice in one session. */
function assetFingerprint(kind: LibraryKind, fileName: string, size: number) {
  return `${kind}|${fileName}|${size}`;
}

/** Files this session knows are already stored (or being stored). */
const known = new Set<string>();

/**
 * How many files one "add to my library" action may keep.
 *
 * Mirrors the library route's per-request cap (`MAX_FILES_PER_REQUEST`). The
 * pickers stop the advisor at this many, and this module sends one request —
 * the old version split a bigger archive into 20-file batches behind their
 * back, so "Add all 45 files to library" quietly became three requests and the
 * advisor could not tell what a single click had stored.
 */
export const MAX_FILES_PER_LIBRARY_ADD = 20;

/** What an "add to my library" run did, so a caller can react without guessing. */
export interface LibraryPersistResult {
  /** Files newly stored (re-dropping an archive that was kept stores none). */
  stored: number;
  /** Files the server already had, or turned away at the size cap. */
  skipped: number;
  /** True when at least one batch could not be sent at all. */
  failed: boolean;
}

/**
 * Explicit "add to my library". The archive's contents are kept so the *same*
 * .zip never has to be dropped twice for the next slot, and the server holds
 * them for 24 hours.
 */
export async function persistFilesToLibrary(params: {
  files: ExtractedFile[];
  kind: LibraryKind;
  sourceZipName?: string;
}): Promise<LibraryPersistResult> {
  const candidates = filesForLibraryKind(params.files, params.kind).filter(
    (file) => {
      const fingerprint = assetFingerprint(
        params.kind,
        file.fileName,
        file.size,
      );
      if (known.has(fingerprint)) return false;
      known.add(fingerprint);
      return true;
    },
  );

  // Forget this run's fingerprints so a later attempt can retry them.
  const forget = () =>
    candidates.forEach((file) =>
      known.delete(assetFingerprint(params.kind, file.fileName, file.size)),
    );

  if (candidates.length === 0) {
    // Everything was already stored or listed this session, so the library is
    // definitely not empty — the pickers can offer it straight away.
    rememberLibraryAvailability(params.kind, true);
    return { stored: 0, skipped: 0, failed: false };
  }

  if (candidates.length > MAX_FILES_PER_LIBRARY_ADD) {
    // The pickers cap one action before it reaches this point. Refuse the whole
    // set rather than storing a truncated subset the advisor never chose.
    forget();
    return { stored: 0, skipped: 0, failed: true };
  }

  const form = new FormData();
  form.append("kind", params.kind);
  if (params.sourceZipName) form.append("sourceZipName", params.sourceZipName);
  for (const file of candidates) {
    form.append("files", file.file, file.fileName);
    // Dimensions are measured in the browser (see `zip-image-extract`), so they
    // travel alongside the bytes rather than being decoded again on the server.
    form.append("widths", String(file.width || 0));
    form.append("heights", String(file.height || 0));
  }

  try {
    const res = await fetch("/api/profile/library", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      forget();
      return { stored: 0, skipped: 0, failed: true };
    }
    const body = (await res.json().catch(() => null)) as {
      stored?: number;
      skipped?: number;
    } | null;
    // A dedupe-only run still proves the library has files, which is what the
    // "Choose from Library" buttons key off.
    rememberLibraryAvailability(params.kind, true);
    return {
      stored: body?.stored ?? 0,
      skipped: body?.skipped ?? 0,
      failed: false,
    };
  } catch {
    forget();
    return { stored: 0, skipped: 0, failed: true };
  }
}

/** The stored files of one kind, newest first. Empty on any failure. */
export async function fetchLibraryAssets(
  kind: LibraryKind,
): Promise<LibraryAsset[]> {
  try {
    const res = await fetch(`/api/profile/library?kind=${kind}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json().catch(() => null)) as {
      assets?: LibraryAsset[];
    } | null;
    const assets = Array.isArray(body?.assets) ? body!.assets : [];
    // Seed the dedupe set so a file already in the library is not re-uploaded by
    // the next zip drop in this session.
    assets.forEach((asset) =>
      known.add(assetFingerprint(kind, asset.fileName, asset.size)),
    );
    return assets;
  } catch {
    return [];
  }
}

/**
 * Fired on `window` whenever the library's contents may have changed (an add, a
 * delete, an expiry sweep). Uploaders listen so "Choose from Library" appears as
 * soon as there is something to choose, everywhere on the page.
 */
export const PROFILE_LIBRARY_CHANGED_EVENT =
  "plantelligence:profile-library-changed";

/** How long a "does the library have anything?" answer stays good. */
const AVAILABILITY_TTL_MS = 60_000;

interface AvailabilityEntry {
  at: number;
  hasAssets: boolean;
}

const availability = new Map<LibraryKind, AvailabilityEntry>();
const availabilityInFlight = new Map<LibraryKind, Promise<boolean>>();

function notifyLibraryChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROFILE_LIBRARY_CHANGED_EVENT));
}

/** Record (and broadcast) that this kind does — or no longer does — have files. */
function rememberLibraryAvailability(
  kind: LibraryKind,
  hasAssets: boolean,
): void {
  availability.set(kind, { at: Date.now(), hasAssets });
  notifyLibraryChanged();
}

/** Forget what we knew; the next `libraryHasAssets` asks the server again. */
export function invalidateLibraryAvailability(): void {
  availability.clear();
  notifyLibraryChanged();
}

/**
 * Whether the advisor's library has anything of this kind. Used to hide
 * "Choose from Library" until there is something to choose.
 *
 * Cached for a minute and shared between every uploader on the page, so a form
 * with six image slots asks once, not six times. `force` re-asks the server.
 */
export async function libraryHasAssets(
  kind: LibraryKind,
  options: { force?: boolean } = {},
): Promise<boolean> {
  const cached = availability.get(kind);
  if (
    !options.force &&
    cached &&
    Date.now() - cached.at < AVAILABILITY_TTL_MS
  ) {
    return cached.hasAssets;
  }

  const pending = availabilityInFlight.get(kind);
  if (pending) return pending;

  const request = fetchLibraryAssets(kind)
    .then((assets) => {
      const hasAssets = assets.length > 0;
      availability.set(kind, { at: Date.now(), hasAssets });
      return hasAssets;
    })
    .finally(() => {
      availabilityInFlight.delete(kind);
    });

  availabilityInFlight.set(kind, request);
  return request;
}

/** Remove one stored file. */
export async function deleteLibraryAsset(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/profile/library/${id}`, { method: "DELETE" });
    if (!res.ok) return false;
    // A delete can empty the library, which the pickers must hear about.
    invalidateLibraryAvailability();
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove every stored file of `kind` — the picker's "Delete All".
 *
 * One request instead of one per tile: the route drops the rows and then the R2
 * objects, so an archive's worth of files goes in a single sweep.
 */
export async function deleteAllLibraryAssets(
  kind: LibraryKind,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/profile/library?kind=${kind}`, {
      method: "DELETE",
    });
    if (!res.ok) return false;
    invalidateLibraryAvailability();
    return true;
  } catch {
    return false;
  }
}

/**
 * Turn a stored asset into the `ExtractedFile` shape the pickers already use:
 * download the bytes into a `File`, and reuse the recorded dimensions.
 */
export async function libraryAssetToExtractedFile(
  asset: LibraryAsset,
): Promise<ExtractedFile | null> {
  try {
    const res = await fetch(asset.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const file = new File([blob], asset.fileName, {
      type: asset.contentType || blob.type || "application/octet-stream",
    });
    return {
      file,
      fileName: asset.fileName,
      // The stored asset's URL is already an image for the tile grid; no need to
      // build an object URL just to throw it away when the dialog closes.
      previewUrl: asset.kind === "image" ? asset.url : undefined,
      width: asset.width || 0,
      height: asset.height || 0,
      size: asset.size || blob.size,
    };
  } catch {
    return null;
  }
}
