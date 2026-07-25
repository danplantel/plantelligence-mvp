import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ObjectId } from "mongodb";
import {
  processBase64Image,
  processBase64ImageWithCrop,
  isBase64Image,
  type CropMetadata,
} from "@/lib/image-processing";
import {
  getCategoryPortalVisibility,
  filterContactsByPortalVisibility,
  syncBenefitsWithCategoryVisibility,
} from "@/lib/portal-category-visibility";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { normalizeClientBrandingKeysForResponse } from "@/lib/branding-image-url";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let clientId = params.id;
    const forPortal = request.nextUrl.searchParams.get("forPortal") === "1";

    // Dual lookup: try ObjectId first, then slug
    const isObjectId = ObjectId.isValid(clientId);
    let client = null;

    if (isObjectId) {
      client = await prisma.client.findUnique({
        where: { id: clientId },
      });
    }

    if (!client) {
      if (forPortal) {
        client = await prisma.client.findFirst({
          where: { slug: clientId },
        });
      } else {
        client = await prisma.client.findFirst({
          where: { slug: clientId, userId: session.user.id },
        });
      }
    }

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check if user owns this client (skip for portal requests)
    if (!forPortal && client.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // After resolving by slug, use the actual MongoDB ObjectId for all subsequent
    // DB queries (Prisma requires valid ObjectIds for relation fields like clientId)
    clientId = client.id;

    // Portal requests must exclude soft-archived docs (`archivedAt` set). Do not use
    // `where: { archivedAt: null }` in Prisma MongoDB: it omits rows where the field is
    // missing on the BSON document (common for older rows), so `forPortal=1` returned [] while
    // the advisor GET (no filter) showed all documents. Filter active docs in JS instead.
    const documentsRaw = await (prisma.document.findMany as any)({
      where: {
        clientId: clientId,
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        fileUrl: true,
        storageKey: true,
        type: true,
        shortDescription: true,
        language: true,
        category: true,
        uploadedAt: true,
        expirationDate: true,
        showQrCode: true,
        archivedAt: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
    });

    const documents = forPortal
      ? documentsRaw.filter(
          (d: { archivedAt: Date | null }) => d.archivedAt == null,
        )
      : documentsRaw;

    // Required for portal / My Benefits Team: normalize visibility; fallback to employeePortalPreview if top-level missing (e.g. old client or saved only in previewData)
    const rawVisibility =
      (client as any).categoryPortalVisibility ??
      (typeof (client as any).employeePortalPreview === "object" &&
        (client as any).employeePortalPreview?.categoryPortalVisibility);
    const categoryPortalVisibility = getCategoryPortalVisibility(rawVisibility);

    // For portal/My Benefits Team: return only contacts in visible categories (hidden cards are not sent from server)
    let keyContactsToReturn: any = (client as any).keyContacts;
    if (forPortal && keyContactsToReturn != null) {
      const rawContacts = Array.isArray(keyContactsToReturn)
        ? keyContactsToReturn
        : (keyContactsToReturn as any).contacts ?? (keyContactsToReturn as any).Contacts;
      const contactsArray = Array.isArray(rawContacts) ? rawContacts : [];
      const byVisibility = filterContactsByPortalVisibility(
        contactsArray as Record<string, unknown>[],
        categoryPortalVisibility
      );
      const filtered = byVisibility.filter(
        (c: any) => c?.showOnPortal !== false
      );
      keyContactsToReturn = Array.isArray(keyContactsToReturn)
        ? filtered
        : { ...(keyContactsToReturn as object), contacts: filtered };
    }

    const dataPayload = normalizeClientBrandingKeysForResponse(
      {
        ...client,
        documents,
        categoryPortalVisibility, // always set so portal filter works
        keyContacts: keyContactsToReturn,
      },
      session.user.id,
      clientId,
    );

    // Generate presigned URLs for plan videos so portal viewers (employees) can play them
    if (forPortal && isR2Configured()) {
      // Helper: extract raw R2 key from old /api/r2/object?key=... URLs or use as-is
      const extractKey = (v: string): string | null => {
        if (!v || v.startsWith("http")) return null; // already a presigned URL
        try {
          const u = new URL(v, "http://localhost");
          const k = u.searchParams.get("key");
          if (k) return k;
        } catch { /* not a URL, treat as raw key */ }
        return v;
      };

      const ep = (dataPayload as any).employeePortalPreview;
      if (ep?.benefits && Array.isArray(ep.benefits)) {
        console.log("[planVideo] benefits count:", ep.benefits.length);
        const benefitsWithUrls = await Promise.all(
          ep.benefits.map(async (b: any) => {
            console.log("[planVideo] category=" + b.category + " hasPlanVideo=" + !!b.planVideo + " planVideo=" + b.planVideo);
            const rawKey = b.planVideo ? extractKey(String(b.planVideo)) : null;
            console.log("[planVideo] rawKey=" + rawKey);
            if (rawKey) {
              try {
                const url = await getPresignedReadUrl({ key: rawKey });
                console.log("[planVideo] presigned=" + (url ? "YES" : "NO"));
                if (url) return { ...b, planVideo: url };
              } catch (e) { console.error("[planVideo] presigned error:", e); }
            }
            return b;
          })
        );
        (dataPayload as any).employeePortalPreview = { ...ep, benefits: benefitsWithUrls };
      }
    }

    return NextResponse.json({
      success: true,
      data: dataPayload,
    });
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let clientId = params.id;
    const body = await request.json();

    // Dual lookup: try ObjectId first, then slug
    const isObjectId = ObjectId.isValid(clientId);
    let existingClient = null;

    if (isObjectId) {
      existingClient = await prisma.client.findUnique({
        where: { id: clientId },
      });
    }

    if (!existingClient) {
      existingClient = await prisma.client.findFirst({
        where: { slug: clientId, userId: session.user.id },
      });
    }

    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 },
      );
    }

    if (existingClient.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // After resolving by slug, use the actual MongoDB ObjectId for all subsequent DB queries
    clientId = existingClient.id;

    // Extract data from payload
    const {
      companyName,
      companyWebsite,
      companyLogo,
      logoFileName,
      primaryColor,
      brandColor,
      secondaryColor,
      missionHeadline,
      missionBody,
      appointmentLink,
      keyContacts,
      documentsData,
      provideSpanishVersions,
      disclaimers,
      disclaimersData, // Support DisclaimersData object (with disclaimers, disclosuresText, useDefaultDisclosures)
      status,
      brandImages,
      heroTitle,
      heroDescription,
      heroOverlayOpacity,
      heroBackgroundOpacity,
      heroContainerOpacity,
      heroContainerBackgroundOpacity,
      heroContainerBlockOpacity,
      heroCompanyNameColor,
      heroContainerInverted,
      heroBackgroundInverted,
      heroUseGradient,
      desktopHeroBackgroundPosition,
      mobileHeroBackgroundPosition,
      employeePortalPreview,
      categoryPortalVisibility,
    } = body;

    // Extract logo URL if it's an object
    let logoUrl =
      typeof companyLogo === "object" && companyLogo?.url
        ? companyLogo.url
        : companyLogo;

    const logoCropData =
      typeof companyLogo === "object" && companyLogo?.cropData
        ? (companyLogo.cropData as CropMetadata)
        : undefined;

    if (logoUrl && isBase64Image(logoUrl)) {
      try {
        if (logoCropData && logoCropData.cropped) {
          const imageToProcess = logoCropData.originalImage || logoUrl;
          logoUrl = await processBase64ImageWithCrop(imageToProcess, logoCropData);
        }
      } catch (error) {
        console.warn("Failed to crop company logo, using original:", error);
      }
    }

    // Extract brand images from brandImages object
    let backgroundImg =
      (brandImages as any)?.header?.url || (brandImages as any)?.thumbnail?.url || existingClient.backgroundImg;
    let backgroundImgName =
      (brandImages as any)?.header?.fileName ||
      existingClient.backgroundImgName;
    let thumbnailImg =
      (brandImages as any)?.thumbnail?.url || existingClient.thumbnailImg;
    let thumbnailImgName =
      (brandImages as any)?.thumbnail?.fileName ||
      existingClient.thumbnailImgName;
    let secondaryBannerImg =
      (brandImages as any)?.secondaryBanner?.url ||
      existingClient.secondaryBannerImg;
    let secondaryBannerImgName =
      (brandImages as any)?.secondaryBanner?.fileName ||
      existingClient.secondaryBannerImgName;
    let faviconImg =
      (brandImages as any)?.favicon?.url || existingClient.faviconImg;
    let faviconImgName =
      (brandImages as any)?.favicon?.fileName || existingClient.faviconImgName;

    if (brandImages && typeof brandImages === 'object') {
      const headerCropData = (brandImages as any)?.header?.cropData as CropMetadata | undefined;
      const thumbnailCropData = (brandImages as any)?.thumbnail?.cropData as CropMetadata | undefined;
      const secondaryBannerCropData = (brandImages as any)?.secondaryBanner?.cropData as CropMetadata | undefined;
      const faviconCropData = (brandImages as any)?.favicon?.cropData as CropMetadata | undefined;

      if (backgroundImg && isBase64Image(backgroundImg)) {
        try {
          if (headerCropData && headerCropData.cropped) {
            const imageToProcess = headerCropData.originalImage || backgroundImg;
            backgroundImg = await processBase64ImageWithCrop(imageToProcess, headerCropData);
          }
        } catch (error) {
          console.warn("Failed to crop background image, using original:", error);
        }
      }
      if (thumbnailImg && isBase64Image(thumbnailImg)) {
        try {
          if (thumbnailCropData && thumbnailCropData.cropped) {
            const imageToProcess = thumbnailCropData.originalImage || thumbnailImg;
            thumbnailImg = await processBase64ImageWithCrop(imageToProcess, thumbnailCropData);
          }
        } catch (error) {
          console.warn("Failed to crop thumbnail image, using original:", error);
        }
      }
      if (secondaryBannerImg && isBase64Image(secondaryBannerImg)) {
        try {
          if (secondaryBannerCropData && secondaryBannerCropData.cropped) {
            const imageToProcess = secondaryBannerCropData.originalImage || secondaryBannerImg;
            secondaryBannerImg = await processBase64ImageWithCrop(imageToProcess, secondaryBannerCropData);
          }
        } catch (error) {
          console.warn("Failed to crop secondary banner image, using original:", error);
        }
      }
      if (faviconImg && isBase64Image(faviconImg)) {
        try {
          if (faviconCropData && faviconCropData.cropped) {
            const imageToProcess = faviconCropData.originalImage || faviconImg;
            faviconImg = await processBase64ImageWithCrop(imageToProcess, faviconCropData);
          }
        } catch (error) {
          console.warn("Failed to crop favicon image, using original:", error);
        }
      }
    }

    // Preserve existing brandImages._meta if brandImages is provided
    let brandImagesToSave = brandImages;
    if (brandImages && (existingClient as any).brandImages) {
      // Merge _meta from existing brandImages if it exists
      const existingBrandImages = (existingClient as any).brandImages;
      if (existingBrandImages._meta) {
        brandImagesToSave = {
          ...brandImages,
          _meta: {
            ...existingBrandImages._meta,
            ...(brandImages as any)._meta,
          },
        };
      }
    }

    // Prepare update data
    const updateData: any = {
      companyName: companyName || existingClient.companyName,
      companyWebsite: companyWebsite ?? existingClient.companyWebsite,
      companyLogo: logoUrl ?? existingClient.companyLogo,
      logoFileName: logoFileName ?? existingClient.logoFileName,
      brandColor: brandColor || primaryColor || existingClient.brandColor,
      secondaryColor: secondaryColor || existingClient.secondaryColor,
      missionHeadline: missionHeadline ?? existingClient.missionHeadline,
      missionBody: missionBody ?? existingClient.missionBody,
      appointmentLink: appointmentLink ?? existingClient.appointmentLink,
      heroTitle: heroTitle !== undefined ? heroTitle : (existingClient as any).heroTitle,
      heroDescription: heroDescription !== undefined ? heroDescription : (existingClient as any).heroDescription,
      heroOverlayOpacity: heroOverlayOpacity !== undefined ? heroOverlayOpacity : (existingClient as any).heroOverlayOpacity,
      heroBackgroundOpacity: heroBackgroundOpacity !== undefined ? heroBackgroundOpacity : (existingClient as any).heroBackgroundOpacity,
      heroContainerOpacity: heroContainerOpacity !== undefined ? heroContainerOpacity : (existingClient as any).heroContainerOpacity,
      heroContainerBackgroundOpacity: (body as any).heroContainerBackgroundOpacity !== undefined ? (body as any).heroContainerBackgroundOpacity : (existingClient as any)?.heroContainerBackgroundOpacity ?? (existingClient as any)?.heroContainerOpacity,
      heroContainerBlockOpacity: (body as any).heroContainerBlockOpacity !== undefined ? (body as any).heroContainerBlockOpacity : (existingClient as any)?.heroContainerBlockOpacity ?? (existingClient as any)?.heroContainerOpacity,
      heroCompanyNameColor: heroCompanyNameColor !== undefined ? heroCompanyNameColor : (existingClient as any).heroCompanyNameColor,
      heroContainerInverted: heroContainerInverted !== undefined ? heroContainerInverted : (existingClient as any)?.heroContainerInverted ?? false,
      heroBackgroundInverted: heroBackgroundInverted !== undefined ? heroBackgroundInverted : (existingClient as any)?.heroBackgroundInverted ?? false,
      // heroInverted: heroInverted !== undefined ? heroInverted : (existingClient as any).heroInverted, // Removed: missing from schema
      heroUseGradient: heroUseGradient !== undefined ? heroUseGradient : (existingClient as any).heroUseGradient,
      desktopHeroBackgroundPosition: (body as any).desktopHeroBackgroundPosition !== undefined ? (body as any).desktopHeroBackgroundPosition : (existingClient as any)?.desktopHeroBackgroundPosition,
      mobileHeroBackgroundPosition: (body as any).mobileHeroBackgroundPosition !== undefined ? (body as any).mobileHeroBackgroundPosition : (existingClient as any)?.mobileHeroBackgroundPosition,
      keyContacts: keyContacts
        ? (keyContacts as any)
        : existingClient.keyContacts,
      // Save employeePortalPreview (benefits data). When Edit Panel restores a category,
      // sync benefits so isEnabled=true for that category — otherwise they stay hidden.
      employeePortalPreview: (() => {
        const basePreview = employeePortalPreview
          ? (employeePortalPreview as any)
          : (existingClient as any).employeePortalPreview;
        if ((body as any).categoryPortalVisibility !== undefined && basePreview?.benefits) {
          const visibility = getCategoryPortalVisibility((body as any).categoryPortalVisibility);
          return {
            ...basePreview,
            benefits: syncBenefitsWithCategoryVisibility(basePreview.benefits, visibility),
          };
        }
        return basePreview;
      })(),
      // Category Display (Show/Hide): always persist when sent by Edit Client so Hide state is not lost
      categoryPortalVisibility:
        (body as any).categoryPortalVisibility !== undefined
          ? getCategoryPortalVisibility((body as any).categoryPortalVisibility)
          : (existingClient as any).categoryPortalVisibility,
      // Handle disclaimers: support both old format (string) and new DisclaimersData format (JSON object)
      disclaimers: (() => {
        // If disclaimersData is provided (new format), save as JSON object
        if (disclaimersData) {
          console.log("=== Saving disclaimersData to client ===", {
            clientId,
            disclaimersData,
          });
          return disclaimersData as any;
        }
        // If disclaimers is provided, try to parse if it's a string, otherwise use as is
        if (disclaimers !== undefined) {
          // If it's a string, try to parse it as JSON
          if (typeof disclaimers === "string") {
            try {
              const parsed = JSON.parse(disclaimers);
              console.log("=== Parsed and saving disclaimers (from string) to client ===", {
                clientId,
                parsed,
              });
              return parsed;
            } catch (e) {
              // If parsing fails, it's probably old format - keep as string for backward compatibility
              console.log("=== Saving disclaimers (string, old format) to client ===", {
                clientId,
                disclaimers,
              });
              return disclaimers;
            }
          } else {
            // Already an object
            console.log("=== Saving disclaimers (object) to client ===", {
              clientId,
              disclaimers,
            });
            return disclaimers as any;
          }
        }
        // Otherwise, keep existing
        return existingClient.disclaimers;
      })(),
      status: status || existingClient.status,
      backgroundImg,
      backgroundImgName,
      thumbnailImg,
      thumbnailImgName,
      secondaryBannerImg,
      secondaryBannerImgName,
      faviconImg,
      faviconImgName,
    };

    // Add brandImages if provided (will work after Prisma generate)
    // TEMPORARILY DISABLED: Uncomment after running: npx prisma generate
    // if (brandImagesToSave !== undefined) {
    //   updateData.brandImages = brandImagesToSave;
    // }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
    });

    // Handle documents if provided
    if (documentsData) {
      try {
        // Collect existing documents for restoration before any potential deletions
        const existingDocsMap = new Map<string, string>();
        const storageKeyById = new Map<string, string>();
        const allDbDocs = await prisma.document.findMany({
          where: { clientId },
          select: { id: true, fileUrl: true, storageKey: true },
        });
        allDbDocs.forEach((d) => {
          existingDocsMap.set(d.id, d.fileUrl || "");
          const sk = d.storageKey && String(d.storageKey).trim();
          if (sk) storageKeyById.set(d.id, sk);
        });

        // Create new documents
        const documentsToCreate = [];
        const documentsToUpdate: Array<{ id: string; data: any }> = [];

        // Add SPD document if exists
        if (documentsData.spdFile && documentsData.spdFile.fileName) {
          // Only create if file is base64, not a URL
          if (documentsData.spdFile.file && !documentsData.spdFile.file.startsWith('/api/')) {
            documentsToCreate.push({
              clientId,
              title: "Summary Plan Description (SPD)",
              fileName: documentsData.spdFile.fileName,
              fileUrl: documentsData.spdFile.file,
              type: "SPD",
              category: "Retirement",
            });
          }
        }

        // Add other documents if exists
        if (documentsData.otherDocuments && Array.isArray(documentsData.otherDocuments)) {
          for (const doc of documentsData.otherDocuments) {
            // Only create if file is base64
            if (doc.file && doc.fileName && !doc.file.startsWith('/api/')) {
              documentsToCreate.push({
                clientId,
                title: doc.title || doc.fileName || "Document",
                fileName: doc.fileName,
                fileUrl: doc.file,
                type: doc.type || "Document",
                category: resolvePersistedDocumentCategory(
                  doc.type || "Document",
                  doc.category,
                ),
              });
            } else if (doc.file && doc.file.startsWith('/api/documents/')) {
              // Preserve existing document by restoring its URL
              const match = doc.file.match(/\/api\/documents\/([^\/?]+)/);
              const docId = match ? match[1] : doc.id;
              const fileUrl = existingDocsMap.get(docId);
              if (fileUrl) {
                documentsToCreate.push({
                  clientId,
                  title: doc.title || doc.fileName || "Document",
                  fileName: doc.fileName,
                  fileUrl: fileUrl,
                  type: doc.type || "Document",
                  category: resolvePersistedDocumentCategory(
                    doc.type || "Document",
                    doc.category,
                  ),
                } as any);
              }
            }
          }
        }

        // Add SBC document if exists
        if (documentsData.sbcFile && documentsData.sbcFile.fileName) {
          if (documentsData.sbcFile.file && !documentsData.sbcFile.file.startsWith('/api/')) {
            documentsToCreate.push({
              clientId,
              title: "Summary of Benefits and Coverage (SBC)",
              fileName: documentsData.sbcFile.fileName,
              fileUrl: documentsData.sbcFile.file,
              type: "SBC",
              category: "Group Health",
            });
          } else if (documentsData.sbcFile.file && documentsData.sbcFile.file.startsWith('/api/')) {
            const match = documentsData.sbcFile.file.match(/\/api\/documents\/([^\/?]+)/);
            const docId = match ? match[1] : null;
            const fileUrl = docId ? existingDocsMap.get(docId) : null;
            if (fileUrl) {
              documentsToCreate.push({
                clientId,
                title: "Summary of Benefits and Coverage (SBC)",
                fileName: documentsData.sbcFile.fileName,
                fileUrl: fileUrl,
                type: "SBC",
                category: "Group Health",
              });
            }
          }
        }

        // Delete all existing Document type documents first
        // We'll recreate all from retirementPlanDocuments
        await prisma.document.deleteMany({
          where: {
            clientId,
            type: "Document",
          },
        });

        // Helper function to detect language (same as in complete-v2)
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

        // Process retirement plan documents - same logic as in complete-v2
        if (documentsData.retirementPlanDocuments && Array.isArray(documentsData.retirementPlanDocuments)) {
          for (let i = 0; i < documentsData.retirementPlanDocuments.length; i++) {
            const doc = documentsData.retirementPlanDocuments[i] as any;

            // Support both formats (same as in complete-v2):
            // 1. Document format: { id, name, file, type, size, status, shortDescription, originalFileName, language }
            // 2. OptionalFiles format: { fileName, fileData, fileType, description, language }

            let fileUrl: string | null = null;
            let documentName: string = `Document ${i + 1}`;
            let originalFileName: string = `Document ${i + 1}`;
            let shortDescription: string | null = null;
            let storedLanguage: string | undefined = undefined;

            // R2-stored document (from benefits wizard or edit flow)
            const rawKeyIn =
              doc.storageKey && typeof doc.storageKey === "string"
                ? doc.storageKey.trim()
                : "";
            // Keys are normally org/...; accept any non-trivial string path to avoid losing uploads
            const looksLikeObjectKey = (k: string) =>
              k.startsWith("org/") || (k.includes("/") && k.length > 8);
            let docStorageKey = looksLikeObjectKey(rawKeyIn) ? rawKeyIn : null;
            if (
              !docStorageKey &&
              doc.id &&
              /^[0-9a-fA-F]{24}$/.test(String(doc.id).trim())
            ) {
              const fromDb = storageKeyById.get(String(doc.id));
              if (fromDb && String(fromDb).trim() && looksLikeObjectKey(String(fromDb).trim())) {
                docStorageKey = String(fromDb).trim();
              }
            }
            if (doc && docStorageKey) {
              documentName =
                doc.name ||
                doc.originalFileName ||
                doc.fileName ||
                doc.title ||
                `Document ${i + 1}`;
              originalFileName =
                doc.originalFileName ||
                doc.name ||
                doc.fileName ||
                documentName;
              shortDescription = doc.shortDescription || null;
              storedLanguage = doc.language;

              await prisma.document.create({
                data: {
                  title: documentName,
                  fileName: originalFileName,
                  fileUrl: "r2:stored",
                  storageKey: docStorageKey,
                  shortDescription: shortDescription,
                  type: "Document",
                  category: resolvePersistedDocumentCategory(
                    "Document",
                    doc.category,
                  ),
                  language: detectLanguage(documentName, originalFileName, shortDescription, storedLanguage),
                  clientId: clientId,
                  uploadedAt: new Date(),
                },
              });
              continue;
            }

            // Check if it's in Document format
            if (doc && doc.file && (doc.name || doc.originalFileName)) {
              // Document format
              const isApiUrl = typeof doc.file === 'string' && doc.file.startsWith('/api/documents/');
              // Skip R2 placeholder so we don't treat it as inline data
              const isR2Placeholder = doc.file === "r2:stored";
              if (isR2Placeholder) {
                continue;
              }

              if (isApiUrl) {
                // Get fileUrl from existing document before deletion
                const match = doc.file.match(/\/api\/documents\/([^\/?]+)/);
                if (match) {
                  const docId = match[1];
                  fileUrl = existingDocsMap.get(docId) || null;
                }
                if (!fileUrl && doc.id && /^[0-9a-fA-F]{24}$/.test(doc.id)) {
                  fileUrl = existingDocsMap.get(doc.id) || null;
                }
                if (!fileUrl) {
                  continue;
                }
              } else {
                fileUrl = doc.file;
                if (fileUrl && !fileUrl.startsWith('data:') && !fileUrl.startsWith('http') && !fileUrl.startsWith('/api/')) {
                  fileUrl = `data:application/pdf;base64,${fileUrl}`;
                }
              }

              documentName = doc.name || doc.originalFileName || `Document ${i + 1}`;
              originalFileName = doc.originalFileName || doc.name || documentName;
              shortDescription = doc.shortDescription || null;
              storedLanguage = doc.language;
            }
            // Check if it's in OptionalFiles format
            else if (doc && doc.fileName && doc.fileData) {
              // OptionalFiles format
              fileUrl = doc.fileData;
              if (fileUrl && !fileUrl.startsWith('data:')) {
                // If it's just base64 data, add data URL prefix
                fileUrl = `data:application/pdf;base64,${fileUrl}`;
              }
              documentName = doc.fileName || `Document ${i + 1}`;
              originalFileName = doc.fileName;
              shortDescription = doc.description || null;
              storedLanguage = doc.language;
            }

            // Skip if no file or no name
            if (!fileUrl || !documentName) {
              continue;
            }

            // Detect language
            const detectedLanguage = detectLanguage(documentName, originalFileName, shortDescription, storedLanguage);

            // Create document
            await prisma.document.create({
              data: {
                title: documentName,
                fileName: originalFileName,
                fileUrl: fileUrl,
                shortDescription: shortDescription,
                type: "Document",
                category: resolvePersistedDocumentCategory(
                  "Document",
                  doc.category,
                ),
                language: detectedLanguage,
                clientId: clientId,
                uploadedAt: new Date(),
              },
            });
          }
        }
      } catch (docError) {
        console.error("Error handling documents:", docError);
        // Don't fail the entire update if documents fail
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedClient,
      message: "Client updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating client:", error);

    // Log detailed Prisma error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // Check for Prisma-specific error properties
    const prismaError = error as any;
    if (prismaError.code) console.error("Prisma error code:", prismaError.code);
    if (prismaError.meta) console.error("Prisma error meta:", JSON.stringify(prismaError.meta, null, 2));

    return NextResponse.json(
      {
        error: "Failed to update client",
        details: error?.message || "Unknown error",
        code: (error as any)?.code,
      },
      { status: 500 },
    );
  }
}

/** Retry a Prisma operation up to `maxRetries` times when it fails with a write conflict (P2034). */
async function withRetry(
  fn: () => Promise<unknown>,
  maxRetries = 3,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      return;
    } catch (error: any) {
      lastError = error;
      if (error?.code !== "P2034" || attempt === maxRetries) throw error;
      // Exponential back-off: 200ms, 400ms, 800ms ...
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let clientId = params.id;

    // Dual lookup: try ObjectId first, then slug
    const isObjectId = ObjectId.isValid(clientId);
    let client = null;

    if (isObjectId) {
      client = await prisma.client.findUnique({
        where: { id: clientId },
      });
    }

    if (!client) {
      client = await prisma.client.findFirst({
        where: { slug: clientId, userId: session.user.id },
      });
    }

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 },
      );
    }

    if (client.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // After resolving by slug, use the actual MongoDB ObjectId for all subsequent DB queries
    clientId = client.id;

    // Get client name before deletion for meeting cleanup
    const clientName = client.companyName;

    // Find the associated wizard session so we can clean up sub-records
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: { userId: session.user.id, completed: false },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    // Delete webinars outside the transaction (raw command + MongoDB transactions can conflict)
    await prisma.$runCommandRaw({
      delete: "Webinar",
      deletes: [
        {
          q: {
            clientId: new ObjectId(clientId),
            userId: new ObjectId(session.user.id),
          },
          limit: 0,
        },
      ],
    });

    // Delete related records individually (avoids MongoDB multi-document transaction write conflicts)
    const deleteOps = [
      () => prisma.document.deleteMany({ where: { clientId } }),
      () => prisma.meeting.deleteMany({
        where: {
          userId: session.user.id,
          OR: [{ clientId }, { client: clientName, clientId: null }],
        },
      }),
      () => prisma.marketingAsset.deleteMany({ where: { clientId } }),
      () => prisma.marketingFlyer.deleteMany({ where: { clientId } }),
      () => prisma.video.deleteMany({ where: { clientId } }),
      ...(wizardSession
        ? [
            () => prisma.newClientCompanyBasics.deleteMany({ where: { sessionId: wizardSession.id } }),
            () => prisma.newClientWelcomeStatement.deleteMany({ where: { sessionId: wizardSession.id } }),
            () => prisma.newClientKeyContacts.deleteMany({ where: { sessionId: wizardSession.id } }),
            () => prisma.newClientContactBuilder.deleteMany({ where: { sessionId: wizardSession.id } }),
            () => prisma.newClientComplianceDocuments.deleteMany({ where: { sessionId: wizardSession.id } }),
            () => prisma.newClientEmployeePortalPreview.deleteMany({ where: { sessionId: wizardSession.id } }),
            () => prisma.newClientWizardSession.deleteMany({ where: { id: wizardSession.id } }),
          ]
        : []),
      () => prisma.client.delete({ where: { id: clientId } }),
    ];

    for (const op of deleteOps) {
      await withRetry(op);
    }

    return NextResponse.json({
      success: true,
      message: "Client and all associated data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
