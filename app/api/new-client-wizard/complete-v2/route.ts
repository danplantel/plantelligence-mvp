import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  areAllCategoriesHiddenInPortal,
  getCategoryPortalVisibility,
} from "@/lib/portal-category-visibility";
import {
  resolveUserPrimaryServiceCategoryLabels,
  userPrimaryServicesMapToBenefitsCategory,
} from "@/lib/resolve-user-primary-service-categories";
import {
  isR2Configured,
  buildBrandingKey,
  putObjectBuffer,
} from "@/lib/r2";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { getOnboardingAdvisorBackgroundImage } from "@/lib/wizard-onboarding-background";

function isR2Key(s: string | null | undefined): boolean {
  return typeof s === "string" && s.startsWith("org/");
}

function base64DataUrlToBuffer(
  dataUrl: string
): { buffer: Buffer; contentType: string } | null {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1].trim();
  const b64 = match[2];
  try {
    const buffer = Buffer.from(b64, "base64");
    return { buffer, contentType };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get draftClientId from request body if provided
    const body = await request.json().catch(() => ({}));
    const draftClientId = body.draftClientId;

    // Find the active wizard session with new data structure
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      },
      include: {
        companyBasics: true,
        welcomeStatement: true,
        keyContacts: true,
        complianceDocuments: true,
        employeePortalPreview: true,
      },
      orderBy: { createdAt: "desc" } // Get the most recent session
    });

    if (!wizardSession) {
      return NextResponse.json({ error: "No active wizard session" }, { status: 404 });
    }

    // Latest Step 5 preview (visibility toggles may not be on the in-memory include)
    const latestPreview = await prisma.newClientEmployeePortalPreview.findUnique({
      where: { sessionId: wizardSession.id },
    });
    let previewDataForClient = (latestPreview?.previewData ??
      wizardSession.employeePortalPreview?.previewData) as any;

    const primaryCatsForCategoryAssets =
      await resolveUserPrimaryServiceCategoryLabels(session.user.id);
    const onboardingAdvisorBg = await getOnboardingAdvisorBackgroundImage(
      session.user.id,
    );
    if (
      onboardingAdvisorBg &&
      userPrimaryServicesMapToBenefitsCategory(primaryCatsForCategoryAssets)
    ) {
      const base =
        previewDataForClient &&
        typeof previewDataForClient === "object" &&
        !Array.isArray(previewDataForClient)
          ? { ...previewDataForClient }
          : {};
      if (!base.onboardingCategoryBackgroundImage) {
        base.onboardingCategoryBackgroundImage = onboardingAdvisorBg;
      }
      previewDataForClient = base;
    }

    // 3b.0 publish gate: Benefits Hub must show ≥1 category (same rule as Step 5 UI)
    const portalVisibilityForGate = getCategoryPortalVisibility(
      previewDataForClient?.categoryPortalVisibility ??
        previewDataForClient?.previewData?.categoryPortalVisibility,
    );
    if (areAllCategoriesHiddenInPortal(portalVisibilityForGate)) {
      return NextResponse.json(
        {
          error:
            "The Benefits Hub must show at least one benefit category before publishing. In Step 5, under Benefits, turn Visibility on for at least one category.",
          code: "NO_VISIBLE_PORTAL_CATEGORIES",
        },
        { status: 400 },
      );
    }

    // Mark wizard session as completed (only after publish gates pass)
    await prisma.newClientWizardSession.update({
      where: { id: wizardSession.id },
      data: {
        completed: true,
        currentStep: 5,
        updatedAt: new Date(),
      },
    });

    // Mark all other incomplete sessions as completed
    await prisma.newClientWizardSession.updateMany({
      where: {
        userId: session.user.id,
        completed: false,
        id: { not: wizardSession.id }
      },
      data: {
        completed: true,
        updatedAt: new Date(),
      }
    });

    // Create Client record from new wizard data structure
    // Check if we have the required data, either from the session or by querying directly
    let companyBasics = wizardSession.companyBasics;
    let welcomeStatement = wizardSession.welcomeStatement;
    let keyContacts = wizardSession.keyContacts;
    let complianceDocuments = wizardSession.complianceDocuments;

    // If any of the required data is missing, try to fetch it directly
    if (!companyBasics) {
      companyBasics = await prisma.newClientCompanyBasics.findFirst({
        where: { sessionId: wizardSession.id }
      });
    }

    if (!welcomeStatement) {
      welcomeStatement = await prisma.newClientWelcomeStatement.findFirst({
        where: { sessionId: wizardSession.id }
      });
    }

    if (!keyContacts) {
      keyContacts = await prisma.newClientKeyContacts.findFirst({
        where: { sessionId: wizardSession.id }
      });
    }

    if (!complianceDocuments) {
      complianceDocuments = await prisma.newClientComplianceDocuments.findFirst({
        where: { sessionId: wizardSession.id }
      });
    }

    const contactBuilder = await prisma.newClientContactBuilder.findUnique({
      where: { sessionId: wizardSession.id },
    });

    // Load disclaimers from employeePortalPreview.previewData
    let disclaimersData: any = null;
    if (wizardSession.employeePortalPreview?.previewData) {
      const previewData = wizardSession.employeePortalPreview.previewData as any;
      // Check if disclaimers exist in previewData
      if (previewData.disclaimers || previewData.disclosuresText !== undefined) {
        disclaimersData = {
          disclaimers: previewData.disclaimers || [],
          disclosuresText: previewData.disclosuresText,
          useDefaultDisclosures: previewData.useDefaultDisclosures,
        };
        console.log("=== Loading disclaimersData from previewData ===", disclaimersData);
      }
    }

    if (companyBasics && welcomeStatement && keyContacts) {
      try {
        const rawContacts = keyContacts.contacts;
        // Extract displayStyle from contacts JSON if it exists, or from stepData
        let displayStyle: number | null = null;
        if (typeof rawContacts === 'object' && rawContacts !== null && !Array.isArray(rawContacts) && 'displayStyle' in rawContacts) {
          displayStyle = (rawContacts as any).displayStyle ?? null;
        }
        // If not found in contacts, try to get from the contacts array structure
        const contactsArray = Array.isArray(rawContacts) ? rawContacts : (typeof rawContacts === 'object' && rawContacts !== null && 'contacts' in rawContacts ? (rawContacts as any).contacts : []);
        let normalizedContacts: any[] = [];

        if (Array.isArray(rawContacts)) {
          normalizedContacts = [...rawContacts];
        } else if (typeof rawContacts === "string") {
          try {
            const parsed = JSON.parse(rawContacts);
            if (Array.isArray(parsed)) {
              normalizedContacts = parsed;
            } else if (parsed && typeof parsed === 'object' && 'contacts' in parsed) {
              normalizedContacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
              displayStyle = parsed.displayStyle ?? displayStyle;
            }
          } catch (parseError) {
            console.warn("⚠️ Failed to parse key contacts JSON:", parseError);
          }
        } else if (rawContacts && typeof rawContacts === "object") {
          if ('contacts' in rawContacts && Array.isArray((rawContacts as any).contacts)) {
            normalizedContacts = [...(rawContacts as any).contacts];
            displayStyle = (rawContacts as any).displayStyle ?? displayStyle;
          } else {
            normalizedContacts = [rawContacts];
          }
        }

        if (contactBuilder) {
          const allowedRoles = ["advisor", "hr", "recordkeeper", "other"];
          const baseRole = contactBuilder.customRole ?? "";
          const role = allowedRoles.includes(baseRole) ? baseRole : "other";

          const customRoleLabel =
            contactBuilder.title ||
            (role === "other" ? contactBuilder.customRole || "Contact" : contactBuilder.customRole || "");

          let contactButtonType: "email" | "phone" | "calendar" | "url" | undefined;

          if (contactBuilder.meetingLink) {
            contactButtonType = "url";
          } else if (contactBuilder.enableContactButton && contactBuilder.email) {
            contactButtonType = "email";
          } else if (contactBuilder.enableContactButton && contactBuilder.phone) {
            contactButtonType = "phone";
          }

          const builderContact = {
            id: contactBuilder.id,
            name: contactBuilder.fullName,
            email: contactBuilder.email || "",
            phone: contactBuilder.phone || "",
            role,
            customRole: customRoleLabel,
            companyName: contactBuilder.companyName || "",
            headshot: contactBuilder.headshot || null,
            showOnPortal: contactBuilder.showOnPortal,
            enableContactButton: contactBuilder.enableContactButton,
            contactUrl: contactBuilder.meetingLink || "",
            bio: contactBuilder.description || "",
            isPrimary: contactBuilder.showOnPortal,
            displayEmail: Boolean(contactBuilder.email),
            displayPhone: Boolean(contactBuilder.phone),
            displayUrl: Boolean(contactBuilder.meetingLink),
            contactButton: contactBuilder.enableContactButton,
            contactButtonType,
          };


          const existingIndex = normalizedContacts.findIndex(
            (contact: any) => contact?.id === contactBuilder.id,
          );

          if (existingIndex >= 0) {
            normalizedContacts[existingIndex] = {
              ...normalizedContacts[existingIndex],
              ...builderContact,
            };
          } else {
            normalizedContacts.push(builderContact);
          }
        }

        // Get heroTitle and heroDescription from companyBasics
        // Check both direct fields and brandImages._meta
        const brandImagesMeta = (companyBasics.brandImages as any)?._meta || {};
        const heroTitle = (companyBasics as any)?.heroTitle || brandImagesMeta.heroTitle || welcomeStatement?.headline || null;
        const heroDescription = (companyBasics as any)?.heroDescription || brandImagesMeta.heroDescription || welcomeStatement?.bodyText || null;

        // Get missionHeadline and missionBody from companyBasics
        // Check both direct fields and brandImages._meta
        const missionHeadline =
          (companyBasics as any)?.missionHeadline ||
          brandImagesMeta.missionHeadline ||
          welcomeStatement?.headline ||
          null;
        const missionBody =
          (companyBasics as any)?.missionBody ||
          brandImagesMeta.missionBody ||
          welcomeStatement?.bodyText ||
          null;



        // Branding: when R2 configured, store only keys (base64 → null on create, then upload to R2 and update); else store as-is (legacy base64)
        const logoVal = companyBasics.companyLogo;
        const brandImgs = (companyBasics.brandImages as any) || {};
        const useR2Branding = isR2Configured();
        const companyLogoCreate = isR2Key(logoVal) ? logoVal : (useR2Branding && logoVal ? null : logoVal ?? null);
        const headerUrl = brandImgs?.header?.url ?? brandImgs?.thumbnail?.url;
        const thumbnailUrl = brandImgs?.thumbnail?.url;
        const backgroundImgCreate = isR2Key(headerUrl) ? headerUrl : (useR2Branding && headerUrl ? null : (headerUrl || null));
        const thumbnailImgCreate = isR2Key(thumbnailUrl) ? thumbnailUrl : (useR2Branding && thumbnailUrl ? null : (thumbnailUrl || null));
        const secondaryBannerImgCreate = isR2Key(brandImgs?.secondaryBanner?.url) ? brandImgs.secondaryBanner.url : (useR2Branding && brandImgs?.secondaryBanner?.url ? null : (brandImgs?.secondaryBanner?.url ?? null));
        const faviconImgCreate = isR2Key(brandImgs?.favicon?.url) ? brandImgs.favicon.url : (useR2Branding && brandImgs?.favicon?.url ? null : (brandImgs?.favicon?.url ?? null));

        const client = await (prisma.client as any).create({
          data: {
            companyName: companyBasics.companyName,
            companyWebsite: companyBasics.companyWebsite,
            companyLogo: companyLogoCreate,
            logoFileName: companyBasics.logoFileName,
            brandColor: companyBasics.primaryColor,
            secondaryColor: companyBasics.secondaryColor,
            missionHeadline: missionHeadline || null,
            missionBody: missionBody || null,
            heroTitle,
            heroDescription,
            ...((companyBasics as any).heroOverlayOpacity !== undefined && {
              heroOverlayOpacity: (companyBasics as any).heroOverlayOpacity,
            }),
            ...((companyBasics as any).heroBackgroundOpacity !== undefined && {
              heroBackgroundOpacity: (companyBasics as any).heroBackgroundOpacity,
            }),
            ...((companyBasics as any).heroContainerOpacity !== undefined && {
              heroContainerOpacity: (companyBasics as any).heroContainerOpacity,
            }),
            ...((companyBasics as any).heroContainerBackgroundOpacity !== undefined && {
              heroContainerBackgroundOpacity: (companyBasics as any).heroContainerBackgroundOpacity,
            }),
            ...((companyBasics as any).heroContainerBlockOpacity !== undefined && {
              heroContainerBlockOpacity: (companyBasics as any).heroContainerBlockOpacity,
            }),
            ...((companyBasics as any).heroCompanyNameColor !== undefined && {
              heroCompanyNameColor: (companyBasics as any).heroCompanyNameColor,
            }),
            ...((companyBasics as any).heroContainerInverted !== undefined && {
              heroContainerInverted: (companyBasics as any).heroContainerInverted,
            }),
            ...((companyBasics as any).heroBackgroundInverted !== undefined && {
              heroBackgroundInverted: (companyBasics as any).heroBackgroundInverted,
            }),
            // Backward compatibility: keep heroInverted if it exists
            ...((companyBasics as any).heroInverted !== undefined && {
              heroInverted: (companyBasics as any).heroInverted,
            }),
            ...((companyBasics as any).heroUseGradient !== undefined && {
              heroUseGradient: (companyBasics as any).heroUseGradient,
            }),
            keyContacts: {
              contacts: normalizedContacts,
              displayStyle: displayStyle,
              // Preserve style fields from rawContacts (cardBackgroundColor, logoScale, etc.)
              ...(typeof rawContacts === 'object' && rawContacts !== null && !Array.isArray(rawContacts) && {
                cardPrimaryColor: (rawContacts as any).cardPrimaryColor,
                cardSecondaryColor: (rawContacts as any).cardSecondaryColor,
                cardBackgroundColor: (rawContacts as any).cardBackgroundColor,
                logoScale: (rawContacts as any).logoScale,
              }),
            } as any,


            userId: session.user.id,
            status: "Active",
            type: "client",
            // Add recordkeeper from compliance documents if available
            recordkeeper: complianceDocuments?.recordkeeper || null,
            backgroundImg: backgroundImgCreate,
            backgroundImgName: brandImgs?.header?.fileName ?? brandImgs?.thumbnail?.fileName ?? null,
            thumbnailImg: thumbnailImgCreate,
            thumbnailImgName: brandImgs?.thumbnail?.fileName ?? null,
            secondaryBannerImg: secondaryBannerImgCreate,
            secondaryBannerImgName: brandImgs?.secondaryBanner?.fileName ?? null,
            faviconImg: faviconImgCreate,
            faviconImgName: brandImgs?.favicon?.fileName ?? null,
            // Save disclaimers data as JSON object (not stringified)
            disclaimers: disclaimersData ? (disclaimersData as any) : null,
            // Benefits + visibility from Step 5 (so portal shows only enabled benefit cards)
            ...(previewDataForClient && {
              employeePortalPreview: previewDataForClient,
            }),
            // Category Display (Portal Visibility) from Step 5 edit panel — hides categories/contacts in portal and My Benefits Team (always set so portal filter works)
            categoryPortalVisibility: getCategoryPortalVisibility(
              previewDataForClient?.categoryPortalVisibility ??
                previewDataForClient?.previewData?.categoryPortalVisibility
            ),
          },
        });

        console.log("=== Saved disclaimersData to client ===", {
          clientId: client.id,
          disclaimersData: disclaimersData,
        });

        // Upload base64 branding to R2 and update client with keys
        if (isR2Configured()) {
          const orgId = session.user.id;
          const planId = client.id;
          const brandingUpdate: Record<string, string | null> = {};
          const uploadSlot = async (
            dataUrl: string | null | undefined,
            slot: string,
            fileName: string
          ): Promise<string | null> => {
            if (!dataUrl || isR2Key(dataUrl)) return null;
            const parsed = base64DataUrlToBuffer(dataUrl);
            if (!parsed) return null;
            const key = buildBrandingKey({ orgId, planId, slot, fileName });
            const ok = await putObjectBuffer({
              key,
              body: parsed.buffer,
              contentType: parsed.contentType,
            });
            return ok ? key : null;
          };
          if (logoVal && !isR2Key(logoVal)) {
            const key = await uploadSlot(
              logoVal,
              "logo",
              companyBasics.logoFileName || "logo.png"
            );
            if (key) brandingUpdate.companyLogo = key;
          }
          const headerData = brandImgs?.header;
          const thumbnailData = brandImgs?.thumbnail;
          if ((headerData?.url || thumbnailData?.url) && !backgroundImgCreate) {
            const url = headerData?.url ?? thumbnailData?.url;
            const key = await uploadSlot(
              url,
              "header",
              headerData?.fileName || thumbnailData?.fileName || "header.jpg"
            );
            if (key) brandingUpdate.backgroundImg = key;
          }
          if (thumbnailData?.url && !thumbnailImgCreate) {
            const key = await uploadSlot(
              thumbnailData.url,
              "thumbnail",
              thumbnailData.fileName || "thumbnail.jpg"
            );
            if (key) brandingUpdate.thumbnailImg = key;
          }
          if (brandImgs?.secondaryBanner?.url && !secondaryBannerImgCreate) {
            const key = await uploadSlot(
              brandImgs.secondaryBanner.url,
              "secondaryBanner",
              brandImgs.secondaryBanner.fileName || "banner.jpg"
            );
            if (key) brandingUpdate.secondaryBannerImg = key;
          }
          if (brandImgs?.favicon?.url && !faviconImgCreate) {
            const key = await uploadSlot(
              brandImgs.favicon.url,
              "favicon",
              brandImgs.favicon.fileName || "favicon.ico"
            );
            if (key) brandingUpdate.faviconImg = key;
          }
          if (Object.keys(brandingUpdate).length > 0) {
            await (prisma.client as any).update({
              where: { id: client.id },
              data: brandingUpdate,
            });
          }
        }

        // Create Document records for uploaded files
        const documents = [];

        // Create SPD document if exists
        if (complianceDocuments?.spdFile) {
          const spdData = complianceDocuments.spdFile as any;
          const spdStorageKey = spdData?.storageKey;

          if (spdStorageKey && typeof spdStorageKey === "string" && spdStorageKey.trim() !== "") {
            const documentName = spdData?.name || "SPD (Summary Plan Description)";
            const originalFileName = spdData?.originalFileName || documentName;
            const spdDocument = await prisma.document.create({
              data: {
                title: documentName,
                fileName: originalFileName,
                fileUrl: "r2:stored",
                storageKey: spdStorageKey.trim(),
                shortDescription: spdData?.shortDescription || null,
                type: "SPD",
                category: resolvePersistedDocumentCategory("SPD", spdData?.category, spdStorageKey),
                clientId: client.id,
                uploadedAt: new Date(),
              } as any,
            });
            documents.push(spdDocument);
          } else {
            let fileUrl = spdData?.fileUrl || spdData?.file || "";
            if (fileUrl && fileUrl !== "r2:stored" && !fileUrl.startsWith('data:')) {
              fileUrl = `data:application/pdf;base64,${fileUrl}`;
            }
            const documentName = spdData?.name || "SPD (Summary Plan Description)";
            const originalFileName = spdData?.originalFileName || documentName;
            if (fileUrl && fileUrl.trim() !== "") {
              const spdDocument = await prisma.document.create({
                data: {
                  title: documentName,
                  fileName: originalFileName,
                  fileUrl,
                  shortDescription: spdData?.shortDescription || null,
                  type: "SPD",
                  category: resolvePersistedDocumentCategory("SPD", spdData?.category, spdData?.storageKey),
                  clientId: client.id,
                  uploadedAt: new Date(),
                } as any,
              });
              documents.push(spdDocument);
            }
          }
        }

        // Helper function to process documents array
        const processDocumentsArray = async (documentsArray: any[], documentType: string) => {
          for (let i = 0; i < documentsArray.length; i++) {
            const doc = documentsArray[i] as any;

            // Support both formats:
            // 1. Document format: { id, name, file, type, size, status, shortDescription, originalFileName }
            // 2. OptionalFiles format: { fileName, fileData, fileType, description }

            let fileUrl: string | null = null;
            let documentName: string = `Document ${i + 1}`;
            let originalFileName: string = `Document ${i + 1}`;
            let shortDescription: string | null = null;

            const docStorageKey = doc?.storageKey;
            const hasR2 = docStorageKey && typeof docStorageKey === "string" && docStorageKey.trim() !== "";

            if (hasR2) {
              documentName = doc.name || doc.fileName || `Document ${i + 1}`;
              originalFileName = doc.originalFileName || doc.fileName || documentName;
              shortDescription = doc.shortDescription ?? doc.description ?? null;
            }
            // Check if it's in Document format
            else if (doc && doc.file && doc.name && doc.file !== "r2:stored") {
              fileUrl = doc.file;
              if (fileUrl && !fileUrl.startsWith('data:')) {
                fileUrl = `data:application/pdf;base64,${fileUrl}`;
              }
              documentName = doc.name || `Document ${i + 1}`;
              originalFileName = doc.originalFileName || documentName;
              shortDescription = doc.shortDescription || null;
            }
            // Check if it's in OptionalFiles format
            else if (doc && doc.fileName && doc.fileData) {
              fileUrl = doc.fileData;
              if (fileUrl && !fileUrl.startsWith('data:')) {
                fileUrl = `data:application/pdf;base64,${fileUrl}`;
              }
              documentName = doc.fileName || `Document ${i + 1}`;
              originalFileName = doc.fileName;
              shortDescription = doc.description || null;
            }

            // Detect language from document (use stored language if available)
            const detectLanguage = (name: string, fileName: string, desc: string | null, storedLanguage?: string): string => {
              // Use stored language if available
              if (storedLanguage === "ES" || storedLanguage === "EN") {
                return storedLanguage;
              }

              const source = `${name} ${fileName} ${desc || ""}`.toLowerCase();

              // Check for explicit markers
              if (source.includes("[es]") || source.includes("(es)") || source.includes("español") || source.includes("espanol")) {
                return "ES";
              }
              if (source.includes("[en]") || source.includes("(en)") || source.includes("english")) {
                return "EN";
              }

              // Check for Spanish words
              const spanishWords = ["aquí", "puedes", "guía", "jubilación", "descripción", "información", "participante", "inscripción", "formulario", "folleto", "notificación", "solicitud"];
              const hasSpanishWords = spanishWords.some(word => source.includes(word));
              if (hasSpanishWords) {
                return "ES";
              }

              // Check for Spanish characters
              if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(source)) {
                return "ES";
              }

              // Default to English
              return "EN";
            };

            // Get language from doc.language if available (from optionalFiles)
            const storedLanguage = doc.language;
            const detectedLanguage = detectLanguage(documentName, originalFileName, shortDescription, storedLanguage);

            const expirationRaw = doc.expirationDate ?? doc.expiresAt;
            const expirationDate =
              expirationRaw != null && String(expirationRaw).trim() !== ""
                ? new Date(expirationRaw)
                : null;
            const validExpiration =
              expirationDate && !Number.isNaN(expirationDate.getTime())
                ? expirationDate
                : null;
            const categorySuggested =
              typeof doc.categorySuggested === "string" && doc.categorySuggested.trim()
                ? doc.categorySuggested.trim()
                : null;
            const categoryConfidence =
              typeof doc.categoryConfidence === "number" && Number.isFinite(doc.categoryConfidence)
                ? Math.round(doc.categoryConfidence)
                : null;

            if (hasR2 && documentName) {
              const createdDocument = await prisma.document.create({
                data: {
                  title: documentName,
                  fileName: originalFileName,
                  fileUrl: "r2:stored",
                  storageKey: docStorageKey.trim(),
                  shortDescription: shortDescription,
                  type: documentType,
                  category: resolvePersistedDocumentCategory(documentType, doc.category, docStorageKey),
                  categorySuggested,
                  categoryConfidence,
                  expirationDate: validExpiration,
                  language: detectedLanguage,
                  clientId: client.id,
                  uploadedAt: new Date(),
                } as any,
              });
              documents.push(createdDocument);
            } else if (fileUrl && fileUrl !== "r2:stored" && documentName) {
              const createdDocument = await prisma.document.create({
                data: {
                  title: documentName,
                  fileName: originalFileName,
                  fileUrl: fileUrl,
                  shortDescription: shortDescription,
                  type: documentType,
                  category: resolvePersistedDocumentCategory(documentType, doc.category, docStorageKey),
                  categorySuggested,
                  categoryConfidence,
                  expirationDate: validExpiration,
                  language: detectedLanguage,
                  clientId: client.id,
                  uploadedAt: new Date(),
                } as any,
              });
              documents.push(createdDocument);
            } else if (!hasR2 && (!fileUrl || fileUrl === "r2:stored") && documentName) {
              console.warn("Skipping document creation - missing data:", {
                hasFileUrl: !!fileUrl,
                hasDocumentName: !!documentName,
              });
            }
          }
        };

        // Create retirement plan documents if exist
        const complianceDocs = complianceDocuments as any;


        if (complianceDocs?.retirementPlanDocuments && Array.isArray(complianceDocs.retirementPlanDocuments)) {
          await processDocumentsArray(complianceDocs.retirementPlanDocuments, "Document");
        } else {
        }

        // Create other documents if exist
        if (complianceDocuments?.otherDocuments && Array.isArray(complianceDocuments.otherDocuments)) {
          await processDocumentsArray(complianceDocuments.otherDocuments, "SBC");
        }

        // If a draft plan exists, copy any documents that were saved directly to
        // the draft Client row but were not present in the wizard JSON. This
        // protects the publish path from losing Step 4 uploads after draft saves.
        if (draftClientId) {
          const draftDocuments = await prisma.document.findMany({
            where: { clientId: draftClientId },
          });
          const copiedKeys = new Set(
            documents.map((doc: any) => {
              const key = (doc as any).storageKey || "";
              return key
                ? `storage:${key}`
                : `file:${doc.fileName || ""}:${doc.title || ""}:${doc.type || ""}`;
            }),
          );

          for (const draftDoc of draftDocuments) {
            if ((draftDoc as any).archivedAt) continue;
            const dedupeKey = (draftDoc as any).storageKey
              ? `storage:${(draftDoc as any).storageKey}`
              : `file:${draftDoc.fileName || ""}:${draftDoc.title || ""}:${draftDoc.type || ""}`;
            if (copiedKeys.has(dedupeKey)) continue;

            const copiedDocument = await prisma.document.create({
              data: {
                title: draftDoc.title,
                fileName: draftDoc.fileName,
                fileUrl: draftDoc.fileUrl,
                storageKey: (draftDoc as any).storageKey || null,
                shortDescription: (draftDoc as any).shortDescription || null,
                type: draftDoc.type || "Document",
                category: resolvePersistedDocumentCategory(
                  draftDoc.type,
                  (draftDoc as any).category,
                  (draftDoc as any).storageKey,
                ),
                categorySuggested: (draftDoc as any).categorySuggested || null,
                categoryConfidence: (draftDoc as any).categoryConfidence || null,
                language: draftDoc.language || "EN",
                expirationDate: draftDoc.expirationDate || null,
                showQrCode: (draftDoc as any).showQrCode ?? true,
                clientId: client.id,
                uploadedAt: draftDoc.uploadedAt || new Date(),
              } as any,
            });
            documents.push(copiedDocument);
            copiedKeys.add(dedupeKey);
          }
        }

        // Clean up the wizard session and related data after successful client creation
        // If draftClientId is provided, delete only that specific draft client
        // Otherwise, find and delete the draft client that matches the current company name
        if (draftClientId) {
          // Delete only the specific draft client that was loaded

          // Delete all Documents associated with this draft client first
          await prisma.document.deleteMany({
            where: {
              clientId: draftClientId,
            },
          });

          // Now delete the specific Draft Client
          await prisma.client.delete({
            where: {
              id: draftClientId,
            },
          });
        } else {
          // Fallback: Find and delete draft client by company name (for backward compatibility)
          const companyName = companyBasics?.companyName;
          if (companyName) {
            const draftClient = await prisma.client.findFirst({
              where: {
                userId: session.user.id,
                status: "Draft",
                companyName: companyName,
              },
              select: { id: true },
            });

            if (draftClient) {

              // Delete all Documents associated with this draft client first
              await prisma.document.deleteMany({
                where: {
                  clientId: draftClient.id,
                },
              });

              // Now delete the Draft Client
              await prisma.client.delete({
                where: {
                  id: draftClient.id,
                },
              });
            }
          }
        }

        // Delete related records to avoid foreign key constraint violations
        await prisma.newClientCompanyBasics.deleteMany({
          where: { sessionId: wizardSession.id }
        });
        await prisma.newClientWelcomeStatement.deleteMany({
          where: { sessionId: wizardSession.id }
        });
        await prisma.newClientKeyContacts.deleteMany({
          where: { sessionId: wizardSession.id }
        });
        await prisma.newClientComplianceDocuments.deleteMany({
          where: { sessionId: wizardSession.id }
        });
        await prisma.newClientEmployeePortalPreview.deleteMany({
          where: { sessionId: wizardSession.id }
        });
        await prisma.newClientContactBuilder.deleteMany({
          where: { sessionId: wizardSession.id }
        });

        // Now delete the wizard session
        await prisma.newClientWizardSession.delete({
          where: { id: wizardSession.id }
        });

        return NextResponse.json({
          success: true,
          message: "New client wizard completed successfully",
          clientId: client.id,
          documentsCount: documents.length
        });

      } catch (clientError) {
        console.error("❌ Error creating client:", clientError);
        return NextResponse.json({
          error: "Failed to create client",
          details: clientError instanceof Error ? clientError.message : "Unknown error"
        }, { status: 500 });
      }
    } else {
      const missingData = [];
      if (!companyBasics) missingData.push("company basics");
      if (!welcomeStatement) missingData.push("welcome statement");
      if (!keyContacts) missingData.push("key contacts");

      return NextResponse.json({
        error: "Missing required wizard data",
        details: `Missing required data: ${missingData.join(", ")}. Please complete all required steps before finishing the wizard.`
      }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
