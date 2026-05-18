import { prisma } from "@/lib/prisma";
import { getEffectiveWizardUserSetup } from "@/lib/effective-wizard-user-setup";
import { step2ServicesToCategories } from "@/lib/service-categories";
import { primaryServiceLabelToBenefitsCategory } from "@/lib/seed-onboarding-advisor-contacts";

/**
 * Same source order as load-draft / profile: User.primaryServiceCategories,
 * then wizard userSetup, then latest onboarding wizard Step 2 services.
 */
export async function resolveUserPrimaryServiceCategoryLabels(
  userId: string,
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { primaryServiceCategories: true },
  });
  let primaryCats: string[] =
    user && Array.isArray(user.primaryServiceCategories)
      ? [...user.primaryServiceCategories]
      : [];
  const userSetup = await getEffectiveWizardUserSetup(userId, null);
  if (
    primaryCats.length === 0 &&
    userSetup &&
    Array.isArray((userSetup as any).primaryServiceCategories) &&
    (userSetup as any).primaryServiceCategories.length > 0
  ) {
    primaryCats = [...(userSetup as any).primaryServiceCategories];
  }
  if (primaryCats.length === 0) {
    const ws = await prisma.wizardSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { services: true },
    });
    const sv = ws?.services?.services;
    if (Array.isArray(sv) && sv.length > 0) {
      primaryCats = step2ServicesToCategories(sv);
    }
  }
  return primaryCats;
}

/** True if at least one primary-service label maps to a Create Plan benefits category (Retirement, Group Health, …). */
export function userPrimaryServicesMapToBenefitsCategory(
  labels: string[],
): boolean {
  return labels.some((l) => primaryServiceLabelToBenefitsCategory(l) != null);
}
