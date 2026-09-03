import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { compareDocumentCategoriesHubOrder } from "@/lib/document-category";
import { resolvePortalAdvisorId } from "@/lib/portal-access";

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    // Portal requests (employees, no session) scope the lookup to the advisor
    // derived from x-advisor-id / the Host subdomain. All other requests fall
    // back to the session user, so the dashboard stays login-required.
    const forPortal = request.nextUrl.searchParams.get("forPortal") === "1";
    const portalAdvisorId = forPortal
      ? await resolvePortalAdvisorId(request)
      : undefined;

    let userId: string | undefined = portalAdvisorId;
    if (!userId) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = session.user.id;
    }

    const clientIdParam = params.clientId;

    // Resolve clientId — it may be a slug (e.g. "g-loomis") rather than a
    // MongoDB ObjectID. The lookup is scoped to the resolved owner (advisor on
    // the public portal, session user on the dashboard) so no cross-tenant data
    // leaks between plans.
    const client = await prisma.client.findFirst({
      where: {
        OR: [{ id: clientIdParam }, { slug: clientIdParam }],
        userId,
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const clientId = client.id;

    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "1";

    // Fetch documents for this client only (never cross clientId). Hub lists omit
    // soft-archived unless requested.
    //
    // IMPORTANT: do NOT use `archivedAt: null` in the Prisma MongoDB where clause —
    // it omits rows where the field is missing AND, due to a Prisma MongoDB quirk,
    // also omits rows where it is explicitly `null` (verified: returns 0 for a doc
    // with archivedAt = null). Filter active docs in JS instead (same pattern as
    // GET /api/documents and the portal documents section).
    const documents = await prisma.document.findMany({
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

