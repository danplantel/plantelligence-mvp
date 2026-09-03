import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";
import {
  resolvePortalAdvisorId,
  isLocalDevLoopback,
} from "@/lib/portal-access";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Public portal: anonymous employees open documents directly on an advisor
    // subdomain (browser navigation to /api/documents/{id}/view), so resolve the
    // owning advisor from the Host subdomain. A session is preferred when one
    // exists; a development-only localhost preview is the only other anonymous
    // path (never enabled outside `next dev`).
    const portalAdvisorId = await resolvePortalAdvisorId(request, true);
    let ownerId: string | undefined = portalAdvisorId;
    if (!ownerId) {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        ownerId = session.user.id;
      }
    }
    const devPublic = isLocalDevLoopback(request) && !ownerId;
    if (!ownerId && !devPublic) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documentId = params.id;

    // Check if this is a temporary ID (not a database ID)
    // Temporary IDs have formats like: "doc-{timestamp}-{random}", "plan-doc-{timestamp}-{random}", etc.
    // MongoDB ObjectIDs are 24-character hex strings
    const isTemporaryId = 
      documentId.startsWith("doc-") ||
      documentId.startsWith("plan-doc-") ||
      documentId.startsWith("optional-doc-") ||
      documentId.startsWith("temp-") ||
      !/^[0-9a-fA-F]{24}$/.test(documentId); // Not a valid MongoDB ObjectID format

    if (isTemporaryId) {
      console.error("Attempted to fetch document with temporary ID:", documentId);
      return NextResponse.json(
        { error: "Document not found. This appears to be a temporary document ID." },
        { status: 404 }
      );
    }

    // Fetch document with client information
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        client: {
          select: {
            userId: true,
          },
        },
      },
    });

    // Check if document exists
    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if document has a client relationship
    if (!document.client) {
      console.error("Document has no client relationship:", documentId);
      return NextResponse.json(
        { error: "Document is not associated with a client" },
        { status: 404 }
      );
    }

    // Check if the resolved owner (portal advisor or session user) owns this
    // document (via its client). Cross-tenant documents are never served; the
    // dev-local preview is intentionally open in development.
    if (!devPublic && document.client.userId !== ownerId) {
      return NextResponse.json(
        { error: "You don't have permission to view this document" },
        { status: 403 }
      );
    }

    // If file is in R2, redirect to a signed URL (no server file transfer)
    const docWithKey = document as { storageKey?: string | null };
    if (docWithKey.storageKey && isR2Configured()) {
      const ext = (document.fileName || "").toLowerCase().replace(/.*\./, "") || "pdf";
      const contentType =
        ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
        ext === "doc" ? "application/msword" :
        ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
        "application/pdf";
      const signedUrl = await getPresignedReadUrl({
        key: docWithKey.storageKey,
        responseContentDisposition: `inline; filename="${encodeURIComponent(document.fileName)}"`,
        responseContentType: contentType,
      });
      if (signedUrl) {
        return NextResponse.redirect(signedUrl, 302);
      }
    }

    // Legacy: serve from fileUrl (base64)
    if (!document.fileUrl) {
      console.error("Document has no fileUrl or storageKey");
      return NextResponse.json(
        { error: "Document has no file data" },
        { status: 404 }
      );
    }
    
    // Parse data URL more efficiently to avoid stack overflow on large files
    // Use indexOf instead of regex for better performance with large strings
    let mimeType = "application/pdf";
    let base64Data = document.fileUrl;
    
    if (document.fileUrl.startsWith("data:")) {
      const commaIndex = document.fileUrl.indexOf(",");
      if (commaIndex === -1) {
        console.error("Invalid data URL format - no comma found");
        return NextResponse.json(
          { error: "Invalid file format" },
          { status: 500 }
        );
      }
      
      const header = document.fileUrl.substring(5, commaIndex); // Skip "data:"
      const semicolonIndex = header.indexOf(";");
      
      if (semicolonIndex !== -1) {
        mimeType = header.substring(0, semicolonIndex);
        // Check if it's base64 encoded
        if (header.substring(semicolonIndex + 1) !== "base64") {
          console.error("Invalid data URL format - not base64");
          return NextResponse.json(
            { error: "Invalid file format" },
            { status: 500 }
          );
        }
      } else {
        mimeType = header;
      }
      
      base64Data = document.fileUrl.substring(commaIndex + 1);
    }
    
    // Validate base64 data before decoding
    if (!base64Data || base64Data.trim().length === 0) {
      console.error("Empty base64 data for document:", documentId);
      return NextResponse.json(
        { error: "Document has no file data" },
        { status: 404 }
      );
    }

    // Clean base64 data - remove any whitespace/newlines that might corrupt it
    const cleanBase64 = base64Data.replace(/\s/g, "");
    
    // Decode base64 to buffer
    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, "base64");
    } catch (error) {
      console.error("Failed to decode base64 for document:", documentId, error);
      return NextResponse.json(
        { error: "Invalid base64 data" },
        { status: 500 }
      );
    }
    
    // Validate buffer size
    if (buffer.length < 100) {
      console.error("Buffer too small for document:", documentId, "size:", buffer.length);
      return NextResponse.json(
        { error: "Document appears to be corrupted" },
        { status: 500 }
      );
    }

    // Validate PDF header (PDF files start with %PDF)
    const pdfHeader = buffer.slice(0, 4).toString("ascii");
    if (pdfHeader !== "%PDF") {
      console.error("Invalid PDF header for document:", documentId, "header:", pdfHeader);
      return NextResponse.json(
        { error: "Document is not a valid PDF file" },
        { status: 500 }
      );
    }

    // Return the file with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf", // Always use application/pdf for PDFs
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
        "Content-Length": buffer.length.toString(), // Explicitly set content length
        "Cache-Control": "no-cache, no-store, must-revalidate", // Prevent caching to ensure updated files are shown
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error serving document:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    return NextResponse.json(
      { error: "Failed to serve document", details: errorMessage },
      { status: 500 }
    );
  }
}

