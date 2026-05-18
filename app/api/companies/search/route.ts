export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const MAX_RESULTS = 12;

type CompanySuggestionSource =
  | "client"
  | "plan"
  | "provider"
  | "recordkeeper"
  | "draft";

interface CompanySuggestion {
  id: string;
  name: string;
  logo?: string | null;
  source: CompanySuggestionSource;
}

const sanitizeLogo = (logo?: string | null) =>
  logo && logo.trim().length > 0 ? logo : null;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim() ?? "";

    if (query.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const userId = session.user.id;

    const [clients, plans, drafts] = await Promise.all([
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
    ]);

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

      const key = normalizedName.toLowerCase();
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

    const data = Array.from(suggestions.values()).slice(0, MAX_RESULTS);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error searching companies:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search companies" },
      { status: 500 },
    );
  }
}


