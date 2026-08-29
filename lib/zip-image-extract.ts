import { unzipSync } from "fflate";

export interface ExtractedImage {
  file: File;
  fileName: string;
  previewUrl: string;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

/** Upper bound on the .zip size we'll extract in the browser (50 MB). */
const MAX_ZIP_SIZE = 50 * 1024 * 1024;
/** Upper bound on the number of image entries we'll extract (200). */
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
  return "image/jpeg";
}

/**
 * Extracts image files (PNG / JPG / JPEG / WebP / SVG) from a ZIP archive
 * entirely in the browser. Skips directories, macOS resource forks
 * (`__MACOSX/*`, `._*`), and hidden files, and returns the images sorted by
 * their path in the archive so the picker order is stable.
 *
 * Throws a human-readable Error when the archive is too large, contains too
 * many images, or contains no usable images — callers should surface that
 * message directly to the user.
 */
export async function extractImagesFromZip(
  file: File,
): Promise<ExtractedImage[]> {
  if (file.size > MAX_ZIP_SIZE) {
    throw new Error(
      "That .zip is larger than 50 MB. Please split it into smaller files and try again.",
    );
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buf);

  const names = Object.keys(entries)
    .filter((name) => {
      const clean = name.replace(/\\/g, "/");
      if (clean.endsWith("/")) return false; // directory entry
      const base = clean.split("/").pop() || "";
      if (base.startsWith(".") || base.startsWith("._")) return false; // hidden / resource fork
      if (clean.includes("__MACOSX")) return false;
      return IMAGE_EXTENSIONS.has(getExtension(base));
    })
    .sort((a, b) => a.localeCompare(b));

  if (names.length > MAX_ENTRIES) {
    throw new Error(
      `That .zip contains too many images (${names.length}). Please upload 200 or fewer.`,
    );
  }

  const images: ExtractedImage[] = [];
  for (const name of names) {
    const data = entries[name];
    const base = name.replace(/\\/g, "/").split("/").pop() || "image";
    const ext = getExtension(base);
    const mime = mimeForExtension(ext);
    const fileObj = new File([new Blob([data], { type: mime })], base, {
      type: mime,
    });
    images.push({
      file: fileObj,
      fileName: base,
      previewUrl: URL.createObjectURL(fileObj),
    });
  }

  if (images.length === 0) {
    throw new Error(
      "No images were found in that .zip. Please make sure it contains PNG, JPG, JPEG, WebP, or SVG files.",
    );
  }

  return images;
}

/** Revoke the object URLs created by `extractImagesFromZip`. */
export function revokeZipImagePreviews(images: ExtractedImage[]): void {
  images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
}
