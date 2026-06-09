import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Clears stale email verification data (code + pendingEmail) from the user record.
 * Useful when a verification flow was started but never completed, leaving the
 * account in a state where the user cannot initiate a new change.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch the user's current email to return it
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Clear any stale verification data
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationCode: null,
        emailVerificationExpiry: null,
        pendingEmail: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Pending email verification cleared. You can now start a fresh change.",
      currentEmail: user.email,
    });
  } catch (error) {
    console.error("Error clearing email verification:", error);
    return NextResponse.json(
      { error: "Failed to clear email verification state" },
      { status: 500 }
    );
  }
}
