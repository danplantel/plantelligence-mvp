import { NextResponse } from "next/server";
import { sendContactFormEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public endpoint backing the Plantelligence-branded `/contact` form.
 * Emails the submission to the recipient passed as `to` (the email associated
 * with the contact card whose "Contact Form" CTA opened the page).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const to = typeof body.to === "string" ? body.to.trim() : "";
    const fromName = typeof body.fromName === "string" ? body.fromName.trim().slice(0, 120) : "";
    const fromEmail = typeof body.fromEmail === "string" ? body.fromEmail.trim().slice(0, 254) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";
    const company = typeof body.company === "string" ? body.company.trim().slice(0, 160) : undefined;

    if (!to || !EMAIL_RE.test(to)) {
      return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
    }
    if (!fromName) {
      return NextResponse.json({ error: "Please provide your name." }, { status: 400 });
    }
    if (!fromEmail || !EMAIL_RE.test(fromEmail)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
    }

    await sendContactFormEmail({
      to,
      fromName,
      fromEmail,
      message,
      company: company || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error processing contact form submission:", error);
    return NextResponse.json(
      { error: "There was a problem sending your message. Please try again." },
      { status: 500 },
    );
  }
}
