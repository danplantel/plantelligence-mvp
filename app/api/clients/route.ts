import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const type = searchParams.get("type") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const sortColumn = searchParams.get("sortColumn") || "createdAt";
    const sortDirection = searchParams.get("sortDirection") || "desc";
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId: session.user.id
    };

    // Only filter by status if not "all"
    if (status !== "all") {
      where.status = status;
    }

    // Only filter by type if not "all"
    if (type !== "all") {
      where.type = type;
    }

    if (search) {
      where.companyName = {
        contains: search,
        mode: "insensitive"
      };
    }

    // Build orderBy clause
    let orderBy: any = {};
    if (sortColumn === "createdAt" || sortColumn === "updatedAt") {
      orderBy[sortColumn] = sortDirection;
    } else if (sortColumn === "companyName") {
      orderBy.companyName = sortDirection;
    } else if (sortColumn === "status") {
      // For status, we want Draft to always come first when sorting desc
      // This requires special handling - we'll sort by status normally
      // and the frontend can handle the Draft-first logic if needed
      orderBy.status = sortDirection;
    } else if (sortColumn === "type") {
      orderBy.type = sortDirection;
    } else {
      orderBy.createdAt = "desc"; // default
    }

    // Get clients with pagination and document count
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          companyName: true,
          companyWebsite: true,
          companyLogo: true,
          logoFileName: true,
          brandColor: true,
          secondaryColor: true,
          missionHeadline: true,
          backgroundImg: true,
          backgroundImgName: true,
          thumbnailImg: true,
          thumbnailImgName: true,
          secondaryBannerImg: true,
          secondaryBannerImgName: true,
          faviconImg: true,
          faviconImgName: true,
          status: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          currentStep: true,
          keyContacts: true,
          employeePortalPreview: true,
          documents: {
            select: {
              id: true,
              title: true,
              fileName: true,
              type: true,
              category: true,
            } as any
          }
        }
      }),
      prisma.client.count({ where })
    ]);

    // Add document count and normalized brandImages (merge JSON with legacy fields)
    const clientsWithDocumentCount = clients.map((client) => {
      const clientAny = client as any;
      const buildImage = (url?: string | null, fileName?: string | null) =>
        url ? { url, fileName: fileName || "" } : null;

      // brandImages JSON may exist in DB even if not in Prisma type; rely on legacy fields as fallback
      const brandImagesJson = clientAny.brandImages || {};
      const fallbackBrandImages = {
        header: buildImage(clientAny.backgroundImg, clientAny.backgroundImgName),
        thumbnail: buildImage(clientAny.thumbnailImg, clientAny.thumbnailImgName),
        secondaryBanner: buildImage(
          clientAny.secondaryBannerImg,
          clientAny.secondaryBannerImgName,
        ),
        favicon: buildImage(clientAny.faviconImg, clientAny.faviconImgName),
      };

      const brandImages = {
        ...fallbackBrandImages,
        ...brandImagesJson,
        // If JSON exists but misses a slot, keep fallback for that slot
        header: brandImagesJson.header ?? fallbackBrandImages.header,
        thumbnail: brandImagesJson.thumbnail ?? fallbackBrandImages.thumbnail,
        secondaryBanner:
          brandImagesJson.secondaryBanner ?? fallbackBrandImages.secondaryBanner,
        favicon: brandImagesJson.favicon ?? fallbackBrandImages.favicon,
      };

      return {
        ...clientAny,
        documentCount: (clientAny.documents || []).length,
        brandImages,
      };
    });

    return NextResponse.json({
      success: true,
      data: clientsWithDocumentCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const client = await prisma.client.create({
      data: {
        ...body,
        userId: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      data: client
    });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
