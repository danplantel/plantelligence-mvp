import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

/**
 * The four benefit pages every plan can have. `visibilityKey` matches the keys
 * used by `Client.categoryPortalVisibility` (`Other` is the plan-sponsor /
 * wellness hub).
 */
const BENEFIT_CATEGORIES: {
  category: string;
  label: string;
  visibilityKey: string;
}[] = [
  { category: "Retirement", label: "Retirement Plan Benefits", visibilityKey: "Retirement" },
  { category: "Group Health", label: "Health Insurance", visibilityKey: "Group Health" },
  { category: "Group Life", label: "Life Insurance", visibilityKey: "Group Life" },
  { category: "Company / Plan Sponsor", label: "Wellness Programs", visibilityKey: "Other" },
];

export interface BenefitListRow {
  planId: string;
  planName: string;
  planSlug: string | null;
  planStatus: string | null;
  category: string;
  label: string;
  /** Key for the plan's `categoryPortalVisibility` map. */
  visibilityKey: string;
  /** Benefit row title when it exists, otherwise the category default. */
  title: string;
  partnerLogo: string | null;
  /** Benefit row `isEnabled` (published). Defaults to true when no row exists. */
  isEnabled: boolean;
  /** Whether a Benefit row has been created for this plan + category. */
  exists: boolean;
  /** The plan's raw `categoryPortalVisibility` map (all four keys). */
  planVisibility: Record<string, boolean>;
}

/**
 * GET /api/benefits
 *
 * Browse Benefits: one row per plan x category for the signed-in advisor's
 * plans, so the list can show logo, status, a visibility toggle, and an edit
 * action without loading each plan individually.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        companyName: true,
        slug: true,
        status: true,
        categoryPortalVisibility: true,
      },
    });

    if (clients.length === 0) {
      return NextResponse.json({ success: true, benefits: [] as BenefitListRow[] });
    }

    const benefits = await prisma.benefit.findMany({
      where: { clientId: { in: clients.map((c) => c.id) } },
      select: {
        clientId: true,
        category: true,
        title: true,
        partnerLogo: true,
        isEnabled: true,
      },
    });

    const normalize = (value: string | null | undefined) =>
      (value || "").toLowerCase().trim().replace(/\s+/g, " ");

    const byPlanCategory = new Map<string, (typeof benefits)[number]>();
    for (const benefit of benefits) {
      byPlanCategory.set(`${benefit.clientId}::${normalize(benefit.category)}`, benefit);
    }

    const rows: BenefitListRow[] = [];
    for (const client of clients) {
      const visibility =
        (client.categoryPortalVisibility as Record<string, boolean> | null) ?? {};
      for (const cat of BENEFIT_CATEGORIES) {
        const row = byPlanCategory.get(`${client.id}::${normalize(cat.category)}`);
        // Visibility lives on the client; fall back to the benefit's own flag.
        const visible =
          visibility[cat.visibilityKey] !== false &&
          (row ? row.isEnabled !== false : true);
        rows.push({
          planId: client.id,
          planName: client.companyName || "Untitled plan",
          planSlug: client.slug ?? null,
          planStatus: client.status ?? null,
          category: cat.category,
          label: cat.label,
          visibilityKey: cat.visibilityKey,
          title: row?.title || cat.label,
          partnerLogo: row?.partnerLogo ?? null,
          isEnabled: visible,
          exists: !!row,
          planVisibility: visibility,
        });
      }
    }

    return NextResponse.json({ success: true, benefits: rows });
  } catch (error: any) {
    console.error("[api/benefits] GET error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load benefits" },
      { status: 500 },
    );
  }
}
