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

const R2_EMAIL_PUBLIC_URL = "https://pub-bfeeb6eae7f9462db1cb563baeabc8bc.r2.dev";
const logoUrl = `${R2_EMAIL_PUBLIC_URL}/pt_web_dark.png`;
const logoUrlLight = `${R2_EMAIL_PUBLIC_URL}/pt_web_light.png`;
const fromAddress = process.env.MAIL_USER || 'noreply@plantelligence.com';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: `"PlanTelligence®" <${fromAddress}>`,
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
