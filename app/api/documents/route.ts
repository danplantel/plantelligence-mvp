import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { R2_FILEURL_PLACEHOLDER, isR2Configured } from "@/lib/r2";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const search = searchParams.get("search");
    const typeFilter = searchParams.get("type");
    const includeArchived = searchParams.get("includeArchived") === "1";

    // Build where clause — do not use `archivedAt: null` in Prisma MongoDB where (omits docs
    // where the field is missing). Filter active docs in JS instead (same pattern as client portal).
    //
    // Use direct clientId + verify ownership via separate client lookup, because the
    // Prisma relation filter `client: { userId }` can behave inconsistently with MongoDB
    // (same pattern as GET /api/documents/client/[clientId]).
    const whereClause: any = {};

    // Add client filter if specified
    if (clientId) {
      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: session.user.id },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      whereClause.clientId = clientId;
    } else {
      // When no clientId is specified, fall back to the relation filter
      whereClause.client = {
        userId: session.user.id,
      };
    }

    // Add search filter if specified
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { fileName: { contains: search, mode: "insensitive" } },
        { client: { companyName: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Add type filter if specified
    if (typeFilter && typeFilter !== "all") {
      whereClause.title = { contains: typeFilter, mode: "insensitive" };
    }

    // Fetch documents with client information
    // IMPORTANT: Don't return fileUrl (base64 data) for security and performance
    // Using include instead of select to avoid issues with optional fields
    // Take limit prevents MongoDB sort memory errors on large datasets
    const documentsRaw = await prisma.document.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        uploadedAt: "desc",
      },
      take: 500,
    });

    const activeRaw = includeArchived
      ? documentsRaw
      : documentsRaw.filter(
          (d: { archivedAt: Date | null }) => d.archivedAt == null,
        );

    // Transform to only include needed fields (excluding fileUrl for security)
    const documents = activeRaw.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      type: doc.type,
      shortDescription: doc.shortDescription || null,
      language: doc.language || null,
      uploadedAt: doc.uploadedAt,
      expirationDate: doc.expirationDate
        ? doc.expirationDate.toISOString()
        : null,
      client: doc.client,
      category: doc.category ?? null,
      categorySuggested: doc.categorySuggested ?? null,
      categoryConfidence: doc.categoryConfidence ?? null,
      showQrCode: doc.showQrCode ?? true,
      archivedAt: doc.archivedAt
        ? doc.archivedAt.toISOString()
        : null,
      /** Stable relative URL for authenticated view redirect (no presigned URL in JSON). */
      viewUrl: `/api/documents/${doc.id}/view`,
    }));

    return NextResponse.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch documents",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    // R2 flow: client already uploaded to R2; create document with storageKey only
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const {
        clientId,
        storageKey,
        fileName,
        title,
        type,
        category,
        categorySuggested,
        categoryConfidence,
        shortDescription,
        language,
        showQrCode,
        expirationDate: expirationDateBody,
      } = body as {
        clientId?: string;
        storageKey?: string;
        fileName?: string;
        title?: string;
        type?: string;
        category?: string;
        categorySuggested?: string | null;
        categoryConfidence?: number | null;
        shortDescription?: string | null;
        language?: string | null;
        showQrCode?: boolean;
        expirationDate?: string | null;
      };
      if (!clientId || !storageKey || !fileName) {
        return NextResponse.json(
          { error: "Missing required fields: clientId, storageKey, fileName" },
          { status: 400 }
        );
      }
      const categoryTrim =
        typeof category === "string" ? category.trim() : "";
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: session.user.id },
      });
      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      const docType = type ?? "Document";
      const suggested =
        typeof categorySuggested === "string" && categorySuggested.trim()
          ? categorySuggested.trim()
          : null;
      const confidence =
        typeof categoryConfidence === "number" && Number.isFinite(categoryConfidence)
          ? Math.round(categoryConfidence)
          : null;
      let expirationDate: Date | null = null;
      if (
        expirationDateBody != null &&
        String(expirationDateBody).trim() !== ""
      ) {
        const d = new Date(String(expirationDateBody).trim());
        if (!Number.isNaN(d.getTime())) {
          expirationDate = d;
        }
      }
      const categoryHub = resolvePersistedDocumentCategory(
        docType,
        categoryTrim || undefined,
        storageKey.trim(),
      );

      // Idempotency guard: the client upload flow can race its own auto-persist
      // (e.g. the debounced optional-documents save + persistNewDocumentsToApi both
      // firing for the same upload). Never create a second row for the same
      // client + R2 object.
      const existing = await prisma.document.findFirst({
        where: {
          clientId,
          storageKey: storageKey.trim(),
        },
        select: { id: true, title: true, fileName: true },
      });
      if (existing) {
        return NextResponse.json({
          message: "Document already exists (R2)",
          document: existing,
        });
      }

      const doc = await prisma.document.create({
        data: {
          title: (title ?? fileName.replace(/\.[^.]+$/, "")) || "Document",
          fileName,
          fileUrl: R2_FILEURL_PLACEHOLDER,
          storageKey: storageKey.trim(),
          type: docType,
          shortDescription: shortDescription ?? null,
          language: language ?? "EN",
          clientId,
          category: categoryHub,
          categorySuggested: suggested,
          categoryConfidence: confidence,
          showQrCode: showQrCode !== false,
          ...(expirationDate ? { expirationDate } : {}),
          uploadedAt: new Date(),
        } as any,
      });
      return NextResponse.json({
        message: "Document created (R2)",
        document: { id: doc.id, title: doc.title, fileName: doc.fileName },
      });
    }

    if (isR2Configured()) {
      return NextResponse.json(
        {
          error: "File upload via FormData is disabled when R2 is configured. Use presign → PUT to R2, then POST with storageKey in JSON.",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const clientId = formData.get("clientId") as string;
    const spdFile = formData.get("spdFile") as File;
    const spdFileName = formData.get("spdFileName") as string;
    const provideSpanishVersions = formData.get("provideSpanishVersions") === "true";

    if (!clientId || !spdFile || !spdFileName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify client belongs to user
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        userId: session.user.id,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get existing documents for this client
    const existingDocuments = await prisma.document.findMany({
      where: { clientId: clientId }
    });

    // Handle SPD document
    const spdTitle = formData.get("spdTitle") as string;
    const spdShortDescription = formData.get("spdShortDescription") as string | null;
    let spdDocument;

    if (spdFile) {
      // New file uploaded - convert to base64 and create/update
      const bytes = await spdFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");
      
      // Ensure we have a proper data URL format
      let fileUrl;
      if (base64.startsWith('data:')) {
        // Already a data URL, use as is
        fileUrl = base64;
      } else {
        // Just base64 data, add data URL prefix
        fileUrl = `data:${spdFile.type};base64,${base64}`;
      }
      
      

      // Delete existing SPD document if any
      const deletedSpdDocs = await prisma.document.deleteMany({
        where: {
          clientId: clientId,
          title: { contains: "SPD" }
        }
      });

      // Create new SPD document
      spdDocument = await prisma.document.create({
        data: {
          title: spdTitle || "SPD (Summary Plan Description)",
          fileName: spdFileName,
          fileUrl: fileUrl,
          type: "SPD", // Always SPD for this field
          shortDescription: spdShortDescription || null,
          category: resolvePersistedDocumentCategory("SPD", null),
          clientId: clientId,
          uploadedAt: new Date(),
        } as any,
      });
    } else {
      // No new file, just update title and shortDescription if changed
      const existingSpd = existingDocuments.find(doc => doc.title.includes("SPD"));
      if (existingSpd) {
        const updateData: { title?: string; shortDescription?: string | null } = {};
        if (spdTitle && existingSpd.title !== spdTitle) {
          updateData.title = spdTitle;
        }
        if (spdShortDescription !== null && (existingSpd as any).shortDescription !== spdShortDescription) {
          updateData.shortDescription = spdShortDescription || null;
        }
        if (Object.keys(updateData).length > 0) {
          spdDocument = await prisma.document.update({
            where: { id: existingSpd.id },
            data: updateData as any
          });
        } else {
          spdDocument = existingSpd;
        }
      } else {
        spdDocument = existingSpd;
      }
    }

    // Process SBC files - handle both new uploads and title updates
    const sbcDocuments = [];
    const existingSbcDocs = existingDocuments.filter(doc => doc.title.startsWith("SBC"));
    
    // Process new SBC file uploads
    let index = 0;
    while (formData.get(`sbcFile_${index}`)) {
      const sbcFile = formData.get(`sbcFile_${index}`) as File;
      const sbcFileName = formData.get(`sbcFileName_${index}`) as string;
      const sbcTitle = formData.get(`sbcTitle_${index}`) as string;
      const sbcShortDescription = formData.get(`sbcShortDescription_${index}`) as string | null;

      if (sbcFile && sbcFileName) {
        const sbcBytes = await sbcFile.arrayBuffer();
        const sbcBuffer = Buffer.from(sbcBytes);
        const sbcBase64 = sbcBuffer.toString("base64");
        
        // Ensure we have a proper data URL format
        let sbcFileUrl;
        if (sbcBase64.startsWith('data:')) {
          // Already a data URL, use as is
          sbcFileUrl = sbcBase64;
        } else {
          // Just base64 data, add data URL prefix
          sbcFileUrl = `data:${sbcFile.type};base64,${sbcBase64}`;
        }
        
        

        const sbcDocument = await prisma.document.create({
          data: {
            title: sbcTitle || `SBC Document ${index + 1}`,
            fileName: sbcFileName,
            fileUrl: sbcFileUrl,
            type: "SBC", // Always SBC for additional documents
            shortDescription: sbcShortDescription || null,
            category: resolvePersistedDocumentCategory("SBC", null),
            clientId: clientId,
            uploadedAt: new Date(),
          } as any,
        });

        sbcDocuments.push(sbcDocument);
      }
      index++;
    }

    // Process title and shortDescription updates for existing SBC documents (no new files)
    const sbcTitleUpdates = [];
    for (let i = 0; i < existingSbcDocs.length; i++) {
      const sbcTitle = formData.get(`sbcTitle_${i}`) as string;
      const sbcShortDescription = formData.get(`sbcShortDescription_${i}`) as string | null;
      const existingDoc = existingSbcDocs[i];
      
      const updateData: { title?: string; shortDescription?: string | null } = {};
      if (sbcTitle && existingDoc.title !== sbcTitle) {
        updateData.title = sbcTitle;
      }
      if (sbcShortDescription !== null && (existingDoc as any).shortDescription !== sbcShortDescription) {
        updateData.shortDescription = sbcShortDescription || null;
      }
      
      if (Object.keys(updateData).length > 0) {
        const updatedDoc = await prisma.document.update({
          where: { id: existingDoc.id },
          data: updateData as any
        });
        sbcTitleUpdates.push(updatedDoc);
      } else {
        sbcTitleUpdates.push(existingDoc);
      }
    }

    return NextResponse.json({
      message: "Documents updated successfully",
      documents: [spdDocument, ...sbcDocuments, ...sbcTitleUpdates],
    });
  } catch (error) {
    console.error("Error uploading documents:", error);
    return NextResponse.json(
      { error: "Failed to upload documents" },
      { status: 500 }
    );
  }
}