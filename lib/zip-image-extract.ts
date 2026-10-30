import { unzipSync } from "fflate";

export interface ExtractedImage {
  file: File;
  fileName: string;
  previewUrl: string;
  /** Natural pixel dimensions of the image (0 when it can't be decoded). */
  width: number;
  height: number;
  /** Byte size of the extracted image. */
  size: number;
}

export interface ExtractedFile {
  file: File;
  fileName: string;
  /** Only present for image entries (used as a thumbnail). */
  previewUrl?: string;
  /** Natural pixel dimensions — 0 for non-image files. */
  width: number;
  height: number;
  /** Byte size of the extracted file. */
  size: number;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
/** What the documents picker takes out of an archive. */
const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx"];

/** Upper bound on the .zip size we'll extract in the browser (50 MB). */
const MAX_ZIP_SIZE = 50 * 1024 * 1024;
/** Upper bound on the number of entries we'll extract (200). */
const MAX_ENTRIES = 200;

/**
 * True when the file looks like a ZIP archive (by MIME type or .zip extension).
 */
export function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    (file.type === "application/octet-stream" && name.endsWith(".zip"))
  );
}

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot).toLowerCase();
}

function mimeForExtension(ext: string): string {
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

/** Loads the natural dimensions of an image (0,0 if it can't be decoded). */
function getImageDimensions(
  previewUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
      });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = previewUrl;
  });
}

/**
 * Core extractor — pulls entries matching `acceptedExtensions` out of a ZIP
 * archive entirely in the browser. Skips directories, macOS resource forks
 * (`__MACOSX/*`, `._*`), and hidden files, sorts by path for stable order, and
 * generates thumbnails + dimensions for image entries only.
 *
 * Throws a human-readable Error when the archive is too large, contains too
 * many files, or contains none of the accepted types — unless `allowEmpty` is
 * set, in which case "none of those types" simply yields an empty list. That is
 * what lets one archive be read for both kinds at once (see
 * `extractZipContents`) without treating the missing kind as an error.
 */
async function extractEntries(
  file: File,
  acceptedExtensions: string[],
  options: { allowEmpty?: boolean } = {},
): Promise<ExtractedFile[]> {
  if (file.size > MAX_ZIP_SIZE) {
    throw new Error(
      "That .zip is larger than 50 MB. Please split it into smaller files and try again.",
    );
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buf);
  const extSet = new Set(acceptedExtensions.map((e) => e.toLowerCase()));

  const names = Object.keys(entries)
    .filter((name) => {
      const clean = name.replace(/\\/g, "/");
      if (clean.endsWith("/")) return false; // directory entry
      const base = clean.split("/").pop() || "";
      if (base.startsWith(".") || base.startsWith("._")) return false; // hidden / resource fork
      if (clean.includes("__MACOSX")) return false;
      return extSet.has(getExtension(base));
    })
    .sort((a, b) => a.localeCompare(b));

  if (names.length > MAX_ENTRIES) {
    throw new Error(
      `That .zip contains too many files (${names.length}). Please upload 200 or fewer.`,
    );
  }

  const results = await Promise.all(
    names.map(async (name) => {
      const data = entries[name];
      const base = name.replace(/\\/g, "/").split("/").pop() || "file";
      const ext = getExtension(base);
      const mime = mimeForExtension(ext);
      const fileObj = new File([new Blob([data], { type: mime })], base, {
        type: mime,
      });
      const entry: ExtractedFile = {
        file: fileObj,
        fileName: base,
        width: 0,
        height: 0,
        size: data.byteLength,
      };
      // Images get a thumbnail object URL + natural dimensions.
      if (IMAGE_EXTENSIONS.has(ext)) {
        const previewUrl = URL.createObjectURL(fileObj);
        const dims = await getImageDimensions(previewUrl);
        entry.previewUrl = previewUrl;
        entry.width = dims.width;
        entry.height = dims.height;
      }
      return entry;
    }),
  );

  if (results.length === 0 && !options.allowEmpty) {
    const label = acceptedExtensions
      .map((e) => e.replace(".", "").toUpperCase())
      .join(", ");
    throw new Error(
      `No ${label} files were found in that .zip. Please make sure it contains ${label} files.`,
    );
  }

  return results;
}

/**
 * Extracts the requested file types (default: PDFs) from a ZIP archive.
 * Returns each entry as a fresh `File` ready to feed into the existing upload
 * pipeline. Use this for non-image uploads (e.g. document batches).
 */
export async function extractFilesFromZip(
  file: File,
  acceptedExtensions: string[] = [".pdf"],
): Promise<ExtractedFile[]> {
  return extractEntries(file, acceptedExtensions);
}

/**
 * Extracts image files (PNG / JPG / JPEG / WebP / SVG) from a ZIP archive,
 * with thumbnail previews + natural dimensions. Use this for single-image
 * slots (logo, brand images).
 */
export async function extractImagesFromZip(
  file: File,
): Promise<ExtractedImage[]> {
  const list = await extractEntries(file, Array.from(IMAGE_EXTENSIONS));
  return list.map((e) => ({
    file: e.file,
    fileName: e.fileName,
    previewUrl: e.previewUrl as string,
    width: e.width,
    height: e.height,
    size: e.size,
  }));
}

/** What one archive holds, split the way the two pickers read it. */
export interface ZipContents {
  images: ExtractedFile[];
  documents: ExtractedFile[];
}

/**
 * Both kinds from a single archive.
 *
 * A logo pack often ships a PDF spec sheet and a document bundle often carries a
 * logo, so the picker that opened the .zip can say "2 Documents are present in
 * this .zip" and show them read-only, instead of silently dropping them.
 *
 * An archive with only one kind returns an empty list for the other; only an
 * archive with neither throws.
 */
export async function extractZipContents(file: File): Promise<ZipContents> {
  const images = await extractEntries(file, Array.from(IMAGE_EXTENSIONS), {
    allowEmpty: true,
  });
  const documents = await extractEntries(file, DOCUMENT_EXTENSIONS, {
    allowEmpty: true,
  });

  if (images.length === 0 && documents.length === 0) {
    throw new Error("No images, PDFs or Word files were found in that .zip.");
  }

  return { images, documents };
}

/**
 * Revoke the object URLs created for thumbnails.
 *
 * Accepts any extracted entry (not just images) so the read-only "other files
 * in this .zip" previews are cleaned up too, and skips non-blob URLs so a
 * library preview (a server URL) is never revoked.
 */
export function revokeZipImagePreviews(
  images: ReadonlyArray<{ previewUrl?: string }>,
): void {
  images.forEach((img) => {
    if (img.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(img.previewUrl);
    }
  });
}
