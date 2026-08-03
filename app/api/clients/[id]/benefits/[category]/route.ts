import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ObjectId } from "mongodb";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";
import { getCategoryPortalVisibility } from "@/lib/portal-category-visibility";

/**
 * Shared helper: resolve a client by ObjectId or slug.
 * Supports both portal (forPortal + x-advisor-id) and authenticated access.
 */
async function resolveClient(
  id: string,
  request: NextRequest
): Promise<[any, NextResponse | null]> {
  const forPortal = request.nextUrl.searchParams.get("forPortal") === "1";
  const portalAdvisorId = forPortal
    ? (request.headers.get("x-advisor-id") || undefined)
    : undefined;

  let sessionUserId: string | undefined;

  if (!portalAdvisorId) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
    }
    sessionUserId = session.user.id;
  }

  const isObjectId = ObjectId.isValid(id);
  let client = null;

  if (isObjectId) {
    client = await prisma.client.findUnique({ where: { id } });
  }

  if (!client) {
    if (forPortal && portalAdvisorId) {
      client = await prisma.client.findFirst({
        where: { slug: id, userId: portalAdvisorId },
      });
    } else if (forPortal) {
      client = await prisma.client.findFirst({
        where: { slug: id, userId: sessionUserId },
      });
    } else {
      client = await prisma.client.findFirst({
        where: { slug: id, userId: sessionUserId },
      });
    }
  }

  if (!client) {
    return [null, NextResponse.json({ error: "Client not found" }, { status: 404 })];
  }

  // Ownership check for authenticated requests (portal requests are pre-scoped)
  if (!portalAdvisorId && client.userId !== sessionUserId) {
    return [null, NextResponse.json({ error: "Forbidden" }, { status: 403 })];
  }

  return [client, null];
}

/**
 * Convert R2 keys in a benefit to presigned URLs for the planVideo field.
 */
async function signBenefitVideo(b: any) {
  if (!isR2Configured() || !b?.planVideo) return b;

  const extractKey = (v: string): string | null => {
    if (!v || v.startsWith("http")) return null;
    try {
      const u = new URL(v, "http://localhost");
      const k = u.searchParams.get("key");
      if (k) return k;
    } catch { /* not a URL, treat as raw key */ }
    return v;
  };

  const rawKey = extractKey(String(b.planVideo));
  if (rawKey) {
    try {
      const url = await getPresignedReadUrl({ key: rawKey });
      if (url) return { ...b, planVideo: url };
    } catch { /* keep original */ }
  }
  return b;
}

/**
 * GET /api/clients/[id]/benefits/[category]
 * Returns a single benefit by category. R2 keys are converted to presigned URLs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; category: string } }
) {
  try {
    const [client, error] = await resolveClient(params.id, request);
    if (error) return error;

    const benefit = await prisma.benefit.findUnique({
      where: {
        clientId_category: {
          clientId: client!.id,
          category: params.category,
        },
      },
    });

    if (!benefit) {
      return NextResponse.json({ success: true, benefit: null });
    }

    const signed = await signBenefitVideo(benefit);

    return NextResponse.json({ success: true, benefit: signed });
  } catch (error) {
    console.error("Error fetching benefit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/[id]/benefits/[category]
 * Upserts a benefit by category. Also performs dual-write to employeePortalPreview.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; category: string } }
) {
  try {
    const [client, error] = await resolveClient(params.id, request);
    if (error) return error;

    const clientId = client!.id;
    const category = params.category;
    const body = await request.json();

    // Upsert the Benefit row
    const benefit = await prisma.benefit.upsert({
      where: {
        clientId_category: { clientId, category },
      },
      create: {
        clientId,
        category,
        title: body.title || category,
        shortDescription: body.shortDescription ?? null,
        journeyHeader: body.journeyHeader ?? null,
        journeySubtitle: body.journeySubtitle ?? null,
        journeyBodyText: body.journeyBodyText ?? null,
        planVideo: body.planVideo ?? null,
        planVideoFileName: body.planVideoFileName ?? null,
        partnerLogo: body.partnerLogo ?? null,
        backgroundImage: body.backgroundImage ?? null,
        innerHeaderImage: body.innerHeaderImage ?? null,
        helpCards: body.helpCards ?? null,
        insurancePlanId: body.insurancePlanId ?? null,
        insuranceLoginUrl: body.insuranceLoginUrl ?? null,
        insuranceBackgroundImage: body.insuranceBackgroundImage ?? null,
        insuranceContainerBlockOpacity: body.insuranceContainerBlockOpacity ?? null,
        faqs: body.faqs ?? null,
        supportContacts: body.supportContacts ?? null,
        signatureMode: body.signatureMode ?? null,
        customClosing: body.customClosing ?? null,
        customSignatureName: body.customSignatureName ?? null,
        customSignatureCompany: body.customSignatureCompany ?? null,
        customClosingBold: body.customClosingBold ?? null,
        customClosingItalic: body.customClosingItalic ?? null,
        customSignatureNameBold: body.customSignatureNameBold ?? null,
        customSignatureNameItalic: body.customSignatureNameItalic ?? null,
        customSignatureCompanyBold: body.customSignatureCompanyBold ?? null,
        customSignatureCompanyItalic: body.customSignatureCompanyItalic ?? null,
        heroBackgroundOpacity: body.heroBackgroundOpacity ?? null,
        heroContainerBlockOpacity: body.heroContainerBlockOpacity ?? null,
        heroContainerInverted: body.heroContainerInverted ?? null,
        heroBackgroundInverted: body.heroBackgroundInverted ?? null,
        heroUseGradient: body.heroUseGradient ?? null,
        desktopHeroBackgroundPosition: body.desktopHeroBackgroundPosition ?? null,
        mobileHeroBackgroundPosition: body.mobileHeroBackgroundPosition ?? null,
        isEnabled: body.isEnabled ?? true,
      },
      update: {
        title: body.title !== undefined ? body.title : undefined,
        shortDescription: body.shortDescription !== undefined ? body.shortDescription : undefined,
        journeyHeader: body.journeyHeader !== undefined ? body.journeyHeader : undefined,
        journeySubtitle: body.journeySubtitle !== undefined ? body.journeySubtitle : undefined,
        journeyBodyText: body.journeyBodyText !== undefined ? body.journeyBodyText : undefined,
        planVideo: body.planVideo !== undefined ? body.planVideo : undefined,
        planVideoFileName: body.planVideoFileName !== undefined ? body.planVideoFileName : undefined,
        partnerLogo: body.partnerLogo !== undefined ? body.partnerLogo : undefined,
        backgroundImage: body.backgroundImage !== undefined ? body.backgroundImage : undefined,
        innerHeaderImage: body.innerHeaderImage !== undefined ? body.innerHeaderImage : undefined,
        helpCards: body.helpCards !== undefined ? body.helpCards : undefined,
        insurancePlanId: body.insurancePlanId !== undefined ? body.insurancePlanId : undefined,
        insuranceLoginUrl: body.insuranceLoginUrl !== undefined ? body.insuranceLoginUrl : undefined,
        insuranceBackgroundImage: body.insuranceBackgroundImage !== undefined ? body.insuranceBackgroundImage : undefined,
        insuranceContainerBlockOpacity: body.insuranceContainerBlockOpacity !== undefined ? body.insuranceContainerBlockOpacity : undefined,
        faqs: body.faqs !== undefined ? body.faqs : undefined,
        supportContacts: body.supportContacts !== undefined ? body.supportContacts : undefined,
        signatureMode: body.signatureMode !== undefined ? body.signatureMode : undefined,
        customClosing: body.customClosing !== undefined ? body.customClosing : undefined,
        customSignatureName: body.customSignatureName !== undefined ? body.customSignatureName : undefined,
        customSignatureCompany: body.customSignatureCompany !== undefined ? body.customSignatureCompany : undefined,
        customClosingBold: body.customClosingBold !== undefined ? body.customClosingBold : undefined,
        customClosingItalic: body.customClosingItalic !== undefined ? body.customClosingItalic : undefined,
        customSignatureNameBold: body.customSignatureNameBold !== undefined ? body.customSignatureNameBold : undefined,
        customSignatureNameItalic: body.customSignatureNameItalic !== undefined ? body.customSignatureNameItalic : undefined,
        customSignatureCompanyBold: body.customSignatureCompanyBold !== undefined ? body.customSignatureCompanyBold : undefined,
        customSignatureCompanyItalic: body.customSignatureCompanyItalic !== undefined ? body.customSignatureCompanyItalic : undefined,
        heroBackgroundOpacity: body.heroBackgroundOpacity !== undefined ? body.heroBackgroundOpacity : undefined,
        heroContainerBlockOpacity: body.heroContainerBlockOpacity !== undefined ? body.heroContainerBlockOpacity : undefined,
        heroContainerInverted: body.heroContainerInverted !== undefined ? body.heroContainerInverted : undefined,
        heroBackgroundInverted: body.heroBackgroundInverted !== undefined ? body.heroBackgroundInverted : undefined,
        heroUseGradient: body.heroUseGradient !== undefined ? body.heroUseGradient : undefined,
        desktopHeroBackgroundPosition: body.desktopHeroBackgroundPosition !== undefined ? body.desktopHeroBackgroundPosition : undefined,
        mobileHeroBackgroundPosition: body.mobileHeroBackgroundPosition !== undefined ? body.mobileHeroBackgroundPosition : undefined,
        isEnabled: body.isEnabled !== undefined ? body.isEnabled : undefined,
      },
    });

    // DUAL-WRITE: Sync benefit back to employeePortalPreview JSON for backward compatibility
    try {
      const allBenefits = await prisma.benefit.findMany({ where: { clientId } });
      const existingEp = (client as any).employeePortalPreview || {};

      // Map existing legacy benefits by category so we can preserve legacy-only
      // fields (e.g. `image`) when the corresponding Benefit row is not yet
      // backfilled. Prevents the dual-write from wiping a previously-saved header.
      const norm = (cat: string) =>
        (cat || "").toLowerCase().trim().replace(/\s+/g, " ");
      const legacyByCategory = new Map<string, any>();
      const existingLegacy = Array.isArray(existingEp.benefits)
        ? existingEp.benefits
        : [];
      for (const lb of existingLegacy) {
        const key = norm(String(lb?.category ?? ""));
        if (key && !legacyByCategory.has(key)) legacyByCategory.set(key, lb);
      }

      // Map Benefit rows → legacy benefit array shape
      const benefitsArray = allBenefits.map((b) => {
        const legacy = legacyByCategory.get(norm(b.category));
        const bg = b.backgroundImage || legacy?.image || null;
        return {
        id: b.category.toLowerCase().replace(/\s+/g, "-"),
        title: b.title,
        category: b.category,
        isEnabled: b.isEnabled,
        shortDescription: b.shortDescription,
        journeyHeader: b.journeyHeader,
        journeySubtitle: b.journeySubtitle,
        journeyBodyText: b.journeyBodyText,
        planVideo: b.planVideo,
        planVideoFileName: b.planVideoFileName,
        partnerLogo: b.partnerLogo,
        // Legacy consumers (portal-welcome-banner, completeness check) read the
        // header background from `image`; the new Benefit model calls it
        // `backgroundImage`. Write both so neither breaks during dual-write.
        image: bg,
        backgroundImage: bg,
        innerHeaderImage: b.innerHeaderImage,
        helpCards: b.helpCards,
        insurancePlanId: b.insurancePlanId,
        insuranceLoginUrl: b.insuranceLoginUrl,
        insuranceBackgroundImage: b.insuranceBackgroundImage,
        insuranceContainerBlockOpacity: b.insuranceContainerBlockOpacity,
        faqs: b.faqs,
        supportContacts: b.supportContacts,
        signatureMode: b.signatureMode,
        customClosing: b.customClosing,
        customSignatureName: b.customSignatureName,
        customSignatureCompany: b.customSignatureCompany,
        customClosingBold: b.customClosingBold,
        customClosingItalic: b.customClosingItalic,
        customSignatureNameBold: b.customSignatureNameBold,
        customSignatureNameItalic: b.customSignatureNameItalic,
        customSignatureCompanyBold: b.customSignatureCompanyBold,
        customSignatureCompanyItalic: b.customSignatureCompanyItalic,
        heroBackgroundOpacity: b.heroBackgroundOpacity,
        heroContainerBlockOpacity: b.heroContainerBlockOpacity,
        heroContainerInverted: b.heroContainerInverted,
        heroBackgroundInverted: b.heroBackgroundInverted,
        heroUseGradient: b.heroUseGradient,
        desktopHeroBackgroundPosition: b.desktopHeroBackgroundPosition,
        mobileHeroBackgroundPosition: b.mobileHeroBackgroundPosition,
      };
      });

      await prisma.client.update({
        where: { id: clientId },
        data: {
          employeePortalPreview: { ...existingEp, benefits: benefitsArray },
        },
      });
    } catch (dualWriteErr) {
      console.error("Dual-write to employeePortalPreview failed (non-fatal):", dualWriteErr);
    }

    const signed = await signBenefitVideo(benefit);

    return NextResponse.json({ success: true, benefit: signed });
  } catch (error) {
    console.error("Error upserting benefit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/benefits/[category]
 * Soft-disables a benefit (sets isEnabled = false).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; category: string } }
) {
  try {
    const [client, error] = await resolveClient(params.id, request);
    if (error) return error;

    const category = params.category;

    await prisma.benefit.updateMany({
      where: {
        clientId: client!.id,
        category,
      },
      data: {
        isEnabled: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting benefit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
