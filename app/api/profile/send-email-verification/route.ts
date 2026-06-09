import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmailVerificationCode } from "@/lib/email";

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { newEmail } = body as { newEmail: string };

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json(
        { error: "Valid new email is required" },
        { status: 400 }
      );
    }

    // Get the current user to retrieve the original email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if new email is the same as current
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "New email is the same as your current email" },
        { status: 400 }
      );
    }

    // Check if new email is already taken by another user
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

    // Generate a 6-digit code
    const code = generateSixDigitCode();

    // Set expiry to 10 minutes from now
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    // Store the code, expiry, and pending email on the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationCode: code,
        emailVerificationExpiry: expiry,
        pendingEmail: newEmail,
      },
    });

    // Send the verification code to the ORIGINAL email
    let emailSent = true;
    let emailError: string | undefined;
    try {
      await sendEmailVerificationCode(user.email, code);
    } catch (emailErr: any) {
      console.error("Error sending email:", emailErr);
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
        message: `Verification code stored but email delivery failed (${emailError}). You can retry with "Resend code" once SMTP is available.`,
        maskedEmail: masked,
      });
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
      message: "Verification code sent to your current email address",
      maskedEmail: masked,
    });
  } catch (error) {
    console.error("Error sending email verification:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
