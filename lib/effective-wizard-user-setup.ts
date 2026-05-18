import prisma from "@/lib/prisma";

const WIZARD_SESSION_FALLBACK_LIMIT = 30;

/**
 * Prefer WizardUserSetup on the newest session; if that row has no phone, backfill phone from an older session.
 * Shared by GET /api/profile and new-client load-draft seeding.
 */
export async function getEffectiveWizardUserSetup(
  userId: string,
  latestSessionSetup: Record<string, unknown> | null | undefined,
) {
  const recentSessions = await prisma.wizardSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: WIZARD_SESSION_FALLBACK_LIMIT,
    select: { id: true },
  });
  if (recentSessions.length === 0) return null;

  const sessionIds = recentSessions.map((s) => s.id);
  const setups = await prisma.wizardUserSetup.findMany({
    where: { sessionId: { in: sessionIds } },
  });
  const bySessionId = new Map(setups.map((u) => [u.sessionId, u]));

  let base: (typeof setups)[number] | null = latestSessionSetup
    ? (latestSessionSetup as (typeof setups)[number])
    : null;
  if (!base) {
    for (const id of sessionIds) {
      const row = bySessionId.get(id);
      if (row) {
        base = row;
        break;
      }
    }
  }

  if (!base) return null;

  if ((base.phone ?? "").toString().trim()) return base;

  for (const id of sessionIds) {
    const row = bySessionId.get(id);
    if (row && (row.phone ?? "").toString().trim()) {
      return {
        ...base,
        phone: row.phone,
        phoneExtension: row.phoneExtension ?? base.phoneExtension,
      };
    }
  }

  return base;
}
