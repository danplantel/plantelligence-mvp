import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { getBenefitCompleteness } from "@/lib/benefit-completeness";

// Reads the session (request headers), so it must never be statically prerendered.
export const dynamic = "force-dynamic";

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
  /** Setup completeness (Complete vs Incomplete), matching the wizard's check. */
  isComplete: boolean;
  /** What is still missing when `isComplete` is false. */
  missingInfo: string[];
}

/**
 * GET /api/benefits
 *
 * Browse Benefits: one row per plan x category for the signed-in advisor's
 * plans, so the list can show logo, published state, completeness, a visibility
 * toggle, and an edit action without loading each plan individually.
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
        employeePortalPreview: true,
        companyLogo: true,
        keyContacts: true,
      },
    });

    if (clients.length === 0) {
      return NextResponse.json({ success: true, benefits: [] as BenefitListRow[] });
    }

    const clientIds = clients.map((c) => c.id);

    const [benefits, documents] = await Promise.all([
      prisma.benefit.findMany({
        where: { clientId: { in: clientIds } },
        select: {
          clientId: true,
          category: true,
          title: true,
          shortDescription: true,
          partnerLogo: true,
          backgroundImage: true,
          providerContact: true,
          isEnabled: true,
        },
      }),
      // Only the fields the completeness check reads — never the base64 `file`.
      //
      // IMPORTANT: do NOT add `archivedAt: null` to this `where`. Prisma's MongoDB
      // connector treats a `null` filter as "field equals null" and does not match
      // documents where the field is ABSENT — which is every document uploaded before
      // soft-archiving existed. That filter therefore returned an empty list, so every
      // category was reported "Plan documents missing" even when the plan had
      // documents (same pitfall documented in app/api/clients/[id]/route.ts and
      // app/api/documents/route.ts). Archived rows are skipped in JS below instead.
      prisma.document.findMany({
        where: { clientId: { in: clientIds } },
        select: {
          clientId: true,
          type: true,
          category: true,
          storageKey: true,
          archivedAt: true,
        },
      }),
    ]);

    const documentsByClient = new Map<string, typeof documents>();
    for (const doc of documents) {
      // Soft-archived documents don't count toward completeness. Filtered here rather
      // than in the query — see the note on the findMany above.
      if (doc.archivedAt) continue;
      const list = documentsByClient.get(doc.clientId) ?? [];
      list.push(doc);
      documentsByClient.set(doc.clientId, list);
    }

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
      const clientDocuments = documentsByClient.get(client.id) ?? [];

      for (const cat of BENEFIT_CATEGORIES) {
        const row = byPlanCategory.get(`${client.id}::${normalize(cat.category)}`);
        // Visibility lives on the client; fall back to the benefit's own flag.
        const visible =
          visibility[cat.visibilityKey] !== false &&
          (row ? row.isEnabled !== false : true);

        // Same completeness check the wizard uses, fed with this plan's contacts
        // and documents plus the authoritative Benefit row for the category.
        const completeness = getBenefitCompleteness(cat.category as any, {
          ...client,
          companyData: (client.employeePortalPreview as any)?.companyData,
          employeePortalPreview: {
            ...((client.employeePortalPreview as any) || {}),
            benefits: row ? [row] : [],
          },
          keyContacts: client.keyContacts,
          documents: clientDocuments,
        });

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
          isComplete: completeness.isComplete,
          missingInfo: completeness.missingInfo,
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
