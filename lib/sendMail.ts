import nodemailer from "nodemailer";

const whiteList = ["camconrad@gmail.com", "anh.td1401@gmail.com"];

async function sendEmail(option: {
  to: string;
  subject: string;
  html: string;
}) {
  // if (!whiteList.includes(option.to)) {
  //   return;
  // }

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"PlanTelligence" <${process.env.MAIL_USER}>`,
    to: option.to,
    subject: option.subject,
    html: option.html,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export default sendEmail;
