import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      original_url, 
      square, 
      circle, 
      avatar, 
      crop 
    } = body;

    if (!original_url || !square || !circle || !avatar || !crop) {
      return NextResponse.json(
        { error: "Missing required headshot data" }, 
        { status: 400 }
      );
    }

    // Store the headshot data in the database
    const headshotData = await prisma.headshot.create({
      data: {
        userId: session.user.id,
        originalUrl: original_url,
        square400: square["400"],
        square800: square["800"],
        circle400: circle["400"],
        circle800: circle["800"],
        avatar64: avatar["64"],
        cropData: crop,
        createdAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      headshotId: headshotData.id,
      urls: {
        original_url: headshotData.originalUrl,
        square: {
          "400": headshotData.square400,
          "800": headshotData.square800,
        },
        circle: {
          "400": headshotData.circle400,
          "800": headshotData.circle800,
        },
        avatar: {
          "64": headshotData.avatar64,
        },
        crop: headshotData.cropData,
      },
    });
  } catch (error) {
    console.error("Error processing headshot:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const headshotId = searchParams.get("id");

    if (headshotId) {
      // Get specific headshot
      const headshot = await prisma.headshot.findFirst({
        where: {
          id: headshotId,
          userId: session.user.id,
        },
      });

      if (!headshot) {
        return NextResponse.json(
          { error: "Headshot not found" }, 
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        headshot: {
          id: headshot.id,
          original_url: headshot.originalUrl,
          square: {
            "400": headshot.square400,
            "800": headshot.square800,
          },
          circle: {
            "400": headshot.circle400,
            "800": headshot.circle800,
          },
          avatar: {
            "64": headshot.avatar64,
          },
          crop: headshot.cropData,
          createdAt: headshot.createdAt,
        },
      });
    } else {
      // Get all headshots for user
      const headshots = await prisma.headshot.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return NextResponse.json({
        success: true,
        headshots: headshots.map((headshot) => ({
          id: headshot.id,
          original_url: headshot.originalUrl,
          square: {
            "400": headshot.square400,
            "800": headshot.square800,
          },
          circle: {
            "400": headshot.circle400,
            "800": headshot.circle800,
          },
          avatar: {
            "64": headshot.avatar64,
          },
          crop: headshot.cropData,
          createdAt: headshot.createdAt,
        })),
      });
    }
  } catch (error) {
    console.error("Error fetching headshots:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const headshotId = searchParams.get("id");

    if (!headshotId) {
      return NextResponse.json(
        { error: "Headshot ID is required" }, 
        { status: 400 }
      );
    }

    // Delete the headshot
    const deletedHeadshot = await prisma.headshot.deleteMany({
      where: {
        id: headshotId,
        userId: session.user.id,
      },
    });

    if (deletedHeadshot.count === 0) {
      return NextResponse.json(
        { error: "Headshot not found" }, 
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Headshot deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting headshot:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}

