import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import {
  normalizePrimaryServiceCategories,
  step2ServicesToCategories,
} from "@/lib/service-categories";
import { BenefitsListPage } from "@/components/pages/benefits/benefits-list";

/**
 * Browse Benefits.
 *
 * A Server Component for one reason: the "Your organization offers" strip is the top-most
 * element on the screen, and it used to fetch for itself from a client effect — so its read
 * raced the plan card's and the strip could appear *after* the plan's benefit rows, which
 * reads as a widget arriving late rather than as a header. Resolved here, the chips are part
 * of the first paint and structurally cannot arrive second.
 *
 * Everything below the strip (the plan picker, the selected plan's rows) is client-side, and
 * stays there: it is interactive, plan-scoped, and its own loading ladder lives in
 * `BenefitsListPage`.
 *
 * `force-dynamic` because the read is session-scoped — a static render would bake one
 * advisor's categories into a payload every visitor shares.
 */
export const dynamic = "force-dynamic";

/**
 * The labels for that strip, derived exactly as `GET /api/profile` derives them (see
 * app/api/profile/route.ts): the `User` column wins, and the latest wizard session's Step 2
 * answer is the fallback for accounts that predate it.
 *
 * Selects only what the strip needs, rather than reusing the profile route or the shared
 * client profile cache: that route also loads branding, user-setup, disclaimers and the
 * client profile, and it is precisely that weight that made the strip late.
 */
async function getOrgServiceCategories(
  userId: string | undefined,
): Promise<string[]> {
  if (!userId) return [];

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        primaryServiceCategories: true,
        wizardSessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { services: { select: { services: true } } },
        },
      },
    });
    if (!user) return [];

    const stored = normalizePrimaryServiceCategories(
      user.primaryServiceCategories,
    );
    if (stored.length > 0) return stored;

    return normalizePrimaryServiceCategories(
      step2ServicesToCategories(user.wizardSessions[0]?.services?.services ?? []),
    );
  } catch (error) {
    // Deliberately non-fatal, and the one place this page degrades instead of failing: the
    // strip is context, not content. Rendered as an empty answer it says "none selected",
    // which is what the client read it replaced also did on failure (it resolved `null`).
    // The alternative — throwing — would take the whole page down over a header.
    console.error("[benefits] org service categories", error);
    return [];
  }
}

export default async function BenefitsPage() {
  const session = await getServerSession(authOptions);
  const orgCategories = await getOrgServiceCategories(session?.user?.id);

  return <BenefitsListPage orgCategories={orgCategories} />;
}
