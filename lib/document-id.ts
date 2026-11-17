/**
 * Document ids — persisted row vs. wizard draft — and document sources.
 *
 * Shared by the client (hub cards) and the server (`/api/documents/[id]/view`),
 * because both used to answer "is this a real row?" with a 24-character MongoDB
 * ObjectId shape test. The schema is Postgres now and `Document.id` is a cuid
 * (`cuid()` in prisma/schema.prisma), so that test was false for EVERY row:
 *
 *  - `/api/documents/{id}/view` refused a cuid as a "temporary document ID" (404),
 *  - the hub's document mapping skipped the view route and used the row's
 *    `fileUrl` instead, which for an R2 upload is the literal placeholder
 *    `"r2:stored"` — the browser then reported
 *    "Failed to launch 'r2:stored' because the scheme does not have a
 *    registered handler", and the preview modal had nothing to show.
 *
 * A draft id is recognised by its prefix (that is what the wizard generates), so
 * anything else is a row the database owns.
 */

/** `temp-…`, `doc-…`, `plan-doc-…`, `optional-doc-…` — wizard-only ids. */
const TEMPORARY_DOCUMENT_ID_PREFIXES = [
  "temp-",
  "doc-",
  "plan-doc-",
  "optional-doc-",
] as const;

/** Placeholder written to `Document.fileUrl` when the bytes live in R2. */
export const R2_STORED_PLACEHOLDER = "r2:stored";

/** An id the wizard minted for a file that has not been persisted yet. */
export function isTemporaryDocumentId(id: string | null | undefined): boolean {
  const value = String(id ?? "").trim();
  if (!value) return false;
  return TEMPORARY_DOCUMENT_ID_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** An id that names a `Document` row (cuid, or a legacy MongoDB ObjectId). */
export function isPersistedDocumentId(id: string | null | undefined): boolean {
  const value = String(id ?? "").trim();
  if (!value) return false;
  return !isTemporaryDocumentId(value);
}

/**
 * Whether a string can be handed to an iframe or an anchor: an absolute
 * `https:`/`data:`/`blob:` URL, or a site-relative path.
 *
 * R2 object keys (`org/{userId}/…`) and the `r2:stored` placeholder are neither
 * — they have to go through `/api/documents/{id}/view` or the R2 proxy.
 */
export function isOpenableDocumentUrl(value: string | null | undefined): boolean {
  const url = String(value ?? "").trim();
  if (!url) return false;
  if (url === R2_STORED_PLACEHOLDER) return false;
  if (/^(https?:|data:|blob:)/i.test(url)) return true;
  return url.startsWith("/");
}
