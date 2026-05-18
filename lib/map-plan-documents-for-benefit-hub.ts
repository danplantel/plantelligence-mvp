import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";
import type { RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";

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

/** Same rules as BenefitPortalPreview href: persisted Mongo id → `/view`; else real URL or `#`. */
function portalHrefForDocumentRow(doc: {
  id?: unknown;
  fileUrl?: string | null;
}): string {
  const id = doc.id;
  const asId = typeof id === "string" ? id : "";
  const isMongo =
    /^[0-9a-fA-F]{24}$/.test(asId) &&
    !asId.startsWith("doc-") &&
    !asId.startsWith("plan-doc-") &&
    !asId.startsWith("optional-doc-") &&
    !asId.startsWith("temp-");

  if (isMongo) return `/api/documents/${asId}/view`;

  const u = doc.fileUrl != null ? String(doc.fileUrl).trim() : "";
  return u || "#";
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
      language,
      meta: {
        source: "retirement",
        id: doc.id,
      },
    });
  }

  return out;
}
