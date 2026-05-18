import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ObjectId } from "mongodb";

// GET single webinar
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webinarId = params.id;

    // Use MongoDB findOne to fetch webinar
    const webinarResult = await prisma.$runCommandRaw({
      find: "Webinar",
      filter: {
        _id: new ObjectId(webinarId),
        userId: new ObjectId(session.user.id),
      },
    });

    const webinars = (webinarResult as any).cursor?.firstBatch || [];
    const webinar = webinars[0];

    if (!webinar) {
      return NextResponse.json(
        { error: "Webinar not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: webinar._id?.toString(),
        clientId: webinar.clientId?.toString(),
        clientName: webinar.clientName,
        webinarTitle: webinar.webinarTitle,
        eventDate: webinar.eventDate,
        sourceType: webinar.sourceType as { upload: boolean; url: boolean },
        videoFileUrl: webinar.videoFileUrl,
        videoUrl: webinar.videoUrl,
        createdAt: webinar.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching webinar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT update webinar
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webinarId = params.id;
    const body = await request.json();
    const {
      client,
      sourceType,
      webinarTitle,
      eventDate,
      videoFile,
      videoUrl,
    } = body;

    // Check if webinar exists and user owns it
    const existingResult = await prisma.$runCommandRaw({
      find: "Webinar",
      filter: {
        _id: new ObjectId(webinarId),
        userId: new ObjectId(session.user.id),
      },
    });

    const existingWebinars = (existingResult as any).cursor?.firstBatch || [];
    const existingWebinar = existingWebinars[0];

    if (!existingWebinar) {
      return NextResponse.json(
        { error: "Webinar not found" },
        { status: 404 }
      );
    }

    // Find client by company name if changed
    let clientId = existingWebinar.clientId;
    let clientName = existingWebinar.clientName;

    if (client && client !== existingWebinar.clientName) {
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

      clientId = new ObjectId(clientRecord.id);
      clientName = clientRecord.companyName;
    }

    // Handle video file upload if provided
    let videoFileUrl = existingWebinar.videoFileUrl;
    if (sourceType?.upload && videoFile) {
      videoFileUrl = videoFile;
    } else if (!sourceType?.upload) {
      videoFileUrl = null;
    }

    // Update webinar using MongoDB updateOne
    await prisma.$runCommandRaw({
      update: "Webinar",
      updates: [
        {
          q: {
            _id: new ObjectId(webinarId),
            userId: new ObjectId(session.user.id),
          },
          u: {
            $set: {
              clientId: clientId,
              clientName: clientName,
              webinarTitle: webinarTitle ?? existingWebinar.webinarTitle,
              eventDate: eventDate
                ? new Date(eventDate)
                : existingWebinar.eventDate,
              sourceType: sourceType ?? existingWebinar.sourceType,
              videoFileUrl: videoFileUrl,
              videoUrl: sourceType?.url ? videoUrl : null,
              updatedAt: new Date(),
            },
          },
        },
      ],
    });

    // Fetch updated webinar
    const updatedResult = await prisma.$runCommandRaw({
      find: "Webinar",
      filter: {
        _id: new ObjectId(webinarId),
      },
    });

    const updatedWebinars = (updatedResult as any).cursor?.firstBatch || [];
    const updatedWebinar = updatedWebinars[0];

    return NextResponse.json({
      success: true,
      data: {
        id: updatedWebinar._id?.toString(),
        clientId: updatedWebinar.clientId?.toString(),
        clientName: updatedWebinar.clientName,
        webinarTitle: updatedWebinar.webinarTitle,
        eventDate: updatedWebinar.eventDate,
        sourceType: updatedWebinar.sourceType,
        videoFileUrl: updatedWebinar.videoFileUrl,
        videoUrl: updatedWebinar.videoUrl,
        createdAt: updatedWebinar.createdAt,
      },
    });
  } catch (error) {
    console.error("Error updating webinar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE webinar
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webinarId = params.id;

    // Check if webinar exists and user owns it
    const existingResult = await prisma.$runCommandRaw({
      find: "Webinar",
      filter: {
        _id: new ObjectId(webinarId),
        userId: new ObjectId(session.user.id),
      },
    });

    const existingWebinars = (existingResult as any).cursor?.firstBatch || [];
    const existingWebinar = existingWebinars[0];

    if (!existingWebinar) {
      return NextResponse.json(
        { error: "Webinar not found" },
        { status: 404 }
      );
    }

    // Delete webinar using MongoDB deleteOne
    await prisma.$runCommandRaw({
      delete: "Webinar",
      deletes: [
        {
          q: {
            _id: new ObjectId(webinarId),
            userId: new ObjectId(session.user.id),
          },
          limit: 1,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: "Webinar deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting webinar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
