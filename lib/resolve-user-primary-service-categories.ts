import { prisma } from "@/lib/prisma";
import { step2ServicesToCategories } from "@/lib/service-categories";
import { primaryServiceLabelToBenefitsCategory } from "@/lib/seed-onboarding-advisor-contacts";

/**
 * Source order: User.primaryServiceCategories, then latest onboarding wizard Step 2 services.
 * WizardUserSetup no longer stores primaryServiceCategories.
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
