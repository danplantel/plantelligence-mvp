"use client";

import { Document } from "@/types/new-client-wizard";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";

function isTempDocumentId(id: string): boolean {
  return (
    String(id).startsWith("temp-") ||
    String(id).startsWith("doc-") ||
    String(id).startsWith("plan-doc-") ||
    String(id).startsWith("optional-doc-")
  );
}

/**
 * Persist documents that were uploaded to R2 (storageKey + temp id) to the API.
 * Category may be inferred from `storageKey` (`.../documents/retirement|...`) via
 * `resolvePersistedDocumentCategory` on the server — same as portal lists.
 * Uses POST /api/documents/batch when multiple rows qualify; otherwise POST /api/documents.
 */
export async function persistNewDocumentsToApi(
  clientId: string,
  documents: Document[],
): Promise<Document[]> {
  const toPersist = documents.filter(
    (d) =>
      d.storageKey &&
      String(d.storageKey).trim() !== "" &&
      isTempDocumentId(String(d.id)),
  );
  if (toPersist.length === 0) {
    return documents;
  }

  const items = toPersist.map((d) => {
    const exp = (d as any).expirationDate;
    const expirationDate =
      exp != null && String(exp).trim() !== "" ? String(exp).trim() : null;
    const docType = (d as any).type || "Document";
    const categoryForApi = resolvePersistedDocumentCategory(
      docType,
      d.category,
      (d as { storageKey?: string }).storageKey,
    );
    return {
      storageKey: d.storageKey!.trim(),
      fileName: d.originalFileName || d.name || "document",
      title: d.name || d.originalFileName || "Document",
      type: docType,
      category: categoryForApi,
      categorySuggested: (d as any).categorySuggested ?? null,
      categoryConfidence: (d as any).categoryConfidence ?? null,
      shortDescription: (d as any).shortDescription ?? null,
      language: (d as any).language ?? "EN",
      ...(expirationDate ? { expirationDate } : {}),
      ...((d as any).showQrCode === false ? { showQrCode: false } : {}),
    };
  });

  const updated = [...documents];

  try {
    if (items.length === 1) {
      const d = toPersist[0];
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          ...items[0],
        }),
      });
      const data = await res.json();
      if (data.document?.id) {
        const idx = updated.findIndex((x) => x.id === d.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], id: data.document.id };
        }
      } else if (!res.ok) {
        console.error("[benefits-document-persist] Single create failed:", data);
      }
      return updated;
    }

    const res = await fetch("/api/documents/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, items }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[benefits-document-persist] Batch create failed:", data);
      return documents;
    }
    const created = (data.documents ?? []) as { id: string; fileName?: string }[];
    toPersist.forEach((d, i) => {
      const id = created[i]?.id;
      if (!id) return;
      const idx = updated.findIndex((x) => x.id === d.id);
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], id };
      }
    });
  } catch (err) {
    console.error("Failed to persist documents to API:", err);
  }

  return updated;
}
