import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { R2_FILEURL_PLACEHOLDER, isR2Configured } from "@/lib/r2";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documentId = params.id;

    // Verify document belongs to user's client
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        client: {
          userId: session.user.id,
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if request has FormData (file upload) or JSON
    // When FormData is used with fetch, Content-Type includes boundary
    const contentType = request.headers.get("content-type") || "";
    let title: string;
    let shortDescription: string | null | undefined;
    let language: string | undefined;
    let fileUrl: string | undefined;
    let fileName: string | undefined;
    let category: string | undefined;
    let storageKey: string | undefined;
    let showQrCode: boolean | undefined;
    let archivedAt: Date | null | undefined;
    let expirationDate: Date | null | undefined;

    // Try to determine if it's FormData - check for multipart or boundary in content-type
    const isFormData = contentType.includes("multipart/form-data") || contentType.includes("boundary");

    if (isFormData) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (file && file.size > 0 && isR2Configured()) {
        return NextResponse.json(
          {
            error: "File upload via FormData is disabled when R2 is configured. Use presign → PUT to R2, then PATCH with storageKey in JSON.",
          },
          { status: 400 }
        );
      }

      title = (formData.get("title") as string) || document.title;
      const shortDesc = formData.get("shortDescription");
      shortDescription = shortDesc !== null ? (shortDesc as string) : null;
      const lang = formData.get("language") as string;
      language = lang || undefined;
      const cat = formData.get("category") as string;
      category = cat || undefined;

      // Check if file exists and is a valid File object (legacy when R2 not configured)
      if (file) {
        try {
          // Try to access file properties to verify it's a File
          const fileSize = file.size || 0;
          const fileNameFromFile = file.name || "";

          if (fileSize > 0 && fileNameFromFile) {
            // Convert file to base64
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const base64 = buffer.toString("base64");

            // Get file type from File object or default to PDF
            const fileType = file.type || "application/pdf";

            // Create data URL format
            fileUrl = `data:${fileType};base64,${base64}`;
            fileName = fileNameFromFile;

            console.log(`[PATCH /api/documents/${documentId}] File uploaded: ${fileName}, size: ${fileSize} bytes, type: ${fileType}`);
          } else {
            console.log(`[PATCH /api/documents/${documentId}] File is empty or invalid: size=${fileSize}, name=${fileNameFromFile}`);
          }
        } catch (error) {
          console.error(`[PATCH /api/documents/${documentId}] Error processing file:`, error);
        }
      } else {
        console.log(`[PATCH /api/documents/${documentId}] No file in FormData`);
      }
    } else {
      // Handle JSON request (title/description only, or R2 storageKey after client uploaded)
      const body = await request.json();
      title = body.title ?? document.title;
      shortDescription = body.shortDescription;
      language = body.language;
      category = body.category;
      if (body.showQrCode !== undefined) {
        showQrCode = Boolean(body.showQrCode);
      }
      if (body.archivedAt !== undefined) {
        archivedAt =
          body.archivedAt === null || body.archivedAt === ""
            ? null
            : new Date(body.archivedAt as string);
      }
      if (body.expirationDate !== undefined) {
        expirationDate =
          body.expirationDate === null || body.expirationDate === ""
            ? null
            : new Date(body.expirationDate as string);
        if (
          expirationDate &&
          Number.isNaN(expirationDate.getTime())
        ) {
          return NextResponse.json(
            { error: "Invalid expirationDate" },
            { status: 400 },
          );
        }
      }
      const storageKeyFromBody = body.storageKey as string | undefined;
      if (storageKeyFromBody && typeof storageKeyFromBody === "string" && storageKeyFromBody.trim()) {
        fileUrl = R2_FILEURL_PLACEHOLDER;
        fileName = (body.fileName as string) || fileName;
        storageKey = storageKeyFromBody.trim();
      }
      console.log(`[PATCH /api/documents/${documentId}] JSON request (no file), contentType: ${contentType}`);
    }

    if (!title || !String(title).trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Update document
    const updateData: {
      title: string;
      shortDescription?: string | null;
      language?: string | null;
      fileUrl?: string;
      fileName?: string;
      uploadedAt?: Date;
      category?: string | null;
      storageKey?: string | null;
      showQrCode?: boolean;
      archivedAt?: Date | null;
      expirationDate?: Date | null;
    } = {
      title: title,
    };

    // Only include shortDescription if it's provided (can be empty string to clear it)
    if (shortDescription !== undefined) {
      updateData.shortDescription = shortDescription || null;
    }

    // Include language if provided
    if (language !== undefined) {
      updateData.language = language || null;
    }

    // Include category if provided
    if (category !== undefined) {
      updateData.category = resolvePersistedDocumentCategory(
        document.type,
        category,
      );
    }

    if (showQrCode !== undefined) {
      updateData.showQrCode = showQrCode;
    }
    if (archivedAt !== undefined) {
      updateData.archivedAt = archivedAt;
    }
    if (expirationDate !== undefined) {
      updateData.expirationDate = expirationDate;
    }

    // Include fileUrl and fileName if file was uploaded
    // IMPORTANT: Always update fileUrl if it's provided to ensure file replacement works
    if (fileUrl) {
      updateData.fileUrl = fileUrl;
      // Update uploadedAt when file is replaced to bust cache
      updateData.uploadedAt = new Date();
      console.log(`[PATCH /api/documents/${documentId}] Updating fileUrl (new file) and uploadedAt`);
    }
    if (fileName) {
      updateData.fileName = fileName;
      console.log(`[PATCH /api/documents/${documentId}] Updating fileName to: ${fileName}`);
    }
    if (storageKey) {
      updateData.storageKey = storageKey;
      updateData.uploadedAt = updateData.uploadedAt ?? new Date();
      console.log(`[PATCH /api/documents/${documentId}] Updating storageKey (R2)`);
    }

    console.log(`[PATCH /api/documents/${documentId}] Update data:`, {
      title: updateData.title,
      hasFileUrl: !!updateData.fileUrl,
      fileName: updateData.fileName,
      hasLanguage: updateData.language !== undefined,
    });

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: updateData as any,
    });

    return NextResponse.json({
      success: true,
      message: "Document updated successfully",
      data: updatedDocument,
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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

    const documentId = params.id;

    // Verify document belongs to user's client
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        client: {
          userId: session.user.id,
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete document
    await prisma.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}