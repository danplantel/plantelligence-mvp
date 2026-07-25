/**
 * Merge rows from GET /api/documents/client and embedded GET /api/clients documents.
 * Prefer API fields but fill gaps (storageKey, fileUrl, category) from the client payload
 * so portal lists match Create Benefits / Step 4 behavior.
 */
export function mergePlanDocumentRows(
  apiRows: unknown[],
  clientEmbeddedDocs: unknown[],
): Record<string, unknown>[] {
  const embedded = Array.isArray(clientEmbeddedDocs)
    ? clientEmbeddedDocs
    : [];
  const api = Array.isArray(apiRows) ? apiRows : [];

  const ctxById = new Map<string, Record<string, unknown>>();
  for (const c of embedded) {
    if (c && typeof c === "object" && "id" in c && (c as { id?: string }).id) {
      ctxById.set(String((c as { id: string }).id), c as Record<string, unknown>);
    }
  }

  const apiIds = new Set<string>();

  const mergedFromApi = api.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || !("id" in raw)) return [];
    const a = raw as Record<string, unknown>;
    const id = String(a.id);
    apiIds.add(id);
    const ctx = ctxById.get(id);
    if (!ctx) return [{ ...a }];

    const sk =
      (typeof a.storageKey === "string" && a.storageKey.trim()) ||
      (typeof ctx.storageKey === "string" && String(ctx.storageKey).trim()) ||
      "";
    const fu =
      a.fileUrl != null && String(a.fileUrl).trim() !== ""
        ? a.fileUrl
        : ctx.fileUrl;

    return [
      {
        ...ctx,
        ...a,
        storageKey: sk || a.storageKey || ctx.storageKey,
        fileUrl: fu ?? a.fileUrl ?? ctx.fileUrl,
        category:
          (a.category != null && String(a.category).trim() !== ""
            ? a.category
            : ctx.category) ?? a.category,
      },
    ];
  });

  const onlyEmbedded = embedded
    .filter((c) => {
      if (!c || typeof c !== "object" || !("id" in c)) return false;
      return !apiIds.has(String((c as { id: string }).id));
    })
    .map((c) => ({ ...(c as Record<string, unknown>) }));

  const result = [...mergedFromApi, ...onlyEmbedded];

  // Deduplicate by (name + category) to handle cases where the same document
  // exists with different IDs (e.g. temporary doc- prefix vs persisted MongoDB ID).
  const seen = new Set<string>();
  return result.filter((doc) => {
    const nameKey = String(
      doc.title || doc.name || doc.fileName || doc.id || "",
    ).toLowerCase();
    const categoryKey = String(doc.category || "").toLowerCase();
    const dedupKey = `${nameKey}::${categoryKey}`;
    if (seen.has(dedupKey)) return false;
    seen.add(dedupKey);
    return true;
  });
}
