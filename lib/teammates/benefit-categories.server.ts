/**
 * benefit-categories.server — the benefit categories an organisation can scope access to.
 *
 * The four canonical categories live in `BENEFIT_CONTACT_CATEGORIES` and are the same for
 * every organisation. A **Custom benefit** is not: the Create Benefits wizard lets the
 * advisor name it (Create Benefits → Step 1 requires a `benefitTitle`), and it is stored as
 * a `Benefit` row with `category: "Company / Plan Sponsor"` and that title. So the titles
 * are per plan and per organisation, and they have to be read rather than assumed.
 *
 * Server-only. Takes an explicit `organizationId`.
 */

import prisma from "@/lib/prisma";

/** The category a Custom benefit is stored under. Mirrors lib/save-benefit. */
export const CUSTOM_BENEFIT_CATEGORY = "Company / Plan Sponsor";

/**
 * The distinct Custom benefit titles this organisation has created.
 *
 * Distinct because the same wording is usually reused across plans ("Wellness Programs"),
 * and a picker offering it five times would be noise. Sorted so the list does not reshuffle
 * between loads, and blank titles are dropped — a Custom benefit always has one, but a
 * half-written row should not become an unlabelled checkbox.
 *
 * Two queries rather than one relation traversal: `Benefit` is read through `clientId`, and
 * the organisation's plans are resolved first so the filter cannot accidentally reach
 * another organisation's benefits.
 */
export async function listCustomBenefitTitles(
  organizationId: string,
): Promise<string[]> {
  const plans = await prisma.client.findMany({
    where: { organizationId },
    select: { id: true },
  });
  if (plans.length === 0) return [];

  const benefits = await prisma.benefit.findMany({
    where: {
      clientId: { in: plans.map((plan) => plan.id) },
      category: CUSTOM_BENEFIT_CATEGORY,
    },
    select: { title: true },
  });

  const titles = benefits
    .map((benefit) => (benefit.title ?? "").trim())
    .filter((title) => title.length > 0);

  return [...new Set(titles)].sort((a, b) => a.localeCompare(b));
}
