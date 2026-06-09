import nodemailer from 'nodemailer';

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

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

export async function sendVideoCreationEmail(userEmail: string, videoName: string) {
  const subject = 'Your Video Creation Has Started';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Video Creation Started</h2>
      <p>Hello,</p>
      <p>We've started creating your video "${videoName}". This process typically takes 5-10 minutes.</p>
      <p>We'll send you another email when your video is ready!</p>
      <p>Best regards,<br>The Plantelligence Team</p>
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
      <p>Best regards,<br>The Plantelligence Team</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

export async function sendEmailVerificationCode(originalEmail: string, code: string) {
  const subject = 'Email Change Verification – Plantelligence';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #1F3A60; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Plantelligence</h1>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #1F3A60; margin-top: 0;">Verify Your Email Change</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          A request was made to change the email address associated with your Plantelligence account.
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          To confirm this change, use the following verification code:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F3A60; font-family: 'Courier New', monospace;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          This code will expire in 10 minutes. If you did not request this change, please ignore this email or contact support.
        </p>
      </div>
      <div style="background-color: #f3f4f6; padding: 16px 24px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          &copy; ${new Date().getFullYear()} Plantelligence. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to: originalEmail, subject, html });
}
