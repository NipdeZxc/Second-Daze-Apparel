import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:5173";
}

export async function sendPasswordResetEmail(to, fullName, link) {
  await getTransporter().sendMail({
    from: `"Second Daze Apparel" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Reset your Second Daze Apparel password",
    text:
      `Hello ${fullName},\n\n` +
      `Use this link to set a new password. It expires in 30 minutes and works once:\n${link}\n\n` +
      `If you did not ask for this, ignore this email and your password stays the same.`,
  });
}
