import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all completed wizard sessions for this user
    const deletedSessions = await prisma.newClientWizardSession.deleteMany({
      where: {
        userId: session.user.id,
        completed: true
      }
    });

    // Also delete sessions older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deletedOldSessions = await prisma.newClientWizardSession.deleteMany({
      where: {
        userId: session.user.id,
        createdAt: {
          lt: oneDayAgo
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedSessions.count} completed sessions and ${deletedOldSessions.count} old sessions`
    });
  } catch (error) {
    console.error("Error cleaning up wizard sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
