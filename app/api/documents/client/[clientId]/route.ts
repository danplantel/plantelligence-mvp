import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { compareDocumentCategoriesHubOrder } from "@/lib/document-category";

/** Returns true when the string looks like a MongoDB ObjectID (24 hex chars). */
function isObjectId(v: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(v);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientIdParam = params.clientId;

    // Resolve clientId — it may be a slug (e.g. "g-loomis") rather than a MongoDB ObjectID.
    let clientId = clientIdParam;
    if (!isObjectId(clientIdParam)) {
      const slugMatch = await prisma.client.findFirst({
        where: { slug: clientIdParam },
        select: { id: true, userId: true },
      });
      if (!slugMatch) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      // Verify client belongs to user (slug resolution path)
      if (slugMatch.userId !== session.user.id) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      clientId = slugMatch.id;
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

    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "1";

    // Fetch documents for this client only (never cross clientId). Hub lists omit soft-archived unless requested.
    const documents = await prisma.document.findMany({
      where: {
        clientId: clientId,
        ...(!includeArchived ? { archivedAt: null } : {}),
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
        categorySuggested: true,
        categoryConfidence: true,
        uploadedAt: true,
        expirationDate: true,
        showQrCode: true,
        archivedAt: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
    });

    const visible = includeArchived
      ? documents
      : documents.filter((d) => d.archivedAt == null);

    const sorted = [...visible].sort((a, b) => {
      const byCat = compareDocumentCategoriesHubOrder(a.category, b.category);
      if (byCat !== 0) return byCat;
      return b.uploadedAt.getTime() - a.uploadedAt.getTime();
    });

    return NextResponse.json({
      success: true,
      data: sorted,
    });
  } catch (error) {
    console.error("Error fetching client documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

