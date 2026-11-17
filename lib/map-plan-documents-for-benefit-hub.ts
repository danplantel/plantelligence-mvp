import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import {
  isOpenableDocumentUrl,
  isPersistedDocumentId,
} from "@/lib/document-id";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";
import type { RetirementDocumentItem } from "@/components/pages/client-portal/sections/benefit-document-section";

/**
 * Same hub resolution as Benefit Portal Preview + Step 4 `documentsForCategory`:
 * `resolvePersistedDocumentCategory("Document", benefitCategory)` for the selected card,
 * vs `resolvePersistedDocumentCategory(..., doc.category, doc.storageKey)` per row.
 */
export function benefitCategoryToDocumentHubLabel(
  benefitCategory: string | null | undefined,
): string {
  const raw = benefitCategory?.trim();
  return resolvePersistedDocumentCategory(
    "Document",
    raw && raw.length > 0 ? raw : "Retirement",
  );
}

/** Raw API / merged row belongs on this benefit hub (Create Benefits preview filter). */
export function documentRowMatchesHub(
  doc: Record<string, unknown>,
  targetHub: string,
): boolean {
  const d = doc as {
    type?: string;
    category?: string | null;
    storageKey?: string | null;
    archivedAt?: unknown;
  };
  if (d.archivedAt) return false;
  const hub = resolvePersistedDocumentCategory(
    d.type || "Document",
    d.category,
    d.storageKey,
  );
  return hub === targetHub;
}

function guessLanguageFromDocumentFields(doc: {
  title?: string;
  fileName?: string;
  shortDescription?: string | null;
  description?: string | null;
}): "EN" | "ES" {
  const source =
    `${doc.title ?? ""} ${doc.fileName ?? ""} ${doc.shortDescription ?? ""} ${doc.description ?? ""}`.toLowerCase();
  if (
    source.includes("[es]") ||
    source.includes("(es)") ||
    source.includes(" español") ||
    source.includes("spanish")
  ) {
    return "ES";
  }
  return "EN";
}

function defaultDescription(doc: {
  shortDescription?: string | null;
}): string {
  if (doc.shortDescription?.trim()) return doc.shortDescription.trim();
  return "Complete guide to your retirement plan options";
}

/**
 * A persisted row opens through `/api/documents/{id}/view`; anything else can
 * only be opened if its `fileUrl` is a real URL.
 *
 * The persisted test used to be a 24-character MongoDB ObjectId shape check.
 * Ids are cuids now (`prisma/schema.prisma`), so every row failed it and fell
 * through to `fileUrl` — which for an R2 upload is the placeholder `"r2:stored"`.
 * That is what the browser refused to launch, and why the hub's preview modal
 * was empty. See `lib/document-id.ts`.
 */
function portalHrefForDocumentRow(doc: {
  id?: unknown;
  fileUrl?: string | null;
}): string {
  const asId = typeof doc.id === "string" ? doc.id.trim() : "";
  if (isPersistedDocumentId(asId)) return `/api/documents/${asId}/view`;

  // A row with no id yet: only an actual URL can be handed to a card.
  const url = doc.fileUrl != null ? String(doc.fileUrl).trim() : "";
  return isOpenableDocumentUrl(url) ? url : "";
}

/**
 * Map merged plan document rows (same shape as GET /api/documents/client + merge) to
 * accordion items. Matches Benefit Portal Preview: filter by hub only — do not drop rows
 * for missing storageKey/fileUrl before hub match (those fields are only for href).
 */
export function mapMergedRowsToBenefitHubItems(
  mergedRows: Record<string, unknown>[],
  /** e.g. `benefitCategoryToDocumentHubLabel("Retirement")` → `"Retirement"` */
  targetHub: string,
): RetirementDocumentItem[] {
  const out: RetirementDocumentItem[] = [];

  for (const row of mergedRows) {
    if (!documentRowMatchesHub(row, targetHub)) continue;

    const doc = row as {
      id?: string;
      title?: string;
      fileName?: string;
      name?: string;
      shortDescription?: string | null;
      language?: string | null;
    };

    const guessed = guessLanguageFromDocumentFields(doc);
    const language = normalizePortalDocumentLanguage(doc.language, guessed);

    out.push({
      id: String(doc.id ?? ""),
      title: doc.title || doc.fileName || doc.name || "Document",
      description: defaultDescription(doc),
      href: portalHrefForDocumentRow(doc),
      // Kept so the preview modal can tell a PDF from a Word/Excel file: the
      // `/api/documents/{id}/view` href carries no extension, and a document
      // whose title is copywritten ("Enrollment Booklet") carries none either.
      fileName: doc.fileName || doc.name || undefined,
      language,
      meta: {
        source: "retirement",
        id: doc.id,
      },
    });
  }

  return out;
}
