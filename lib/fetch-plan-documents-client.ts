/**
 * Loads plan documents from the **same API** as Create Benefits Step 4:
 * `GET /api/documents/client/[clientId]` → Prisma `Document` rows for that client/plan.
 *
 * Single-flight dedupe: portal (retirement, completeness, …) + wizard refetches share one in-flight fetch.
 */
const inflight = new Map<string, Promise<unknown[]>>();

export async function fetchPlanDocumentsForClient(
  clientId: string,
): Promise<unknown[]> {
  const existing = inflight.get(clientId);
  if (existing) return existing;

  const p = (async (): Promise<unknown[]> => {
    try {
      // forPortal=1 lets anonymous subdomain visitors load documents (the API
      // resolves the owning advisor from x-advisor-id / the Host subdomain). On
      // the dashboard (apex/localhost) it falls back to the session, so wizard
      // and dashboard callers are unaffected.
      const res = await fetch(`/api/documents/client/${clientId}?forPortal=1`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return [];
      const j = (await res.json()) as {
        success?: boolean;
        data?: unknown[];
      };
      if (j.success && Array.isArray(j.data)) return j.data;
      return [];
    } catch {
      return [];
    } finally {
      inflight.delete(clientId);
    }
  })();

  inflight.set(clientId, p);
  return p;
}
