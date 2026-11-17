import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getPresignedReadUrl, isR2Configured } from "@/lib/r2";
import {
  isPersistedDocumentId,
  R2_STORED_PLACEHOLDER,
} from "@/lib/document-id";
import {
  resolvePortalAdvisorId,
  isLocalDevLoopback,
} from "@/lib/portal-access";
import { resolvePlanAccess } from "@/lib/teammates/access.server";

/**
 * Fetch a signed R2 object and answer with its bytes.
 *
 * Keeps a download on the portal's own origin. Two things go wrong when the route
 * redirects instead: from an `http://` page (`next dev` on a LAN address, e.g.
 * http://192.168.0.134:3000) Chrome refuses the file — "The file at
 * 'https://…r2.cloudflarestorage.com/…' was redirected through an insecure
 * connection" — and R2 sends no `Access-Control-Allow-Origin`, so a `fetch` of the
 * redirect target is blocked as a CORS failure. The server has no such limits.
 */
async function streamDocumentDownload(
  signedUrl: string,
  contentType: string,
  fileName: string,
): Promise<NextResponse> {
  const object = await fetch(signedUrl);
  if (!object.ok || !object.body) {
    console.error("R2 object read failed:", object.status);
    return NextResponse.json(
      { error: "Document could not be downloaded" },
      { status: 502 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const contentLength = object.headers.get("content-length");
  if (contentLength) headers["Content-Length"] = contentLength;

  return new NextResponse(object.body, { status: 200, headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Public portal: anonymous employees open documents directly (browser
    // navigation to /api/documents/{id}/view?clientSlug=…), so the owning
    // advisor is resolved from the plan slug and the request is thereby scoped
    // to that one plan. A session is the dashboard path, where T2 requires the
    // caller's assignment to be checked instead. A development-only localhost
    // preview is the only other anonymous path (never enabled outside `next dev`).
    const portalAdvisorId = await resolvePortalAdvisorId(request, true);
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;

    const devPublic =
      isLocalDevLoopback(request) && !portalAdvisorId && !sessionUserId;
    if (!portalAdvisorId && !sessionUserId && !devPublic) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documentId = params.id;

    // A draft id is recognised by its prefix (`doc-…`, `plan-doc-…`, `temp-…`) —
    // see lib/document-id.ts. This used to be "not a 24-character MongoDB
    // ObjectId", which after the Postgres move refused EVERY real row, because
    // `Document.id` is a cuid: the hub's preview modal asked for its document and
    // got "temporary document ID" instead. Every document link on the portal went
    // through this.
    if (!isPersistedDocumentId(documentId)) {
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

    // T2 enforcement.
    //  - Public portal: the request is already scoped to this plan by its slug,
    //    so confirming the document belongs to that plan is sufficient.
    //  - Dashboard session: the caller must hold `documents: view` on this plan,
    //    within the assignment's category scope. This is precisely what stops a
    //    Contributor assigned to Ayres → Group Health from opening Ayres →
    //    Retirement, or an unassigned plan at all.
    //  - The dev-local preview is intentionally open in development.
    if (!devPublic) {
      if (portalAdvisorId) {
        if (document.client.userId !== portalAdvisorId) {
          return NextResponse.json(
            { error: "You don't have permission to view this document" },
            { status: 403 }
          );
        }
      } else if (sessionUserId) {
        const access = await resolvePlanAccess({
          userId: sessionUserId,
          clientIdOrSlug: document.clientId,
          category: document.category ?? null,
          permission: "documents",
          level: "view",
        });
        if (!access.allowed) {
          return NextResponse.json(
            { error: access.message },
            { status: access.reason === "plan_not_found" ? 404 : 403 }
          );
        }
      }
    }

    // `?download=1` asks for the file itself rather than a preview. It is streamed
    // through this route instead of redirecting (see `streamDocumentDownload`):
    // a redirect from an `http://` dev page to an `https://` R2 URL makes Chrome
    // stop the download — "was redirected through an insecure connection" — and a
    // cross-origin redirect cannot be read by `fetch` either, because R2 answers
    // without CORS headers.
    const asAttachment =
      request.nextUrl.searchParams.get("download") === "1";
    const disposition = asAttachment ? "attachment" : "inline";
    const downloadName = document.fileName || document.title || "document.pdf";

    // If file is in R2, redirect (preview) or stream (download) from here.
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
        // The preview redirects, so the SIGNED response carries the disposition;
        // a download answers from this route, which sets its own header.
        ...(asAttachment
          ? {}
          : {
              responseContentDisposition: `inline; filename="${encodeURIComponent(downloadName)}"`,
            }),
        responseContentType: contentType,
      });
      if (signedUrl) {
        if (!asAttachment) {
          return NextResponse.redirect(signedUrl, 302);
        }
        return await streamDocumentDownload(signedUrl, contentType, downloadName);
      }
    }

    // `r2:stored` is a placeholder, not bytes. Reaching here means the object is
    // in R2 but could not be signed — falling into the base64 path below would
    // decode the placeholder and answer "Document appears to be corrupted".
    if (docWithKey.storageKey || document.fileUrl === R2_STORED_PLACEHOLDER) {
      console.error("Document is in R2 but no signed URL could be generated:", documentId);
      return NextResponse.json(
        { error: "Document storage is temporarily unavailable" },
        { status: 503 }
      );
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
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(downloadName)}"`,
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

