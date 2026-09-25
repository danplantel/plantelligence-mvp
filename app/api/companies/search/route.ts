export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveOrganizationId } from "@/lib/organization";
import {
  allowedSourcesForScope,
  isExcludedFromPlanSponsor,
  normalizeCompanyKey,
  parseCompanySearchScope,
  type CompanySuggestionSource,
} from "@/lib/teammates/company-scope";

const MAX_RESULTS = 12;

interface CompanySuggestion {
  id: string;
  name: string;
  logo?: string | null;
  source: CompanySuggestionSource;
}

const sanitizeLogo = (logo?: string | null) =>
  logo && logo.trim().length > 0 ? logo : null;

/**
 * Company picker search.
 *
 * The `scope` parameter decides which sources are visible:
 *  - `plan_sponsor` — employers only; Partner Companies are excluded outright
 *    (spec T1 acceptance: "Partner companies never appear in Plan Sponsor search").
 *  - `provider`     — providers, recordkeepers, and plan-level companies.
 *  - omitted/`all`  — the legacy mixed list, so existing callers are unaffected.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim() ?? "";
    const scope = parseCompanySearchScope(searchParams.get("scope"));

    if (query.length < 2) {
      return NextResponse.json({ success: true, scope, data: [] });
    }

    const userId = session.user.id;
    const organizationId = await resolveOrganizationId(userId);

    const [clients, plans, drafts, partnerCompanies] = await Promise.all([
      prisma.client.findMany({
        where: {
          userId,
          companyName: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          companyName: true,
          companyLogo: true,
        },
        take: MAX_RESULTS,
      }),
      prisma.plan.findMany({
        where: {
          userId,
          OR: [
            { companyName: { contains: query, mode: "insensitive" } },
            { providerName: { contains: query, mode: "insensitive" } },
            { recordkeeper: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          companyName: true,
          providerName: true,
          providerLogo: true,
          recordkeeper: true,
        },
        take: MAX_RESULTS,
      }),
      prisma.newClientCompanyBasics.findMany({
        where: {
          session: {
            userId,
          },
          companyName: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          companyName: true,
          companyLogo: true,
        },
        take: MAX_RESULTS,
      }),
      // Partner Companies are a distinct entity type and are never Plan Sponsors.
      // Matching them by name is what lets a Plan Sponsor picker refuse to offer
      // one even when a client or plan happens to share the name.
      prisma.teammateCompany.findMany({
        where: {
          organizationId,
          name: { contains: query, mode: "insensitive" },
        },
        select: { name: true },
      }),
    ]);

    const partnerNames = new Set(
      partnerCompanies.map((c) => normalizeCompanyKey(c.name)),
    );

    const suggestions = new Map<string, CompanySuggestion>();

    const addSuggestion = (
      name?: string | null,
      logo?: string | null,
      source: CompanySuggestionSource = "client",
      id?: string,
    ) => {
      if (!name) return;
      const normalizedName = name.trim();
      if (!normalizedName) return;

      const key = normalizeCompanyKey(normalizedName);

      // Spec T1 acceptance: a Partner Company is never offered as a Plan Sponsor.
      if (scope === "plan_sponsor" && isExcludedFromPlanSponsor(name, partnerNames)) {
        return;
      }

      const sanitizedLogo = sanitizeLogo(logo);

      if (suggestions.has(key)) {
        const existing = suggestions.get(key)!;
        if (!existing.logo && sanitizedLogo) {
          suggestions.set(key, { ...existing, logo: sanitizedLogo });
        }
        return;
      }

      suggestions.set(key, {
        id: id ?? `${source}-${key}`,
        name: normalizedName,
        logo: sanitizedLogo,
        source,
      });
    };

    clients.forEach((client) =>
      addSuggestion(client.companyName, client.companyLogo, "client", client.id),
    );

    plans.forEach((plan) => {
      addSuggestion(plan.companyName, plan.providerLogo, "plan", plan.id);
      addSuggestion(
        plan.providerName,
        plan.providerLogo,
        "provider",
        `${plan.id}-provider`,
      );
      addSuggestion(
        plan.recordkeeper,
        null,
        "recordkeeper",
        `${plan.id}-recordkeeper`,
      );
    });

    drafts.forEach((draft) =>
      addSuggestion(
        draft.companyName,
        draft.companyLogo,
        "draft",
        draft.id ?? undefined,
      ),
    );

    let data = Array.from(suggestions.values());

    const allowedSources = allowedSourcesForScope(scope);
    if (allowedSources) {
      data = data.filter((s) => allowedSources.includes(s.source));
    }

    return NextResponse.json({
      success: true,
      scope,
      data: data.slice(0, MAX_RESULTS),
    });
  } catch (error) {
    console.error("Error searching companies:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search companies" },
      { status: 500 },
    );
  }
}
