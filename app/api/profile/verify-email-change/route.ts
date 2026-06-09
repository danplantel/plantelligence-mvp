import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code } = body as { code: string };

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "A valid 6-digit code is required" },
        { status: 400 }
      );
    }

    // Fetch the user's stored verification data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerificationCode: true,
        emailVerificationExpiry: true,
        pendingEmail: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.emailVerificationCode || !user.pendingEmail) {
      return NextResponse.json(
        { error: "No pending email change request. Please request a new code." },
        { status: 400 }
      );
    }

    // Check expiry
    if (
      user.emailVerificationExpiry &&
      new Date() > user.emailVerificationExpiry
    ) {
      // Clear expired data
      await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationCode: null,
          emailVerificationExpiry: null,
          pendingEmail: null,
        },
      });

      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 410 }
      );
    }

    // Check code match
    if (code !== user.emailVerificationCode) {
      return NextResponse.json(
        { error: "Invalid verification code. Please try again." },
        { status: 400 }
      );
    }

    // Code is valid – apply the email change
    const newEmail = user.pendingEmail;

    // Check if new email is now taken (race condition guard)
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json(
        { error: "This email is already registered" },
        { status: 409 }
      );
    }

    // Update the user's email and clear verification fields
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerificationCode: null,
        emailVerificationExpiry: null,
        pendingEmail: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email changed successfully",
      newEmail,
    });
  } catch (error) {
    console.error("Error verifying email change:", error);
    return NextResponse.json(
      { error: "Failed to verify email change" },
      { status: 500 }
    );
  }
}
