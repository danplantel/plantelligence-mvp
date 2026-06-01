import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCategoryPortalVisibility } from "@/lib/portal-category-visibility";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { DUPLICATE_PLAN_NAME_CODE } from "@/lib/duplicate-plan-name-error";

/** Persist logo removal: Prisma update must set null, not omit the field. */
function companyLogoFieldsForPersistence(
  logoSource: unknown,
  cb?: { logoFileName?: string | null },
): {
  companyLogo?: string | null;
  logoFileName?: string | null;
} {
  if (logoSource === null) {
    return { companyLogo: null, logoFileName: null };
  }
  if (typeof logoSource === "string") {
    const t = logoSource.trim();
    if (!t) return { companyLogo: null, logoFileName: null };
    return { companyLogo: t };
  }
  if (logoSource && typeof logoSource === "object") {
    const url = (logoSource as { url?: string | null }).url;
    if (url === undefined || url === null || String(url).trim() === "") {
      return { companyLogo: null, logoFileName: null };
    }
    const fromObj = (logoSource as { fileName?: string | null }).fileName;
    const fileName =
      fromObj !== undefined && fromObj !== null
        ? fromObj
        : cb?.logoFileName !== undefined
          ? cb.logoFileName
          : undefined;
    return {
      companyLogo: String(url).trim(),
      ...(fileName !== undefined && fileName !== null
        ? { logoFileName: fileName }
        : {}),
    };
  }
  return {};
}

function clientLogoCropAndFileForPersistence(
  logoSource: unknown,
  cb: { logoFileName?: string | null },
): {
  companyLogo?: string | null;
  logoFileName?: string | null;
  companyLogoCropData?: Prisma.InputJsonValue | null;
} {
  if (logoSource === null) {
    return {
      companyLogo: null,
      logoFileName: null,
      companyLogoCropData: null,
    };
  }
  if (typeof logoSource === "string") {
    const t = logoSource.trim();
    if (!t) {
      return {
        companyLogo: null,
        logoFileName: null,
        companyLogoCropData: null,
      };
    }
    return { companyLogo: t };
  }
  if (logoSource && typeof logoSource === "object") {
    const url = (logoSource as { url?: string | null }).url;
    if (url === undefined || url === null || String(url).trim() === "") {
      return {
        companyLogo: null,
        logoFileName: null,
        companyLogoCropData: null,
      };
    }
    let fileName = cb.logoFileName;
    if (fileName === undefined && (logoSource as { fileName?: string }).fileName !== undefined) {
      fileName = (logoSource as { fileName?: string }).fileName ?? null;
    }
    const crop = (logoSource as { cropData?: unknown }).cropData;
    return {
      companyLogo: String(url).trim(),
      ...(fileName !== undefined && { logoFileName: fileName }),
      ...(crop !== undefined && {
        companyLogoCropData: crop as Prisma.InputJsonValue,
      }),
    };
  }
  return {};
}

const normalizeContactBuilderToKeyContact = (contactBuilder: any) => {
  if (!contactBuilder) return null;

  const allowedRoles = ["advisor", "hr", "recordkeeper", "other"];
  const baseRole = contactBuilder.customRole ?? "";
  const role = allowedRoles.includes(baseRole) ? baseRole : "other";

  const customRoleLabel =
    contactBuilder.title ||
    (role === "other"
      ? contactBuilder.customRole || "Contact"
      : contactBuilder.customRole || "");

  let contactButtonType: "email" | "phone" | "calendar" | "url" | undefined;

  if (contactBuilder.meetingLink) {
    contactButtonType = "url";
  } else if (contactBuilder.enableContactButton && contactBuilder.email) {
    contactButtonType = "email";
  } else if (contactBuilder.enableContactButton && contactBuilder.phone) {
    contactButtonType = "phone";
  }

  return {
    id: contactBuilder.id,
    name: contactBuilder.fullName,
    email: contactBuilder.email || "",
    phone: contactBuilder.phone || "",
    role,
    customRole: customRoleLabel,
    headshot: contactBuilder.headshot || null,
    showOnPortal: Boolean(contactBuilder.showOnPortal),
    enableContactButton: Boolean(contactBuilder.enableContactButton),
    contactUrl: contactBuilder.meetingLink || "",
    bio: contactBuilder.description || "",
    isPrimary: Boolean(contactBuilder.showOnPortal),
    displayEmail: Boolean(contactBuilder.email),
    displayPhone: Boolean(contactBuilder.phone),
    displayUrl: Boolean(contactBuilder.meetingLink),
    contactButton: Boolean(contactBuilder.enableContactButton),
    contactButtonType,
    companyName: contactBuilder.companyName || "",
  };
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let stepData: any;
    let currentStep: number | undefined;
    let clientId: string | undefined;
    try {
      const body = await request.json();
      stepData = body?.stepData;
      currentStep = body?.currentStep;
      clientId = body?.clientId;
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError);
      console.error("❌ [SAVE DRAFT API] JSON parse error:", msg);
      return NextResponse.json(
        { error: "Invalid request body", details: msg },
        { status: 400 }
      );
    }
    if (!stepData) {
      return NextResponse.json({ error: "Missing step data" }, { status: 400 });
    }

    let client: any = null;

    // Find the active wizard session
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "No active wizard session found" }, { status: 404 });
    }

    // --- 1. Update Wizard Session Sub-Records ---
    const savePromises = [];

    // Company Basics — save when any meaningful fields are present (not just companyName)
    if (
      stepData.companyBasics &&
      (stepData.companyBasics.companyName ||
        stepData.companyBasics.planType?.trim())
    ) {
      const cb = stepData.companyBasics;
      const logoPatch = companyLogoFieldsForPersistence(cb.companyLogo, cb);
      const brandImagesToSave =
        cb.brandImages && typeof cb.brandImages === "object"
          ? { ...cb.brandImages }
          : cb.brandImages;
      if (
        brandImagesToSave &&
        typeof brandImagesToSave === "object" &&
        !Array.isArray(brandImagesToSave)
      ) {
        const meta = { ...((brandImagesToSave as any)._meta || {}) };
        if (cb.missionHeadline !== undefined) {
          meta.missionHeadline = cb.missionHeadline || null;
        }
        if (cb.missionBody !== undefined) {
          meta.missionBody = cb.missionBody || null;
        }
        if (cb.heroTitle !== undefined) {
          meta.heroTitle = cb.heroTitle || null;
        }
        if (cb.heroDescription !== undefined) {
          meta.heroDescription = cb.heroDescription || null;
        }
        (brandImagesToSave as any)._meta = meta;
      }

      const dataToSave: any = {
        companyName: cb.companyName,
        ...(cb.companyWebsite !== undefined && { companyWebsite: cb.companyWebsite || null }),
        ...logoPatch,
        ...(cb.primaryColor !== undefined && { primaryColor: cb.primaryColor }),
        ...(cb.secondaryColor !== undefined && { secondaryColor: cb.secondaryColor }),
        ...(cb.brandImages !== undefined && { brandImages: brandImagesToSave }),
        ...(cb.planType !== undefined && { planType: cb.planType }),
        ...(cb.heroOverlayOpacity !== undefined && { heroOverlayOpacity: cb.heroOverlayOpacity }),
        ...(cb.heroBackgroundOpacity !== undefined && { heroBackgroundOpacity: cb.heroBackgroundOpacity }),
        ...(cb.heroContainerOpacity !== undefined && { heroContainerOpacity: cb.heroContainerOpacity }),
        ...(cb.heroContainerBackgroundOpacity !== undefined && { heroContainerBackgroundOpacity: cb.heroContainerBackgroundOpacity }),
        ...(cb.heroContainerBlockOpacity !== undefined && { heroContainerBlockOpacity: cb.heroContainerBlockOpacity }),
        ...(cb.heroCompanyNameColor !== undefined && { heroCompanyNameColor: cb.heroCompanyNameColor }),
        ...(cb.heroContainerInverted !== undefined && { heroContainerInverted: cb.heroContainerInverted }),
        ...(cb.heroBackgroundInverted !== undefined && { heroBackgroundInverted: cb.heroBackgroundInverted }),
        ...(cb.heroInverted !== undefined && { heroInverted: cb.heroInverted }),
        ...(cb.heroUseGradient !== undefined && { heroUseGradient: cb.heroUseGradient }),
      };

      savePromises.push(
        prisma.newClientCompanyBasics.upsert({
          where: { sessionId: wizardSession.id },
          update: dataToSave,
          create: { sessionId: wizardSession.id, ...dataToSave },
        })
      );
    }

    // Welcome Statement
    if (stepData.welcomeStatement) {
      const { advisorName, advisorAvatar, ...welcomeStatementData } = stepData.welcomeStatement;
      savePromises.push(
        prisma.newClientWelcomeStatement.upsert({
          where: { sessionId: wizardSession.id },
          update: welcomeStatementData,
          create: { sessionId: wizardSession.id, ...welcomeStatementData },
        })
      );
    }

    // Key Contacts
    if (stepData.keyContacts) {
      const kc = stepData.keyContacts;
      let contactsArray = Array.isArray(kc) ? kc : (Array.isArray(kc.contacts) ? kc.contacts : []);
      let displayStyle = kc.displayStyle !== undefined ? kc.displayStyle : null;
      const step3SubStep = (stepData as any).step3SubStep?.step3SubStep || (stepData as any).step3SubStep || null;

      const keyContactsData: any = {
        ...kc,
        contacts: contactsArray,
        displayStyle: displayStyle,
        ...(step3SubStep && { step3SubStep }),
      };

      savePromises.push(
        prisma.newClientKeyContacts.upsert({
          where: { sessionId: wizardSession.id },
          update: { contacts: keyContactsData },
          create: { sessionId: wizardSession.id, contacts: keyContactsData },
        })
      );
    }

    // Contact Builder
    if (stepData.contactBuilder) {
      savePromises.push(
        prisma.newClientContactBuilder.upsert({
          where: { sessionId: wizardSession.id },
          update: stepData.contactBuilder,
          create: { sessionId: wizardSession.id, ...stepData.contactBuilder },
        })
      );
    }

    // Compliance Documents (JSON update)
    if (stepData.complianceDocuments) {
      savePromises.push(
        prisma.newClientComplianceDocuments.upsert({
          where: { sessionId: wizardSession.id },
          update: stepData.complianceDocuments,
          create: { sessionId: wizardSession.id, ...stepData.complianceDocuments },
        })
      );
    }

    // Employee Portal Preview / Disclaimers
    if (stepData.employeePortalPreview || stepData.disclaimers) {
      const existingPreview = await prisma.newClientEmployeePortalPreview.findUnique({
        where: { sessionId: wizardSession.id },
      });
      const previewData = existingPreview?.previewData ? { ...(existingPreview.previewData as any) } : {};

      if (stepData.employeePortalPreview?.previewData) {
        Object.assign(previewData, stepData.employeePortalPreview.previewData);
      }
      // Flat shape from step-5d: categoryPortalVisibility is at top level of employeePortalPreview
      if (stepData.employeePortalPreview?.categoryPortalVisibility != null) {
        previewData.categoryPortalVisibility = getCategoryPortalVisibility(
          stepData.employeePortalPreview.categoryPortalVisibility
        );
      }
      if (stepData.disclaimers) {
        previewData.disclaimers = stepData.disclaimers.disclaimers;
        previewData.disclosuresText = stepData.disclaimers.disclosuresText;
        previewData.useDefaultDisclosures = stepData.disclaimers.useDefaultDisclosures;
      }
      if (stepData.employeePortalPreview?.step5SubStep) {
        previewData.step5SubStep = stepData.employeePortalPreview.step5SubStep;
      }

      savePromises.push(
        prisma.newClientEmployeePortalPreview.upsert({
          where: { sessionId: wizardSession.id },
          update: { previewData: previewData as any },
          create: { sessionId: wizardSession.id, previewData: previewData as any },
        })
      );
    }

    await Promise.all(savePromises);

    // --- 2. Update Wizard Session Metadata ---
    await prisma.newClientWizardSession.update({
      where: { id: wizardSession.id },
      data: {
        completed: false,
        currentStep: currentStep || 1,
        updatedAt: new Date(),
      },
    });

    // --- 3. Create or Update Client Record ---
    if (
      stepData.companyBasics?.companyName ||
      stepData.companyBasics?.planType?.trim()
    ) {
      const cb = stepData.companyBasics;
      const clientLogoPatch = clientLogoCropAndFileForPersistence(cb.companyLogo, cb);

      const brandImages = cb.brandImages || {};
      const brandImagesMeta = (brandImages as any)._meta || {};
      const missionHeadlineToSave = cb.missionHeadline ?? brandImagesMeta.missionHeadline ?? stepData.welcomeStatement?.headline ?? null;
      const missionBodyToSave = cb.missionBody ?? brandImagesMeta.missionBody ?? stepData.welcomeStatement?.bodyText ?? null;

      const headerImg = (brandImages as any).header;
      const thumbnailImg = (brandImages as any).thumbnail;
      const secondaryBannerImg = (brandImages as any).secondaryBanner;
      const faviconImg = (brandImages as any).favicon;

      const brandImagesCropData = {
        header: headerImg?.cropData || null,
        thumbnail: thumbnailImg?.cropData || null,
        secondaryBanner: secondaryBannerImg?.cropData || null,
        favicon: faviconImg?.cropData || null,
      };

      // Extract Contacts (ensure keyContacts is a plain object for Prisma Json)
      const kc = stepData.keyContacts && typeof stepData.keyContacts === "object" ? stepData.keyContacts : {};
      const rawContacts = Array.isArray(kc) ? kc : Array.isArray(kc.contacts) ? kc.contacts : [];
      const normalizedContacts = [...rawContacts];
      const displayStyle = kc.displayStyle ?? null;

      const builderContact = normalizeContactBuilderToKeyContact(stepData.contactBuilder);
      if (builderContact) {
        const idx = normalizedContacts.findIndex((c: any) => c?.id === builderContact.id);
        if (idx >= 0) normalizedContacts[idx] = { ...normalizedContacts[idx], ...builderContact };
        else normalizedContacts.push(builderContact);
      }

      // Final Client Data construction (Undefined-safe)
      const planNameTrimmed = (cb.companyName || "").trim();
      const effectivePlanName = planNameTrimmed || "[New Plan]";

      const clientUpdateData: any = {
        companyName: effectivePlanName,
        status: "Draft",
        type: cb.planType || "client",
        currentStep: currentStep || 1,
        updatedAt: new Date(),
        keyContacts: {
          contacts: normalizedContacts,
          displayStyle,
          ...((stepData as any).step3SubStep && { step3SubStep: (stepData as any).step3SubStep }),
          ...(kc.cardBackgroundColor !== undefined && { cardBackgroundColor: kc.cardBackgroundColor }),
          ...(kc.logoScale !== undefined && { logoScale: kc.logoScale }),
        },
        ...(cb.companyWebsite !== undefined && { companyWebsite: cb.companyWebsite }),
        ...clientLogoPatch,
        ...(cb.primaryColor !== undefined && { brandColor: cb.primaryColor }),
        ...(cb.secondaryColor !== undefined && { secondaryColor: cb.secondaryColor }),
        ...(missionHeadlineToSave !== null && { missionHeadline: missionHeadlineToSave }),
        ...(missionBodyToSave !== null && { missionBody: missionBodyToSave }),
        ...(cb.heroTitle !== undefined && { heroTitle: cb.heroTitle }),
        ...(cb.heroDescription !== undefined && { heroDescription: cb.heroDescription }),
        ...(cb.appointmentLink !== undefined && { appointmentLink: cb.appointmentLink }),
        ...(headerImg?.url && { backgroundImg: headerImg.url }),
        ...(headerImg?.fileName && { backgroundImgName: headerImg.fileName }),
        ...(thumbnailImg?.url && { thumbnailImg: thumbnailImg.url }),
        ...(thumbnailImg?.fileName && { thumbnailImgName: thumbnailImg.fileName }),
        ...(secondaryBannerImg?.url && { secondaryBannerImg: secondaryBannerImg.url }),
        ...(secondaryBannerImg?.fileName && { secondaryBannerImgName: secondaryBannerImg.fileName }),
        ...(faviconImg?.url && { faviconImg: faviconImg.url }),
        ...(faviconImg?.fileName && { faviconImgName: faviconImg.fileName }),
        ...(brandImagesCropData && { brandImagesCropData }),
        ...(stepData.complianceDocuments?.recordkeeper !== undefined && { recordkeeper: stepData.complianceDocuments.recordkeeper }),
        ...(stepData.disclaimers !== undefined && { disclaimers: stepData.disclaimers }),
        ...(stepData.employeePortalPreview !== undefined && { employeePortalPreview: stepData.employeePortalPreview }),
        // So GET /api/clients/[id] always has categoryPortalVisibility (Hide/Show from step 5)
        ...(stepData.employeePortalPreview?.categoryPortalVisibility != null && {
          categoryPortalVisibility: getCategoryPortalVisibility(stepData.employeePortalPreview.categoryPortalVisibility),
        }),
      };

      // Handle overlay settings
      const overlayFields = ['heroOverlayOpacity', 'heroBackgroundOpacity', 'heroContainerOpacity', 'heroContainerBackgroundOpacity', 'heroContainerBlockOpacity', 'heroCompanyNameColor', 'heroContainerInverted', 'heroBackgroundInverted', 'heroInverted', 'heroUseGradient'];
      overlayFields.forEach(f => { if (cb[f] !== undefined) clientUpdateData[f] = cb[f]; });

      let existingClient: Awaited<
        ReturnType<typeof prisma.client.findFirst>
      > | null = null;

      const userId = session.user.id;
      const clientIdStr =
        typeof clientId === "string" && clientId.trim() ? clientId.trim() : "";

      // 1. Explicit client row (draft load or user chose overwrite)
      if (clientIdStr) {
        existingClient = await prisma.client.findFirst({
          where: { id: clientIdStr, userId },
        });
      }

      // 2–3. When this save is not scoped to a client row yet (`clientId` omitted), any
      // existing plan with the same name must be an explicit user choice (modal), not a
      // silent merge into an old draft. Otherwise "new plan" + name "test" overwrites a
      // same-name draft with no warning.
      // Only run duplicate checks when the user has actually entered a plan name.
      if (!existingClient && !clientIdStr && planNameTrimmed) {
        const blocking = await prisma.client.findFirst({
          where: {
            userId,
            companyName: planNameTrimmed,
            status: { not: "Draft" },
          },
        });
        if (blocking) {
          // 200 + success:false avoids browser "POST … 409" console noise; client treats as conflict.
          return NextResponse.json(
            {
              success: false,
              error:
                "A plan with this name already exists. Cancel, use a different name, or confirm overwrite.",
              code: DUPLICATE_PLAN_NAME_CODE,
              existingClientId: blocking.id,
              companyName: blocking.companyName,
            },
            { status: 200 },
          );
        }
        const sameNameDraft = await prisma.client.findFirst({
          where: {
            userId,
            companyName: planNameTrimmed,
            status: "Draft",
          },
          orderBy: { updatedAt: "desc" },
        });
        if (sameNameDraft) {
          return NextResponse.json(
            {
              success: false,
              error:
                "A plan with this name already exists. Cancel, use a different name, or confirm overwrite.",
              code: DUPLICATE_PLAN_NAME_CODE,
              existingClientId: sameNameDraft.id,
              companyName: sameNameDraft.companyName,
            },
            { status: 200 },
          );
        }
      }

      // Legacy: clientId was sent but did not resolve — try same-name draft (resume edge cases)
      if (!existingClient && clientIdStr) {
        existingClient = await prisma.client.findFirst({
          where: {
            userId,
            companyName: planNameTrimmed,
            status: "Draft",
          },
          orderBy: { updatedAt: "desc" },
        });
      }

      if (existingClient) {
        // Clear OLD documents if we have NEW documents in this draft
        if (stepData.complianceDocuments) {
          await prisma.document.deleteMany({ where: { clientId: existingClient.id } });
        }
        client = await (prisma.client as any).update({
          where: { id: existingClient.id },
          data: clientUpdateData,
        });
      } else {
        client = await (prisma.client as any).create({
          data: { ...clientUpdateData, userId: session.user.id },
        });
      }

      // --- 4. Save Documents ---
      if (stepData.complianceDocuments) {
        const cd = stepData.complianceDocuments as any;
        const allDocs = [];
        if (cd.spdFile) allDocs.push({ ...cd.spdFile, type: "SPD" });
        if (Array.isArray(cd.retirementPlanDocuments)) allDocs.push(...cd.retirementPlanDocuments.map((d: any) => ({ ...d, type: "Document" })));
        if (Array.isArray(cd.otherDocuments)) allDocs.push(...cd.otherDocuments.map((d: any) => ({ ...d, type: "SBC" })));

        for (const doc of allDocs) {
          const storageKey = (doc as any).storageKey;
          const hasR2 = storageKey && typeof storageKey === "string" && storageKey.trim() !== "";
          const expirationRaw = (doc as any).expirationDate ?? (doc as any).expiresAt;
          const expirationDate =
            expirationRaw != null && String(expirationRaw).trim() !== ""
              ? new Date(expirationRaw)
              : null;
          const validExpiration =
            expirationDate && !Number.isNaN(expirationDate.getTime())
              ? expirationDate
              : null;
          const categorySuggested =
            typeof (doc as any).categorySuggested === "string" &&
            (doc as any).categorySuggested.trim()
              ? String((doc as any).categorySuggested).trim()
              : null;
          const categoryConfidence =
            typeof (doc as any).categoryConfidence === "number" &&
            Number.isFinite((doc as any).categoryConfidence)
              ? Math.round((doc as any).categoryConfidence)
              : null;

          if (hasR2) {
            await prisma.document.create({
              data: {
                title: doc.name || "Document",
                fileName: doc.originalFileName || doc.name || "file.pdf",
                fileUrl: "r2:stored",
                storageKey: storageKey.trim(),
                shortDescription: doc.shortDescription || null,
                type: doc.type,
                language: doc.language || "EN",
                clientId: client.id,
                category: resolvePersistedDocumentCategory(
                  doc.type,
                  doc.category,
                  storageKey,
                ),
                categorySuggested,
                categoryConfidence,
                expirationDate: validExpiration,
                uploadedAt: new Date(),
              } as any,
            });
            continue;
          }

          let fileUrl = doc.fileUrl || doc.file || "";
          if (fileUrl && fileUrl.trim() !== "" && fileUrl !== "r2:stored") {
            if (!fileUrl.startsWith('data:') && !fileUrl.startsWith('/api/') && !fileUrl.startsWith('http')) {
              fileUrl = `data:application/pdf;base64,${fileUrl}`;
            }
            await prisma.document.create({
              data: {
                title: doc.name || "Document",
                fileName: doc.originalFileName || doc.name || "file.pdf",
                fileUrl,
                shortDescription: doc.shortDescription || null,
                type: doc.type,
                language: doc.language || "EN",
                clientId: client.id,
                category: resolvePersistedDocumentCategory(
                  doc.type,
                  doc.category,
                  storageKey,
                ),
                categorySuggested,
                categoryConfidence,
                expirationDate: validExpiration,
                uploadedAt: new Date(),
              } as any,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Draft saved successfully",
      sessionId: wizardSession.id,
      ...(client?.id && { clientId: client.id })
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("❌ [SAVE DRAFT API] Error:", err.message, err.stack);
    return NextResponse.json(
      {
        error: "Failed to save draft",
        details: err.message,
        name: err.name,
      },
      { status: 500 }
    );
  }
}
