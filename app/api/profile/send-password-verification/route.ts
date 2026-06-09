import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPasswordVerificationCode } from "@/lib/email";

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the user's current email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate a 6-digit code
    const code = generateSixDigitCode();

    // Set expiry to 10 minutes from now
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    // Store the code and expiry on the user (reuse email verification fields)
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationCode: code,
        emailVerificationExpiry: expiry,
        // Don't set pendingEmail — this is for password change, not email change
      },
    });

    // Send the verification code to the user's email
    let emailSent = true;
    let emailError: string | undefined;
    try {
      await sendPasswordVerificationCode(user.email, code);
    } catch (emailErr: any) {
      console.error("Error sending password verification email:", emailErr);
      emailSent = false;
      emailError = emailErr?.message || "SMTP unavailable";
    }

    const masked = user.email.replace(
      /^(.)(.*)(@.*)$/,
      (_: string, first: string, middle: string, domain: string) =>
        first + "*".repeat(Math.min(middle.length, 5)) + domain
    );

    if (!emailSent) {
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: `Verification code stored but email delivery failed (${emailError}).`,
        maskedEmail: masked,
      });
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
      message: "Verification code sent to your email address",
      maskedEmail: masked,
    });
  } catch (error) {
    console.error("Error sending password verification:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
