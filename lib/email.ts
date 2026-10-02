import nodemailer from 'nodemailer';

import { inviterFirmLabel } from "@/lib/teammates/invite-copy";
import { describeRole } from "@/lib/teammates/role-summary";
import {
  PERMISSION_FUNCTIONS,
  PERMISSION_FUNCTION_LABELS,
  PRESET_ROLE_LABELS,
  type PermissionFunction,
  type TeammateAssignmentRole,
  type TeammatePermissionSet,
} from "@/types/teammate";

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.MAIL_HOST || "smtp.mailgun.org",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || process.env.MAIL_USER || "",
    pass:
      process.env.SMTP_PASSWORD ||
      process.env.MAIL_PASS ||
      process.env.MAILGUN_PASSWORD ||
      "",
  },
});

const R2_EMAIL_PUBLIC_URL = "https://pub-bfeeb6eae7f9462db1cb563baeabc8bc.r2.dev";
const logoUrl = `${R2_EMAIL_PUBLIC_URL}/pt_web_dark.png`;
const logoUrlLight = `${R2_EMAIL_PUBLIC_URL}/pt_web_light.png`;
const fromAddress = process.env.MAIL_USER || 'noreply@plantelligence.com';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text alternative (multipart/alternative). */
  text?: string;
  /** Optional Reply-To address. */
  replyTo?: string;
  /** Optional From override (e.g. a personal-looking sender). */
  from?: string;
  /** Optional extra headers (e.g. X-Entity-Ref-ID to stop Gmail trimming/threading). */
  headers?: Record<string, string>;
}

async function sendEmail({ to, subject, html, text, replyTo, from, headers }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: from || `"PlanTelligence®" <${fromAddress}>`,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(headers ? { headers } : {}),
    });
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/** Payload for a submission from the Plantelligence-branded `/contact` form. */
export interface ContactFormSubmission {
  /** Recipient — the contact/advisor email associated with the contact card. */
  to: string;
  fromName: string;
  fromEmail: string;
  message: string;
  company?: string;
  /** "Topic of Interest" choices the participant selected (already active/ordered). */
  topics?: string[];
}

/** Email a `/contact` form submission to the recipient (the contact's email). */
export async function sendContactFormEmail({
  to,
  fromName,
  fromEmail,
  message,
  company,
  topics,
}: ContactFormSubmission) {
  // This is a person-to-person message, so it is intentionally minimal and
  // image-free. Branded HTML with logos/buttons makes Gmail file it under
  // "Promotions", and a generic no-reply automated style files it under
  // "Updates" — a plain, reply-to-a-real-person email stays in the Primary tab.
  const safeName = sanitizeHeaderValue(fromName) || "A visitor";
  const safeEmail = sanitizeHeaderValue(fromEmail);
  const safeCompany = company ? sanitizeHeaderValue(company) : "";
  // Participant-selected topics (labels only; the free-text "Other" detail is
  // appended to the label client-side).
  const safeTopics = (topics || [])
    .map((topic) => (topic || "").replace(/[\r\n]+/g, " ").trim().slice(0, 160))
    .filter((topic) => topic.length > 0)
    .slice(0, 40);

  const html = `
    <div style="margin:0;padding:32px 16px;background-color:#f2f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;">
        <img src="${logoUrl}" alt="PlanTelligence®" width="132" style="display:block;border:0;max-width:132px;height:auto;margin:0 0 22px;" />

        <div style="width:40px;height:3px;background-color:#0a3a40;border-radius:3px;margin:0 0 20px;"></div>
        <h1 style="margin:0 0 22px;font-size:19px;font-weight:600;letter-spacing:-0.01em;color:#111827;">New message from the PlanTelligence® contact form</h1>

        <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#111827;">From: ${escapeHtml(safeName)}</p>
        <p style="margin:0 0 22px;font-size:13px;color:#6b7280;">
          <a href="mailto:${escapeHtml(safeEmail)}" style="color:#0a7d8a;text-decoration:none;">${escapeHtml(safeEmail)}</a>
        </p>

        <div style="padding:16px 18px;background-color:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;font-size:15px;line-height:1.65;color:#333333;white-space:pre-wrap;">${escapeHtml(message.trim())}</div>

        ${
          safeTopics.length
            ? `<div style="margin:20px 0 0;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;">Topic of Interest</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.7;color:#333333;">
            ${safeTopics
              .map((topic) => `<li>${escapeHtml(topic)}</li>`)
              .join("")}
          </ul>
        </div>`
            : ""
        }

        <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">
          Reply directly to this email to reach ${escapeHtml(safeName)}.
        </p>

        <div style="margin-top:28px;padding-top:16px;border-top:1px solid #eef1f5;font-size:12px;line-height:1.6;color:#9aa0a6;">
          Sent via PlanTelligence® &middot; This message was delivered through the contact form.
        </div>
      </div>
    </div>
  `;
  // Neutralize any leading ">" in the plain-text part so Gmail can't detect it
  // as quoted content (which would add a "show trimmed content" control).
  const textSafeMessage = message
    .trim()
    .split("\n")
    .map((line) => (line.startsWith(">") ? ` ${line}` : line))
    .join("\n");
  const text = [
    `${safeName} sent you a message through the contact form.`,
    ...(safeCompany ? ["", `Company: ${safeCompany}`] : []),
    ...(safeTopics.length
      ? ["", "Topic of Interest:", ...safeTopics.map((topic) => `- ${topic}`)]
      : []),
    "",
    textSafeMessage,
    "",
    `Reply directly to this email to reach ${safeName} at ${safeEmail}.`,
    "",
    "Sent via PlanTelligence",
  ].join("\n");
  const subject = `New message from ${safeName}`;
  // A unique X-Entity-Ref-ID stops Gmail from bundling this into a conversation
  // and collapsing the body behind a "show trimmed content" control.
  const entityRefId = `contact-form-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  return sendEmail({
    to,
    subject,
    html,
    text,
    replyTo: safeEmail,
    from: `"${safeName} (via PlanTelligence)" <${fromAddress}>`,
    headers: { "X-Entity-Ref-ID": entityRefId },
  });
}

/** Strip CR/LF/quotes so user input is safe in email headers (From/Reply-To/Subject). */
function sanitizeHeaderValue(value: string): string {
  return (value || "")
    .replace(/[\r\n"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Minimal HTML-escape helper for user-provided content in emails. */
function escapeHtml(value: string): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  const apos = "&" + "#039;";
  return value
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
}

export async function sendVideoCreationEmail(userEmail: string, videoName: string) {
  const subject = 'Your Video Creation Has Started';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Video Creation Started</h2>
      <p>Hello,</p>
      <p>We've started creating your video "${videoName}". This process typically takes 5-10 minutes.</p>
      <p>We'll send you another email when your video is ready!</p>
      <p>Best regards,<br>The PlanTelligence® Team</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

export async function sendVideoCompletionEmail(userEmail: string, videoName: string, videoUrl: string) {
  const subject = 'Your Video is Ready!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Video Ready for Viewing</h2>
      <p>Hello,</p>
      <p>Great news! Your video "${videoName}" is now ready to view.</p>
      <p><a href="${videoUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">View Your Video</a></p>
      <p>Best regards,<br>The PlanTelligence® Team</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

export async function sendEmailVerificationCode(originalEmail: string, code: string) {
  const subject = 'Email Change Verification – PlanTelligence®';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
            @media (prefers-color-scheme: dark) {
                .email-body { background-color: #1a1a2e !important; }
                .email-card { background-color: #16213e !important; }
                .email-text { color: #e0e0e0 !important; }
                .email-text-secondary { color: #a0a0b0 !important; }
                .code-box { background-color: #0f3460 !important; border-color: #1a4a7a !important; }
                .code-text { color: #ffffff !important; }
                .divider { background-color: #2a2a4a !important; }
                .logo-default { display: none !important; }
                .logo-dark { display: block !important; }
            }
            @media (prefers-color-scheme: light) {
                .logo-dark { display: none !important; }
            }
        </style>
    </head>
    <body class="email-body" style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9;">
            <tr>
                <td align="center" style="padding: 40px 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
                        <!-- Logo -->
                        <tr>
                            <td align="center" style="padding-bottom: 24px;">
                                <img src="${logoUrl}" alt="PlanTelligence®" width="220" class="logo-default" style="display: inline; max-width: 220px; height: auto; border: 0;" />
                                <img src="${logoUrlLight}" alt="PlanTelligence®" width="220" class="logo-dark" style="display: none; max-width: 220px; height: auto; border: 0;" />
                            </td>
                        </tr>
                        <!-- Card -->
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px 32px;">
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <h1 class="email-text" style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">Verify Your Email Change</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                A request was made to change the email address associated with your PlanTelligence® account. Enter the code below to confirm this change.
                                            </p>
                                        </td>
                                    </tr>
                                    <!-- Code Box -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <table cellpadding="0" cellspacing="0" border="0" class="code-box" style="background-color: #f0f4ff; border: 1px solid #d0d9f0; border-radius: 10px; padding: 16px 32px; display: inline-block;">
                                                <tr>
                                                    <td align="center">
                                                        <span class="code-text" style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a3a6a; font-family: 'Courier New', Courier, monospace;">${code}</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 14px; color: #666680; line-height: 1.5;">
                                                This code will expire in <strong>10 minutes</strong>. If you did not request this change, please ignore this email or contact support.
                                            </p>
                                        </td>
                                    </tr>
                                    <!-- Divider -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px; padding-top: 8px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider" style="height: 1px; background-color: #e0e0e8; width: 100%;"><tr><td style="height: 1px; line-height: 1px;">&nbsp;</td></tr></table>
                                        </td>
                                    </tr>
                                    <!-- Footer -->
                                    <tr>
                                        <td align="center">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                Need help? Contact us at<br/>
                                                <a href="mailto:support@plantelligence.ai" style="color: #1a3a6a; text-decoration: underline;">support@plantelligence.ai</a>
                                            </p>
                                            <p class="email-text-secondary" style="margin: 16px 0 0 0; font-size: 12px; color: #a0a0b0;">
                                                &copy; ${new Date().getFullYear()} PlanTelligence®. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;

  return sendEmail({ to: originalEmail, subject, html });
}

export async function sendPasswordVerificationCode(userEmail: string, code: string) {
  const subject = 'Password Change Verification – PlanTelligence®';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
            @media (prefers-color-scheme: dark) {
                .email-body { background-color: #1a1a2e !important; }
                .email-card { background-color: #16213e !important; }
                .email-text { color: #e0e0e0 !important; }
                .email-text-secondary { color: #a0a0b0 !important; }
                .code-box { background-color: #0f3460 !important; border-color: #1a4a7a !important; }
                .code-text { color: #ffffff !important; }
                .divider { background-color: #2a2a4a !important; }
                .logo-default { display: none !important; }
                .logo-dark { display: block !important; }
            }
            @media (prefers-color-scheme: light) {
                .logo-dark { display: none !important; }
            }
        </style>
    </head>
    <body class="email-body" style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9;">
            <tr>
                <td align="center" style="padding: 40px 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
                        <!-- Logo -->
                        <tr>
                            <td align="center" style="padding-bottom: 24px;">
                                <img src="${logoUrl}" alt="PlanTelligence®" width="220" class="logo-default" style="display: inline; max-width: 220px; height: auto; border: 0;" />
                                <img src="${logoUrlLight}" alt="PlanTelligence®" width="220" class="logo-dark" style="display: none; max-width: 220px; height: auto; border: 0;" />
                            </td>
                        </tr>
                        <!-- Card -->
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px 32px;">
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <h1 class="email-text" style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">Verify Your Password Change</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                A request was made to change the password associated with your PlanTelligence® account. Enter the code below to confirm this change.
                                            </p>
                                        </td>
                                    </tr>
                                    <!-- Code Box -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <table cellpadding="0" cellspacing="0" border="0" class="code-box" style="background-color: #f0f4ff; border: 1px solid #d0d9f0; border-radius: 10px; padding: 16px 32px; display: inline-block;">
                                                <tr>
                                                    <td align="center">
                                                        <span class="code-text" style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a3a6a; font-family: 'Courier New', Courier, monospace;">${code}</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 14px; color: #666680; line-height: 1.5;">
                                                This code will expire in <strong>10 minutes</strong>. If you did not request this change, please ignore this email or contact support.
                                            </p>
                                        </td>
                                    </tr>
                                    <!-- Divider -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px; padding-top: 8px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider" style="height: 1px; background-color: #e0e0e8; width: 100%;"><tr><td style="height: 1px; line-height: 1px;">&nbsp;</td></tr></table>
                                        </td>
                                    </tr>
                                    <!-- Footer -->
                                    <tr>
                                        <td align="center">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                Need help? Contact us at<br/>
                                                <a href="mailto:support@plantelligence.ai" style="color: #1a3a6a; text-decoration: underline;">support@plantelligence.ai</a>
                                            </p>
                                            <p class="email-text-secondary" style="margin: 16px 0 0 0; font-size: 12px; color: #a0a0b0;">
                                                &copy; ${new Date().getFullYear()} PlanTelligence®. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

export async function sendSignUpConfirmationEmail(userEmail: string, userName?: string) {
  const subject = 'Welcome to PlanTelligence® – Your Account Has Been Created';
  const firstName = (userName || "").trim().split(" ")[0] || "there";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  const signInUrl = `${baseUrl}/signin`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
            @media (prefers-color-scheme: dark) {
                .email-body { background-color: #1a1a2e !important; }
                .email-card { background-color: #16213e !important; }
                .email-text { color: #e0e0e0 !important; }
                .email-text-secondary { color: #a0a0b0 !important; }
                .button { background-color: #3a7bd5 !important; }
                .divider { background-color: #2a2a4a !important; }
                .logo-default { display: none !important; }
                .logo-dark { display: block !important; }
            }
            @media (prefers-color-scheme: light) {
                .logo-dark { display: none !important; }
            }
        </style>
    </head>
    <body class="email-body" style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9;">
            <tr>
                <td align="center" style="padding: 40px 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
                        <!-- Logo -->
                        <tr>
                            <td align="center" style="padding-bottom: 24px;">
                                <img src="${logoUrl}" alt="PlanTelligence®" width="220" class="logo-default" style="display: inline; max-width: 220px; height: auto; border: 0;" />
                                <img src="${logoUrlLight}" alt="PlanTelligence®" width="220" class="logo-dark" style="display: none; max-width: 220px; height: auto; border: 0;" />
                            </td>
                        </tr>
                        <!-- Card -->
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px 32px;">
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <h1 class="email-text" style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">Welcome to PlanTelligence®</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 16px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                Hi ${firstName},
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                Your PlanTelligence® account has been created successfully. We're excited to have you on board!
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                You can now sign in to start building, managing, and sharing your benefits communications.
                                            </p>
                                        </td>
                                    </tr>
                                    <!-- CTA Button -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <a href="${signInUrl}" class="button" style="display: inline-block; padding: 12px 32px; background-color: #1a3a6a; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px;">Sign In to Your Account</a>
                                        </td>
                                    </tr>
                                    <!-- Divider -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px; padding-top: 8px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider" style="height: 1px; background-color: #e0e0e8; width: 100%;"><tr><td style="height: 1px; line-height: 1px;">&nbsp;</td></tr></table>
                                        </td>
                                    </tr>
                                    <!-- Footer -->
                                    <tr>
                                        <td align="center">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                Need help? Contact us at<br/>
                                                <a href="mailto:support@plantelligence.ai" style="color: #1a3a6a; text-decoration: underline;">support@plantelligence.ai</a>
                                            </p>
                                            <p class="email-text-secondary" style="margin: 16px 0 0 0; font-size: 12px; color: #a0a0b0;">
                                                &copy; ${new Date().getFullYear()} PlanTelligence®. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

export async function sendSignInNotificationEmail(userEmail: string, userName?: string) {
  const subject = 'New Sign-In to Your PlanTelligence® Account';
  const firstName = (userName || "").trim().split(" ")[0] || "there";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  const dashboardUrl = `${baseUrl}/dashboard`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
            @media (prefers-color-scheme: dark) {
                .email-body { background-color: #1a1a2e !important; }
                .email-card { background-color: #16213e !important; }
                .email-text { color: #e0e0e0 !important; }
                .email-text-secondary { color: #a0a0b0 !important; }
                .button { background-color: #3a7bd5 !important; }
                .divider { background-color: #2a2a4a !important; }
                .logo-default { display: none !important; }
                .logo-dark { display: block !important; }
            }
            @media (prefers-color-scheme: light) {
                .logo-dark { display: none !important; }
            }
        </style>
    </head>
    <body class="email-body" style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9;">
            <tr>
                <td align="center" style="padding: 40px 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
                        <!-- Logo -->
                        <tr>
                            <td align="center" style="padding-bottom: 24px;">
                                <img src="${logoUrl}" alt="PlanTelligence®" width="220" class="logo-default" style="display: inline; max-width: 220px; height: auto; border: 0;" />
                                <img src="${logoUrlLight}" alt="PlanTelligence®" width="220" class="logo-dark" style="display: none; max-width: 220px; height: auto; border: 0;" />
                            </td>
                        </tr>
                        <!-- Card -->
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px 32px;">
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <h1 class="email-text" style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">New Sign-In to Your Account</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 16px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                Hi ${firstName},
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                We noticed a new sign-in to your PlanTelligence® account.
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                If this was you, no further action is needed. If you didn't initiate this sign-in, please contact support immediately to help secure your account.
                                            </p>
                                        </td>
                                    </tr>
                                    <!-- CTA Button -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <a href="${dashboardUrl}" class="button" style="display: inline-block; padding: 12px 32px; background-color: #1a3a6a; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px;">Go to Your Dashboard</a>
                                        </td>
                                    </tr>
                                    <!-- Divider -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px; padding-top: 8px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider" style="height: 1px; background-color: #e0e0e8; width: 100%;"><tr><td style="height: 1px; line-height: 1px;">&nbsp;</td></tr></table>
                                        </td>
                                    </tr>
                                    <!-- Footer -->
                                    <tr>
                                        <td align="center">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                Need help? Contact us at<br/>
                                                <a href="mailto:support@plantelligence.ai" style="color: #1a3a6a; text-decoration: underline;">support@plantelligence.ai</a>
                                            </p>
                                            <p class="email-text-secondary" style="margin: 16px 0 0 0; font-size: 12px; color: #a0a0b0;">
                                                &copy; ${new Date().getFullYear()} PlanTelligence®. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

export async function sendPasswordChangedConfirmationEmail(userEmail: string, userName?: string) {
  const subject = 'Your Password Was Successfully Changed – PlanTelligence®';
  const firstName = (userName || "").trim().split(" ")[0] || "there";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
            @media (prefers-color-scheme: dark) {
                .email-body { background-color: #1a1a2e !important; }
                .email-card { background-color: #16213e !important; }
                .email-text { color: #e0e0e0 !important; }
                .email-text-secondary { color: #a0a0b0 !important; }
                .divider { background-color: #2a2a4a !important; }
                .logo-default { display: none !important; }
                .logo-dark { display: block !important; }
            }
            @media (prefers-color-scheme: light) {
                .logo-dark { display: none !important; }
            }
        </style>
    </head>
    <body class="email-body" style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9;">
            <tr>
                <td align="center" style="padding: 40px 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
                        <!-- Logo -->
                        <tr>
                            <td align="center" style="padding-bottom: 24px;">
                                <img src="${logoUrl}" alt="PlanTelligence®" width="220" class="logo-default" style="display: inline; max-width: 220px; height: auto; border: 0;" />
                                <img src="${logoUrlLight}" alt="PlanTelligence®" width="220" class="logo-dark" style="display: none; max-width: 220px; height: auto; border: 0;" />
                            </td>
                        </tr>
                        <!-- Card -->
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px 32px;">
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <h1 class="email-text" style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">Your Password Was Changed</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 16px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                Hi ${firstName},
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                The password for your PlanTelligence® account was successfully changed.
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                If this was you, no further action is needed. If you didn't make this change, please contact support immediately to help secure your account.
                                            </p>
                                        </td>
                                    </tr>
                                    <!-- Divider -->
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px; padding-top: 8px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider" style="height: 1px; background-color: #e0e0e8; width: 100%;"><tr><td style="height: 1px; line-height: 1px;">&nbsp;</td></tr></table>
                                        </td>
                                    </tr>
                                    <!-- Footer -->
                                    <tr>
                                        <td align="center">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                Need help? Contact us at<br/>
                                                <a href="mailto:support@plantelligence.ai" style="color: #1a3a6a; text-decoration: underline;">support@plantelligence.ai</a>
                                            </p>
                                            <p class="email-text-secondary" style="margin: 16px 0 0 0; font-size: 12px; color: #a0a0b0;">
                                                &copy; ${new Date().getFullYear()} PlanTelligence®. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

/** Payload for the T4 collaborator invite raised from Create Benefits. */
export interface CollaboratorInviteEmailInput {
  to: string;
  /** The invitee; only the first name is used in the greeting. */
  collaboratorName?: string | null;
  /** The advisor who sent the invite. */
  inviterName?: string | null;
  /** Their firm, shown so an external recipient knows who is asking. */
  organizationName?: string | null;
  planName: string;
  category: string;
  /**
   * T5 invites to a set of categories at once. When two or more are given the copy
   * lists the sections instead of calling them one section.
   */
  categories?: string[];
  /** The "Who is this?" label, e.g. "Plan Sponsor HR". */
  inviteContext: string;
  /** Absolute deep link to the assigned benefit section. */
  sectionUrl: string;
  /**
   * T9: the link that accepts the invitation. The email leads with this, because an
   * external invitee has no account yet — "Open the section" leads to a sign-in wall for
   * them. The section link stays as a secondary action, which is what an
   * already-accepted collaborator needs on a re-invite.
   */
  acceptUrl?: string | null;
  /** What still needs filling in on that section, straight from the completeness check. */
  missingFields: string[];
  note?: string | null;
  dueDate?: Date | null;
}

/**
 * The value for one scope row of the invitation details, or `null` to leave the row out.
 *
 * The three inputs mean different things and must not collapse into each other:
 *
 *   - `null`      — the caller states the scope covers EVERYTHING → the "all" label is shown;
 *   - a list      — the named members are listed;
 *   - `undefined` — the caller did not report a scope at all → the row is omitted, because
 *                   claiming "All plans" from silence is a promise we cannot keep, and an
 *                   empty row would be worse than no row.
 *
 * An empty ARRAY therefore also omits the row: the caller told us the scope is narrowed but
 * could not name what it covers, and neither the label nor a blank is true.
 */
function scopeRowValue(
  names: string[] | null | undefined,
  allLabel: string,
): string | null {
  if (names === null) return allLabel;
  if (!Array.isArray(names)) return null;
  const cleaned = names.map((name) => (name || "").trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(", ") : null;
}

/** Payload for the promotion email: a Contact becoming a Team Member. */
export interface TeamMemberInviteEmailInput {
  to: string;
  /** The promoted person; only the first name is used in the greeting. */
  memberName?: string | null;
  /** The advisor who promoted them. */
  inviterName?: string | null;
  /** Their firm, shown so the recipient knows who acted. */
  organizationName?: string | null;
  /**
   * The plan the recipient is being brought in for, when the caller knows which one.
   *
   * Named in the subject INSTEAD of the firm when present. A solo advisor's Organization
   * mirrors their own `User` row, so in that — the common — case the firm reads as the
   * inviter's name a second time ("Eddie Taliaferro added you to Eddie Taliaferro"), which
   * tells the recipient nothing. The plan is the thing they can recognise.
   */
  planName?: string | null;
  /**
   * T9: the link that activates the account. Required, not optional — the entire purpose
   * of this email is that the recipient has no account yet and cannot sign in.
   */
  acceptUrl: string;
  /** How long the invitation stays valid, in days, for the copy. */
  expiresInDays?: number;
  /**
   * The role recorded on the assignment, rendered with its preset label ("Editor").
   *
   * The preset's one-line description is added from `lib/teammates/role-summary.ts`, which
   * derives it from the very grids `PRESET_PERMISSION_GRIDS` feeds the API — so the sentence
   * cannot describe a role the enforcement would not recognise.
   */
  role?: TeammateAssignmentRole | null;
  /**
   * The permission grid STORED on the assignment — never the preset the role name implies.
   *
   * The stored grid is what the API enforces, and a Custom role stores an edited one on this
   * same row, so reading it back is the only way to show the recipient the access that was
   * given rather than the access their role usually carries. Omitted, or nothing to report →
   * the permission lines are left out and the email says nothing about them.
   */
  permissions?: TeammatePermissionSet | null;
  /**
   * Plan names the invitation covers, when it is narrower than the whole organization.
   * `null` means "every plan" (the caller knows the scope is org-wide) and renders "All plans".
   */
  planNames?: string[] | null;
  /** Benefit categories covered; `null` means all of them. See `scopeRowValue`. */
  categories?: string[] | null;
}

/**
 * Tell somebody they have been added to a team, and give them the link that activates it.
 *
 * Deliberately NOT `sendCollaboratorInviteEmail` with rearranged arguments. That template
 * is built around an external helper being asked to fill in a specific benefit section:
 * `planName`, `category`, `inviteContext` and `sectionUrl` are all required, and its copy
 * says "help complete the Group Life section". None of that is true for a colleague being
 * given account access, and forcing it through would send them a description of work they
 * were never asked to do.
 *
 * The acceptance link is the only action, because an invitee with no account has nowhere
 * else to go.
 */
export async function sendTeamMemberInviteEmail({
  to,
  memberName,
  inviterName,
  organizationName,
  planName,
  acceptUrl,
  expiresInDays,
  role,
  permissions,
  planNames,
  categories,
}: TeamMemberInviteEmailInput) {
  const firstName = (memberName || "").trim().split(" ")[0] || "there";
  const inviter =
    (inviterName || "").trim() || organizationName?.trim() || "Your benefits advisor";
  /**
   * The firm is only worth naming when it says something the inviter's name does not — see
   * `inviterFirmLabel`. The accept page asks the same question for its "on behalf of …"
   * clause, so the rule lives there and both surfaces word one invitation the same way.
   */
  const namedFirm = inviterFirmLabel(inviterName, organizationName);

  /**
   * What the recipient is being brought into: the plan they are being given access to when
   * the caller knows which one, otherwise the firm, otherwise nothing (and the copy falls
   * back to "their team", which is at least true).
   */
  const destination = planName?.trim() || namedFirm;

  // Interpolated user data is escaped here, unlike the older templates. A person's display
  // name and an organization name are free text an advisor typed, and this one is
  // rendered inside a styled button-adjacent block where a stray tag would break the
  // layout rather than merely look wrong.
  const safeInviter = escapeHtml(inviter);
  const safeFirm = namedFirm ? escapeHtml(namedFirm) : "";
  const safeDestination = destination ? escapeHtml(destination) : "";
  const validFor =
    typeof expiresInDays === "number" && expiresInDays > 0
      ? `
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                This invitation expires in ${expiresInDays} days.
                                            </p>
                                        </td>
                                    </tr>`
      : "";

  // ── What is being offered ───────────────────────────────────────────────────────
  //
  // Rendered twice — the HTML block in the body and the plain-text alternative — so the two
  // halves of one email cannot describe different access. The labels are ours; every VALUE
  // arrives from the caller and is escaped, because an organization name, a plan name and a
  // benefit-category name are all free text an advisor typed.
  const roleLabel = role ? PRESET_ROLE_LABELS[role] : "";
  /**
   * The role's one-line description, DERIVED from the same preset grids the API enforces
   * (`lib/teammates/role-summary.ts`). Skipped for a Custom role: there is no preset to
   * describe, and the grid lines below say what this person was actually given.
   */
  const roleSummary = role && role !== "custom" ? describeRole(role).summary : "";

  /**
   * The stored grid, grouped by what it allows.
   *
   * Read from `permissions` — the grid the assignment STORES — rather than from the role's
   * preset: a Custom role stores an edited grid on that same row, so only the stored grid can
   * be promised back to the recipient. The caller passes it through `normalizePermissionSet`,
   * so every one of the 14 functions is decided and none can be omitted by accident.
   *
   * `no_access` and `not_allowed` are grouped into one line: different radio labels in the UI,
   * the same outcome here, and together they are the honest answer to "what can't I do?".
   */
  const permissionLines: { label: string; value: string }[] = [];
  if (permissions) {
    const canEdit: string[] = [];
    const canView: string[] = [];
    const canDo: string[] = [];
    const noAccess: string[] = [];
    for (const fn of PERMISSION_FUNCTIONS as readonly PermissionFunction[]) {
      const access = permissions[fn];
      const label = PERMISSION_FUNCTION_LABELS[fn];
      if (access === "edit") canEdit.push(label);
      else if (access === "view") canView.push(label);
      else if (access === "allowed") canDo.push(label);
      else noAccess.push(label);
    }
    if (canEdit.length) {
      permissionLines.push({ label: "Can edit", value: canEdit.join(", ") });
    }
    if (canView.length) {
      permissionLines.push({ label: "Can view", value: canView.join(", ") });
    }
    if (canDo.length) {
      permissionLines.push({ label: "Can do", value: canDo.join(", ") });
    }
    if (noAccess.length) {
      permissionLines.push({ label: "No access", value: noAccess.join(", ") });
    }
  }

  const detailLines: { label: string; value: string }[] = [];
  const firm = (organizationName || "").trim();
  if (firm) detailLines.push({ label: "Organization", value: firm });
  if (roleLabel) {
    detailLines.push({
      label: "Role",
      value: roleSummary ? `${roleLabel} — ${roleSummary}` : roleLabel,
    });
  }
  const planValue = scopeRowValue(planNames, "All plans");
  if (planValue) detailLines.push({ label: "Plans", value: planValue });
  const categoryValue = scopeRowValue(categories, "All benefit categories");
  if (categoryValue) {
    detailLines.push({ label: "Benefit categories", value: categoryValue });
  }
  detailLines.push(...permissionLines);

  /**
   * One two-column row per detail.
   *
   * Two COLUMNS rather than one sentence: the labels differ in length ("Role" against "Benefit
   * categories"), so `Label: value` started every value at a different x-position and the block
   * read as a ragged paragraph. A fixed label column lines the values up, which is what makes the
   * details scannable — and every row is one `<tr>` of the same shape, so the vertical rhythm is
   * even by construction rather than held together by ad-hoc padding.
   *
   * `valign="top"` keeps a value level with ITS label when it wraps (the permission lists do)
   * instead of drifting to the middle of the row. The label keeps its colon because that is how
   * the plain-text alternative writes the same row.
   */
  const detailRows = detailLines
    .map(
      ({ label, value }) => `
                                                <tr>
                                                    <td align="left" valign="top" width="150" class="email-text-secondary" style="padding: 0 12px 8px 0; font-size: 14px; line-height: 1.6; color: #666680;">${escapeHtml(label)}:</td>
                                                    <td align="left" valign="top" class="email-text" style="padding: 0 0 8px 0; font-size: 14px; font-weight: 600; line-height: 1.6; color: #1a1a2e;">${escapeHtml(value)}</td>
                                                </tr>`,
    )
    .join("");

  /**
   * The details block, or nothing at all when the caller reported none of them.
   *
   * Built from the existing `.email-text` / `.email-text-secondary` classes so it adapts to a
   * dark client's colour scheme (both have overrides above) — a hard-coded fill would have
   * needed a third class and a second place to keep the two templates in step.
   */
  const detailsBlock = detailLines.length
    ? `
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <!-- Full width of the card rather than a 420px column: the
                                                 rows are tabular now, and the fixed label column
                                                 comes out of the value's room. -->
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td align="center" style="padding-bottom: 10px;">
                                                        <p class="email-text" style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a2e;">Your invitation</p>
                                                    </td>
                                                </tr>${detailRows}
                                            </table>
                                        </td>
                                    </tr>`
    : "";

  const subject = safeDestination
    ? `${safeInviter} added you to ${safeDestination} on PlanTelligence`
    : `${safeInviter} added you to their team on PlanTelligence`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
            @media (prefers-color-scheme: dark) {
                .email-body { background-color: #1a1a2e !important; }
                .email-card { background-color: #16213e !important; }
                .email-text { color: #e0e0e0 !important; }
                .email-text-secondary { color: #a0a0b0 !important; }
                .button { background-color: #3a7bd5 !important; }
                .divider { background-color: #2a2a4a !important; }
                .logo-default { display: none !important; }
                .logo-dark { display: block !important; }
            }
            @media (prefers-color-scheme: light) {
                .logo-dark { display: none !important; }
            }
        </style>
    </head>
    <body class="email-body" style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9;">
            <tr>
                <td align="center" style="padding: 40px 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
                        <tr>
                            <td align="center" style="padding-bottom: 24px;">
                                <img src="${logoUrl}" alt="PlanTelligence®" width="220" class="logo-default" style="display: inline; max-width: 220px; height: auto; border: 0;" />
                                <img src="${logoUrlLight}" alt="PlanTelligence®" width="220" class="logo-dark" style="display: none; max-width: 220px; height: auto; border: 0;" />
                            </td>
                        </tr>
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px 32px;">
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <h1 class="email-text" style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">You have been added to the team</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 16px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">Hi ${escapeHtml(firstName)},</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.6;">
                                                ${safeInviter}${safeFirm && inviterName?.trim() ? ` (${safeFirm})` : ""} added you as a <strong style="color: #1a1a2e;">Team Member</strong> on PlanTelligence.
                                            </p>
                                        </td>
                                    </tr>${detailsBlock}
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.6;">
                                                Choose a password to activate your account, then you can sign in at any time.
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td align="center" class="button" style="background-color: #1a3a6a; border-radius: 8px;">
                                                        <a href="${acceptUrl}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Accept the invitation</a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>${validFor}
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                If the button does not work, paste this into your browser:<br/>
                                                <a href="${acceptUrl}" style="color: #1a3a6a; text-decoration: underline; word-break: break-all;">${acceptUrl}</a>
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px; padding-top: 8px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider" style="height: 1px; background-color: #e0e0e8; width: 100%;"><tr><td style="height: 1px; line-height: 1px;">&nbsp;</td></tr></table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                Need help? Contact us at<br/>
                                                <a href="mailto:support@plantelligence.ai" style="color: #1a3a6a; text-decoration: underline;">support@plantelligence.ai</a>
                                            </p>
                                            <p class="email-text-secondary" style="margin: 16px 0 0 0; font-size: 12px; color: #a0a0b0;">
                                                &copy; ${new Date().getFullYear()} PlanTelligence®. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: [
      `Hi ${firstName},`,
      ``,
      `${inviter} added you as a Team Member on PlanTelligence.`,
      // The same rows as the HTML block, then a blank line so the "what you can do" list is
      // visually separated from the sentence that follows it.
      ...(detailLines.length
        ? ["", ...detailLines.map(({ label, value }) => `${label}: ${value}`), ""]
        : []),
      `Choose a password to activate your account, then you can sign in at any time.`,
      ``,
      `Accept the invitation: ${acceptUrl}`,
      ...(typeof expiresInDays === "number" && expiresInDays > 0
        ? [``, `This invitation expires in ${expiresInDays} days.`]
        : []),
    ].join("\n"),
  });
}

/**
 * Invite an external collaborator to complete one benefit section.
 *
 * Scope comes entirely from the arguments: this template never decides which plan
 * or category is in play, it only renders the deep link and the missing-field list
 * the caller computed, so the email cannot describe an assignment that differs
 * from the one that was written.
 */
export async function sendCollaboratorInviteEmail({
  to,
  collaboratorName,
  inviterName,
  organizationName,
  planName,
  category,
  categories,
  inviteContext,
  sectionUrl,
  acceptUrl,
  missingFields,
  note,
  dueDate,
}: CollaboratorInviteEmailInput) {
  const firstName = (collaboratorName || "").trim().split(" ")[0] || "there";
  const inviter = (inviterName || "").trim() || organizationName?.trim() || "Your benefits advisor";
  const firm = organizationName?.trim();

  // One category reads as "the Group Health section"; several are named, because
  // "the Group Health, Group Life section" is not a sentence.
  const targets = categories && categories.length > 1 ? categories : [category];
  const sectionLabel = targets.length > 1 ? `${targets.length} benefit sections` : targets[0];
  const sectionPhrase =
    targets.length > 1
      ? `the <strong style="color: #1a1a2e;">${targets.join(", ")}</strong> sections`
      : `the <strong style="color: #1a1a2e;">${targets[0]}</strong> section`;
  const sectionPhraseText =
    targets.length > 1 ? `the ${targets.join(", ")} sections` : `the ${targets[0]} section`;

  // T9: the invitation is redeemed first, the section is opened second. An invitee who
  // already accepted (or already has access) can skip straight to the work, so the
  // section link stays present as the secondary action.
  const acceptLink = (acceptUrl ?? "").trim();
  const primaryUrl = acceptLink || sectionUrl;
  const primaryLabel = acceptLink ? "Accept the invitation" : "Open the section";
  const secondaryBlock = acceptLink
    ? `
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                Already set up? <a href="${sectionUrl}" style="color: #1a3a6a; text-decoration: underline;">Open the section</a>
                                            </p>
                                        </td>
                                    </tr>`
    : "";

  const subject = `${inviter} invited you to help with ${planName} — ${sectionLabel}`;

  const missingRows =
    missingFields.length > 0
      ? missingFields
          .map(
            (field) => `
                                    <tr>
                                        <td style="padding: 2px 0 2px 14px; font-size: 14px; color: #666680; line-height: 1.6;">&bull;&nbsp; ${field}</td>
                                    </tr>`,
          )
          .join("")
      : "";

  const missingBlock =
    missingFields.length > 0
      ? `
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <p class="email-text" style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a2e;">
                                                Still needed on this section
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 420px;">${missingRows}
                                            </table>
                                        </td>
                                    </tr>`
      : "";

  const dueBlock = dueDate
    ? `
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 14px; color: #666680; line-height: 1.5;">
                                                Please complete it by <strong style="color: #1a1a2e;">${dueDate.toLocaleDateString(
                                                  "en-US",
                                                  {
                                                    month: "long",
                                                    day: "numeric",
                                                    year: "numeric",
                                                    timeZone: "UTC",
                                                  },
                                                )}</strong>.
                                            </p>
                                        </td>
                                    </tr>`
    : "";

  const noteBlock = (note || "").trim()
    ? `
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left: 3px solid #3a7bd5; background-color: #f4f6f9; border-radius: 6px;">
                                                <tr>
                                                    <td style="padding: 14px 16px;">
                                                        <p class="email-text-secondary" style="margin: 0; font-size: 14px; color: #666680; line-height: 1.6; font-style: italic;">
                                                            ${(note || "").trim()}
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
            @media (prefers-color-scheme: dark) {
                .email-body { background-color: #1a1a2e !important; }
                .email-card { background-color: #16213e !important; }
                .email-text { color: #e0e0e0 !important; }
                .email-text-secondary { color: #a0a0b0 !important; }
                .button { background-color: #3a7bd5 !important; }
                .divider { background-color: #2a2a4a !important; }
                .logo-default { display: none !important; }
                .logo-dark { display: block !important; }
            }
            @media (prefers-color-scheme: light) {
                .logo-dark { display: none !important; }
            }
        </style>
    </head>
    <body class="email-body" style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9;">
            <tr>
                <td align="center" style="padding: 40px 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
                        <tr>
                            <td align="center" style="padding-bottom: 24px;">
                                <img src="${logoUrl}" alt="PlanTelligence®" width="220" class="logo-default" style="display: inline; max-width: 220px; height: auto; border: 0;" />
                                <img src="${logoUrlLight}" alt="PlanTelligence®" width="220" class="logo-dark" style="display: none; max-width: 220px; height: auto; border: 0;" />
                            </td>
                        </tr>
                        <tr>
                            <td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px 32px;">
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <h1 class="email-text" style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">You have been invited to collaborate</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 16px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">Hi ${firstName},</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 16px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.6;">
                                                ${inviter}${firm && inviterName?.trim() ? ` (${firm})` : ""} invited you as <strong style="color: #1a1a2e;">${inviteContext}</strong> to help complete ${sectionPhrase} of the <strong style="color: #1a1a2e;">${planName}</strong> benefits hub.
                                            </p>
                                        </td>
                                    </tr>${noteBlock}${missingBlock}
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td align="center" class="button" style="background-color: #1a3a6a; border-radius: 8px;">
                                                        <a href="${primaryUrl}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">${primaryLabel}</a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>${secondaryBlock}${dueBlock}
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px;">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                If the button does not work, paste this into your browser:<br/>
                                                <a href="${primaryUrl}" style="color: #1a3a6a; text-decoration: underline; word-break: break-all;">${primaryUrl}</a>
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 24px; padding-top: 8px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider" style="height: 1px; background-color: #e0e0e8; width: 100%;"><tr><td style="height: 1px; line-height: 1px;">&nbsp;</td></tr></table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center">
                                            <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                Need help? Contact us at<br/>
                                                <a href="mailto:support@plantelligence.ai" style="color: #1a3a6a; text-decoration: underline;">support@plantelligence.ai</a>
                                            </p>
                                            <p class="email-text-secondary" style="margin: 16px 0 0 0; font-size: 12px; color: #a0a0b0;">
                                                &copy; ${new Date().getFullYear()} PlanTelligence®. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: [
      `Hi ${firstName},`,
      ``,
      `${inviter} invited you as ${inviteContext} to help complete ${sectionPhraseText} of the ${planName} benefits hub.`,
      ...(note?.trim() ? [``, `Note: ${note.trim()}`] : []),
      ...(missingFields.length > 0
        ? [``, `Still needed on this section:`, ...missingFields.map((f) => `- ${f}`)]
        : []),
      ``,
      ...(acceptLink ? [`Accept the invitation: ${acceptLink}`] : []),
      `Open the section: ${sectionUrl}`,
      ...(dueDate
        ? [
            ``,
            `Please complete it by ${dueDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}.`,
          ]
        : []),
    ].join("\n"),
  });
}
