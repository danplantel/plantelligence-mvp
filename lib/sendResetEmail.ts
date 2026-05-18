import nodemailer from 'nodemailer';

const sendResetEmail = async (email: string, token: string, baseUrl: string) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.mailgun.org",
        port: 465,
        secure: true,
        auth: {
            user: "testing2@whoseno.com",
            pass: process.env.MAILGUN_PASSWORD || '',
        },
    });

    const resetUrl = `${baseUrl}/verify-code?email=${email}`;
    const message = {
        from: 'testing2@whoseno.com',
        to: email,
        subject: 'Password Reset Request',
        text: `Please use the following link to reset your password: ${resetUrl}`,
        html: `
        <html>
            <body>
                <p>Hello,</p>
                <p>You recently requested to reset your password for your account. To complete the process, please click the link below to verify your email address:</p>
                <p><a href="${resetUrl}" target="_blank">${resetUrl}</a></p>
                <p>Your verification code is <span style="font-weight: 700; font-size: 20px">${token}</span></p> 
                <p>If you did not request this, please ignore this email or contact support if you have questions.</p>
                <p>Thank you,<br>The Support Team</p>
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
