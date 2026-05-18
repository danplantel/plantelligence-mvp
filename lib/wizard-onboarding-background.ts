import prisma from "@/lib/prisma";

const SESSION_LIMIT = 30;

/** Resolve onboarding advisor background image (user setup) across wizard sessions, newest first. */
export async function getOnboardingAdvisorBackgroundImage(
  userId: string,
): Promise<string | null> {
  const sessions = await prisma.wizardSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: SESSION_LIMIT,
    select: { id: true },
  });
  if (sessions.length === 0) return null;

  const ids = sessions.map((s) => s.id);
  const setups = await prisma.wizardUserSetup.findMany({
    where: { sessionId: { in: ids } },
    select: { sessionId: true, backgroundImage: true },
  });
  const bySession = new Map(setups.map((u) => [u.sessionId, u]));
  for (const sid of ids) {
    const row = bySession.get(sid);
    const url = row?.backgroundImage?.trim();
    if (url) return url;
  }
  return null;
}
