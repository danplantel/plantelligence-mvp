import nodemailer from 'nodemailer';

const sendResetEmail = async (email: string, token: string, baseUrl: string) => {
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || "smtp.mailgun.org",
        port: 465,
        secure: true,
        auth: {
            user: process.env.MAIL_USER || '',
            pass: process.env.MAIL_PASS || process.env.MAILGUN_PASSWORD || '',
        },
    });

    const fromAddress = process.env.MAIL_USER || 'noreply@plantelligence.com';
    const resetUrl = `${baseUrl}/verify-code?email=${email}`;
    const R2_EMAIL_PUBLIC_URL = "https://pub-bfeeb6eae7f9462db1cb563baeabc8bc.r2.dev";
    const logoUrl = `${R2_EMAIL_PUBLIC_URL}/pt_web_dark.png`;
    const logoUrlLight = `${R2_EMAIL_PUBLIC_URL}/pt_web_light.png`;
    const message = {
        from: `"PlanTelligence" <${fromAddress}>`,
        to: email,
        subject: 'Password Reset Request',
        text: `Please use the following link to reset your password: ${resetUrl}\n\nYour verification code is: ${token}`,
        html: `
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
                        <!--[if mso]><table width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
                        <table width="100%" max-width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
                            <!-- Logo -->
                            <tr>
                                <td align="center" style="padding-bottom: 24px;">
                                    <img src="${logoUrl}" alt="PlanTelligence" width="220" class="logo-default" style="display: inline; max-width: 220px; height: auto; border: 0;" />
                                    <img src="${logoUrlLight}" alt="PlanTelligence" width="220" class="logo-dark" style="display: none; max-width: 220px; height: auto; border: 0;" />
                                </td>
                            </tr>
                            <!-- Card -->
                            <tr>
                                <td align="center">
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 40px 32px;">
                                        <tr>
                                            <td align="center" style="padding-bottom: 8px;">
                                                <h1 class="email-text" style="margin: 0; font-size: 22px; font-weight: 600; color: #1a1a2e;">Reset Your Password</h1>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center" style="padding-bottom: 24px;">
                                                <p class="email-text-secondary" style="margin: 0; font-size: 15px; color: #666680; line-height: 1.5;">
                                                    You recently requested to reset your password. Enter the following code to verify your identity:
                                                </p>
                                            </td>
                                        </tr>
                                        <!-- Code Box -->
                                        <tr>
                                            <td align="center" style="padding-bottom: 24px;">
                                                <table cellpadding="0" cellspacing="0" border="0" class="code-box" style="background-color: #f0f4ff; border: 1px solid #d0d9f0; border-radius: 10px; padding: 16px 32px; display: inline-block;">
                                                    <tr>
                                                        <td align="center">
                                                            <span class="code-text" style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a3a6a; font-family: 'Courier New', Courier, monospace;">${token}</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <!-- Divider -->
                                        <tr>
                                            <td align="center" style="padding-bottom: 24px;">
                                                <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider" style="height: 1px; background-color: #e0e0e8; width: 100%;"><tr><td style="height: 1px; line-height: 1px;">&nbsp;</td></tr></table>
                                            </td>
                                        </tr>
                                        <!-- Link Button -->
                                        <tr>
                                            <td align="center" style="padding-bottom: 24px;">
                                                <p class="email-text-secondary" style="margin: 0 0 12px 0; font-size: 14px; color: #666680;">
                                                    Or click the button below:
                                                </p>
                                                <table cellpadding="0" cellspacing="0" border="0">
                                                    <tr>
                                                        <td align="center" style="background-color: #1a3a6a; border-radius: 8px;">
                                                            <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">Verify Email Address</a>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <!-- Fallback link -->
                                        <tr>
                                            <td align="center" style="padding-bottom: 8px;">
                                                <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; word-break: break-all;">
                                                    <a href="${resetUrl}" target="_blank" style="color: #888890;">${resetUrl}</a>
                                                </p>
                                            </td>
                                        </tr>
                                        <!-- Footer -->
                                        <tr>
                                            <td align="center">
                                                <p class="email-text-secondary" style="margin: 0; font-size: 13px; color: #888890; line-height: 1.5;">
                                                    If you did not request this, please ignore this email or contact<br/>
                                                    <a href="mailto:support@plantelligence.ai" style="color: #1a3a6a; text-decoration: underline;">support@plantelligence.ai</a>
                                                </p>
                                                <p class="email-text-secondary" style="margin: 16px 0 0 0; font-size: 12px; color: #a0a0b0;">
                                                    &copy; ${new Date().getFullYear()} PlanTelligence. All rights reserved.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                        <!--[if mso]></td></tr></table><![endif]-->
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `
    };

    try {
        const info = await transporter.sendMail(message);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
};

export default sendResetEmail;
