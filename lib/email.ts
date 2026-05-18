import nodemailer from 'nodemailer';

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
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