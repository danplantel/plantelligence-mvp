import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolvePortalAdvisorId } from "@/lib/portal-access";

/** Row shape handed to the dashboard list and the portal Webinars section. */
type WebinarRow = {
  id: string;
  clientId: string;
  clientName: string;
  webinarTitle: string;
  description: string | null;
  thumbnail: string | null;
  eventDate: Date;
  sourceType: unknown;
  videoFileUrl: string | null;
  videoUrl: string | null;
  createdAt: Date;
};

/**
 * `includeVideoFiles: false` keeps the multi-MB base64 video out of the payload,
 * which is what lets the dashboard list render thumbnails without pulling every
 * video on load. Size and presence are still reported so the list's "Size" sort
 * and play affordance keep working — the video itself is fetched on demand from
 * `/api/webinars/[id]` when the user actually plays one.
 */
function serializeWebinar(
  webinar: WebinarRow,
  options: { includeVideoFiles: boolean } = { includeVideoFiles: true },
) {
  const videoFileUrl = webinar.videoFileUrl ?? null;

  return {
    id: webinar.id,
    clientId: webinar.clientId,
    clientName: webinar.clientName,
    webinarTitle: webinar.webinarTitle,
    description: webinar.description,
    thumbnail: webinar.thumbnail,
    eventDate: webinar.eventDate,
    sourceType: webinar.sourceType as { upload: boolean; url: boolean },
    videoFileUrl: options.includeVideoFiles ? videoFileUrl : null,
    hasVideoFile: Boolean(videoFileUrl),
    videoSize: videoFileUrl ? videoFileUrl.length : 0,
    videoUrl: webinar.videoUrl,
    createdAt: webinar.createdAt,
  };
}

// GET all webinars
export async function GET(request: NextRequest) {
  try {
    // Public portal (News & Events) resolves the owning advisor from the plan
    // (clientId query param); the dashboard (Communications → Webinars)
    // requires the session as before.
    const portalAdvisorId = await resolvePortalAdvisorId(request, true);
    let userId: string | undefined = portalAdvisorId;
    if (!userId) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = session.user.id;
    }

    // Typed Prisma, not $runCommandRaw: the raw command serializes BSON values
    // (ObjectId, Date) to strings, so rows written that way are stored as
    // `clientId: "<hex>"` / `eventDate: "<iso>"` and can never be matched by the
    // ObjectId filters used elsewhere in the app. Writing through the model keeps
    // `userId`, `clientId` and `eventDate` in the types the schema declares.
    // Deliberately no `orderBy`: a webinar row can carry a multi-MB base64 video
    // (and now a thumbnail), and MongoDB's in-memory sort aborts once it passes
    // 32MB with `QueryExceededMemoryLimitNoDiskUseAllowed` (error 292). Sorting
    // full documents is the expensive part, so fetch and sort the small per-user
    // set here instead.
    const webinars = await prisma.webinar.findMany({
      where: { userId },
    });
    webinars.sort(
      (a, b) =>
        new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
    );

    // The dashboard list sends `includeVideoFiles=0`; the portal (News & Events,
    // and the meetings preview that embeds it) omits the param and keeps getting
    // the videos it needs to play replays inline.
    const includeVideoFiles =
      request.nextUrl.searchParams.get("includeVideoFiles") !== "0";

    return NextResponse.json({
      success: true,
      data: webinars.map((webinar) =>
        serializeWebinar(webinar, { includeVideoFiles }),
      ),
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
      description,
      thumbnail,
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
      // Stored as base64 for now; a future revision should move this to R2.
      videoFileUrl = videoFile;
    }

    // Create through the Prisma model so the ids land as real ObjectIds and
    // `eventDate` as a BSON date — the raw command stringified all of them, which
    // is what made freshly added webinars invisible to the ObjectId-filtered read.
    const webinar = await prisma.webinar.create({
      data: {
        userId: session.user.id,
        clientId: clientRecord.id,
        clientName: clientRecord.companyName,
        webinarTitle,
        description: typeof description === "string" && description.trim()
          ? description.trim()
          : null,
        thumbnail: typeof thumbnail === "string" && thumbnail ? thumbnail : null,
        eventDate: new Date(eventDate),
        sourceType,
        videoFileUrl,
        videoUrl: sourceType.url ? videoUrl : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeWebinar(webinar),
    });
  } catch (error) {
    console.error("Error creating webinar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
