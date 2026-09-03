import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ObjectId } from "mongodb";
import { resolvePortalAdvisorId } from "@/lib/portal-access";

// GET all webinars
export async function GET(request: NextRequest) {
  try {
    // Public portal (News & Events on an advisor subdomain) resolves the owning
    // advisor from x-advisor-id / the Host subdomain; the dashboard
    // (Communications → Webinars) requires the session as before.
    const portalAdvisorId = await resolvePortalAdvisorId(request, true);
    let userId: string | undefined = portalAdvisorId;
    if (!userId) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = session.user.id;
    }

    // Use MongoDB aggregation to fetch webinars with client info
    // This works even if Prisma client doesn't know about Webinar model yet
    const webinarsResult = await prisma.$runCommandRaw({
      aggregate: "Webinar",
      pipeline: [
        {
          $match: {
            userId: new ObjectId(userId),
          },
        },
        {
          $lookup: {
            from: "Client",
            localField: "clientId",
            foreignField: "_id",
            as: "client",
          },
        },
        {
          $unwind: {
            path: "$client",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $sort: { eventDate: -1 },
        },
      ],
      cursor: {},
    });

    // Transform MongoDB result to frontend format
    const webinars = (webinarsResult as any).cursor?.firstBatch || [];
    const transformedWebinars = webinars.map((webinar: any) => {
      const hasVideoFile = webinar.videoFileUrl && webinar.videoFileUrl.length > 0;
      const hasVideoUrl = webinar.videoUrl && webinar.videoUrl.length > 0;
      
      return {
        id: webinar._id?.toString(),
        clientId: webinar.clientId?.toString(),
        clientName: webinar.clientName,
        webinarTitle: webinar.webinarTitle,
        eventDate: webinar.eventDate,
        sourceType: webinar.sourceType as { upload: boolean; url: boolean },
        videoFileUrl: webinar.videoFileUrl,
        videoUrl: webinar.videoUrl,
        createdAt: webinar.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedWebinars,
    });
  } catch (error) {
    console.error("Error fetching webinars:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST create new webinar
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      client,
      sourceType,
      webinarTitle,
      eventDate,
      videoFile,
      videoUrl,
    } = body;

    // Validation
    if (!client || !webinarTitle || !eventDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!sourceType.upload && !sourceType.url) {
      return NextResponse.json(
        { error: "Please select a source type" },
        { status: 400 }
      );
    }

    if (sourceType.upload && sourceType.url) {
      return NextResponse.json(
        { error: "Please select only one source type" },
        { status: 400 }
      );
    }

    if (sourceType.upload && !videoFile) {
      return NextResponse.json(
        { error: "Please upload a video file" },
        { status: 400 }
      );
    }

    if (sourceType.url && !videoUrl) {
      return NextResponse.json(
        { error: "Please enter a video URL" },
        { status: 400 }
      );
    }

    // Find client by company name
    const clientRecord = await prisma.client.findFirst({
      where: {
        companyName: client,
        userId: session.user.id,
      },
    });

    if (!clientRecord) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Handle video file upload if provided
    let videoFileUrl = null;
    if (sourceType.upload && videoFile) {
      // Check base64 size (MongoDB has 16MB document limit)
      // Base64 string is ~33% larger than original file
      const maxBase64Size = 13 * 1024 * 1024; // ~13MB base64 = ~10MB original file
      if (videoFile.length > maxBase64Size) {
        console.error("Video file too large:", {
          base64Length: videoFile.length,
          maxSize: maxBase64Size,
        });
        return NextResponse.json(
          {
            error:
              "Video file is too large. Maximum size is 10MB. Please use YouTube/Vimeo URL or compress the video.",
          },
          { status: 400 }
        );
      }
      // For now, store as base64. In production, you might want to upload to S3 or similar
      // videoFile should be base64 string from frontend
      videoFileUrl = videoFile;
    }

    // Create webinar using MongoDB insertOne
    // This works even if Prisma client doesn't know about Webinar model yet
    const webinarData = {
      _id: new ObjectId(),
      userId: new ObjectId(session.user.id),
      clientId: new ObjectId(clientRecord.id),
      clientName: clientRecord.companyName,
      webinarTitle,
      eventDate: new Date(eventDate),
      sourceType: sourceType,
      videoFileUrl: videoFileUrl,
      videoUrl: sourceType.url ? videoUrl : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await prisma.$runCommandRaw({
      insert: "Webinar",
      documents: [webinarData],
    });

    // Transform for response
    const webinar = {
      id: webinarData._id.toString(),
      clientId: webinarData.clientId.toString(),
      clientName: webinarData.clientName,
      webinarTitle: webinarData.webinarTitle,
      eventDate: webinarData.eventDate,
      sourceType: webinarData.sourceType,
      videoFileUrl: webinarData.videoFileUrl,
      videoUrl: webinarData.videoUrl,
      createdAt: webinarData.createdAt,
    };

    return NextResponse.json({
      success: true,
      data: webinar,
    });
  } catch (error) {
    console.error("Error creating webinar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
