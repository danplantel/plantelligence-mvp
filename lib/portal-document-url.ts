import { isOpenableDocumentUrl } from "@/lib/document-id";

/**
 * Turning a plan document into a URL the browser can actually open.
 *
 * The employee portal is anonymous, and `GET /api/documents/{id}/view` finds the
 * owning advisor from the plan identifier carried by the request (`?clientSlug=`).
 * A hub card linked straight to `/api/documents/{id}/view`, so on the public
 * portal the route answered `401 {"error":"Unauthorized"}` — the preview iframe
 * rendered that JSON as nothing at all, and "Download PDF" opened the same 401
 * in a new tab. Everything that builds a document URL now goes through here.
 */

/** The route that streams a stored document (302 to a signed R2 URL, or the bytes). */
const DOCUMENT_VIEW_PATH = "/api/documents/";

/**
 * Attach the plan identifier an anonymous portal request needs.
 *
 * Only the `/api/documents/…/view` route reads it. Absolute URLs (`http(s)`,
 * `data:`, `blob:`) are already self-contained, and a URL that carries its own
 * `clientSlug` / `slug` / `clientId` is left exactly as the caller wrote it.
 */
export function withPortalClientScope(
  href: string | null | undefined,
  portalClientId?: string | null,
): string {
  const url = (href ?? "").trim();
  if (!url) return "";

  const plan = (portalClientId ?? "").trim();
  if (!plan) return url;

  if (!url.startsWith(DOCUMENT_VIEW_PATH)) return url;
  if (/[?&](clientSlug|slug|clientId)=/.test(url)) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}clientSlug=${encodeURIComponent(plan)}`;
}

/**
 * The URL to load for a document, or `""` when it has no openable source.
 *
 * Three kinds of non-URL must NOT reach an iframe or an anchor:
 *   • `"#"` — a card with neither a stored file nor an id (renders the page itself),
 *   • `"r2:stored"` — the placeholder written to `Document.fileUrl` for R2 uploads
 *     (the browser logs "Failed to launch 'r2:stored' because the scheme does not
 *     have a registered handler"),
 *   • a bare R2 key such as `org/{userId}/documents/…` (no scheme, no leading "/").
 */
export function resolveDocumentSourceUrl(
  href: string | null | undefined,
  portalClientId?: string | null,
): string {
  const url = (href ?? "").trim();
  if (!url || url === "#") return "";
  if (!isOpenableDocumentUrl(url)) return "";
  return withPortalClientScope(url, portalClientId);
}

/**
 * The same document URL, asking the route to answer as a download.
 *
 * `?download=1` makes `/api/documents/{id}/view` sign the R2 object with
 * `Content-Disposition: attachment`, so following the link SAVES the file. It has
 * to be a plain link, not a `fetch`: the URL redirects to R2, which serves no CORS
 * headers, so reading it from JavaScript is blocked ("No
 * 'Access-Control-Allow-Origin' header is present") and the download never starts.
 */
export function withDocumentDownloadFlag(url: string | null | undefined): string {
  const value = (url ?? "").trim();
  if (!value) return "";
  // Only our own route knows the flag; a data:/http/blob: URL is already a file.
  if (!value.startsWith("/api/")) return value;
  if (/[?&]download=1(&|$)/.test(value)) return value;
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}download=1`;
}

/**
 * The document's file extension, read from `fileName` first, then the title,
 * then the href. A `/api/documents/{id}/view` URL carries no extension, so the
 * name is the only evidence of the file type; `""` means "unknown".
 */
export function documentFileExtension(doc: {
  fileName?: string | null;
  title?: string | null;
  href?: string | null;
}): string {
  for (const candidate of [doc.fileName, doc.title, doc.href]) {
    const name = String(candidate ?? "").trim();
    if (!name) continue;
    const match = name.toLowerCase().match(/\.([a-z0-9]{2,5})(?:[?#]|$)/);
    if (match?.[1]) return match[1];
  }
  return "";
}

/** File types a browser renders itself; everything else has to be downloaded. */
const INLINE_PREVIEW_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "svg",
  "txt",
]);

/**
 * Whether the preview iframe can draw this file.
 *
 * An unknown extension counts as previewable: the route serves PDFs by default,
 * and a wrong "can't preview" notice is worse than letting the viewer try.
 */
export function canPreviewDocumentInline(extension: string): boolean {
  if (!extension) return true;
  return INLINE_PREVIEW_EXTENSIONS.has(extension);
}

/**
 * The name the file is saved under. Strips an extension already present in the
 * title so "Enrollment Booklet.pdf" does not become "Enrollment Booklet.pdf.pdf".
 */
export function documentDownloadFileName(
  title: string | null | undefined,
  extension: string,
): string {
  const base =
    String(title ?? "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-") || "document";
  const withoutExtension = base.replace(/\.[a-z0-9]{2,5}$/i, "").trim() || "document";
  return `${withoutExtension}.${extension || "pdf"}`;
}
