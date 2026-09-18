import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ObjectId } from "mongodb";

/**
 * These routes go through the Prisma model rather than `$runCommandRaw`: the raw
 * command serializes BSON values (ObjectId, Date) to strings, so rows written
 * that way held `_id`/`userId`/`clientId` as hex strings — invisible to the
 * ObjectId filters used here and elsewhere, and unable to join to Client.
 */
function serializeWebinar(webinar: {
  id: string;
  clientId: string;
  clientName: string;
  webinarTitle: string;
  description: string | null;
  eventDate: Date;
  sourceType: unknown;
  videoFileUrl: string | null;
  videoUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: webinar.id,
    clientId: webinar.clientId,
    clientName: webinar.clientName,
    webinarTitle: webinar.webinarTitle,
    description: webinar.description,
    eventDate: webinar.eventDate,
    sourceType: webinar.sourceType as { upload: boolean; url: boolean },
    videoFileUrl: webinar.videoFileUrl,
    videoUrl: webinar.videoUrl,
    createdAt: webinar.createdAt,
  };
}

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
    if (!ObjectId.isValid(webinarId)) {
      return NextResponse.json(
        { error: "Webinar not found" },
        { status: 404 }
      );
    }

    const webinar = await prisma.webinar.findFirst({
      where: { id: webinarId, userId: session.user.id },
    });

    if (!webinar) {
      return NextResponse.json(
        { error: "Webinar not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeWebinar(webinar),
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
    if (!ObjectId.isValid(webinarId)) {
      return NextResponse.json(
        { error: "Webinar not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      client,
      sourceType,
      webinarTitle,
      description,
      eventDate,
      videoFile,
      videoUrl,
    } = body;

    // Check if webinar exists and user owns it
    const existingWebinar = await prisma.webinar.findFirst({
      where: { id: webinarId, userId: session.user.id },
    });

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

      clientId = clientRecord.id;
      clientName = clientRecord.companyName;
    }

    // Handle video file upload if provided
    let videoFileUrl = existingWebinar.videoFileUrl;
    if (sourceType?.upload && videoFile) {
      videoFileUrl = videoFile;
    } else if (!sourceType?.upload) {
      videoFileUrl = null;
    }

    // An explicit empty string clears the description; omitting the key keeps the
    // stored one, which is what the partial-update path relies on.
    const nextDescription =
      description === undefined
        ? existingWebinar.description
        : typeof description === "string" && description.trim()
        ? description.trim()
        : null;

    const updatedWebinar = await prisma.webinar.update({
      where: { id: existingWebinar.id },
      data: {
        clientId,
        clientName,
        webinarTitle: webinarTitle ?? existingWebinar.webinarTitle,
        description: nextDescription,
        eventDate: eventDate
          ? new Date(eventDate)
          : existingWebinar.eventDate,
        sourceType: (sourceType ?? existingWebinar.sourceType) as any,
        videoFileUrl,
        videoUrl: sourceType?.url ? videoUrl : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeWebinar(updatedWebinar),
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
    if (!ObjectId.isValid(webinarId)) {
      return NextResponse.json(
        { error: "Webinar not found" },
        { status: 404 }
      );
    }

    // Check if webinar exists and user owns it
    const existingWebinar = await prisma.webinar.findFirst({
      where: { id: webinarId, userId: session.user.id },
    });

    if (!existingWebinar) {
      return NextResponse.json(
        { error: "Webinar not found" },
        { status: 404 }
      );
    }

    await prisma.webinar.delete({
      where: { id: existingWebinar.id },
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
