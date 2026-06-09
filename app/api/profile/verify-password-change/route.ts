import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword, code } = body as {
      currentPassword: string;
      newPassword: string;
      code: string;
    };

    // Validate inputs
    if (!currentPassword || !newPassword || !code) {
      return NextResponse.json(
        { error: "Current password, new password, and verification code are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password must be at most 128 characters long" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "A valid 6-digit code is required" },
        { status: 400 }
      );
    }

    // Fetch user with password hash and verification data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: true,
        emailVerificationCode: true,
        emailVerificationExpiry: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if there's a pending verification
    if (!user.emailVerificationCode) {
      return NextResponse.json(
        { error: "No pending verification. Please request a new code." },
        { status: 400 }
      );
    }

    // Check expiry
    if (user.emailVerificationExpiry && new Date() > user.emailVerificationExpiry) {
      // Clear expired data
      await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationCode: null,
          emailVerificationExpiry: null,
        },
      });

      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 410 }
      );
    }

    // Verify the code
    if (code !== user.emailVerificationCode) {
      return NextResponse.json(
        { error: "Invalid verification code. Please try again." },
        { status: 400 }
      );
    }

    // Validate current password
    const isValid = await bcrypt.compare(currentPassword, user.password || "");
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash the new password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newPassword, salt);

    // Update the password and clear verification data
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        emailVerificationCode: null,
        emailVerificationExpiry: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error verifying password change:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
