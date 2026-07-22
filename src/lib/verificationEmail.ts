import nodemailer from "nodemailer";
import { createVerificationToken } from "./auth";

export async function sendVerificationEmail(email: string, origin: string): Promise<void> {
  if (!import.meta.env.EMAIL_TO || !import.meta.env.GMAIL_APP_PASSWORD) {
    throw new Error("Missing email configuration");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: import.meta.env.EMAIL_TO,
      pass: import.meta.env.GMAIL_APP_PASSWORD,
    },
  });

  const token = createVerificationToken(email);
  const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: `"Club na Fealsúnachta" <${import.meta.env.EMAIL_TO}>`,
    to: email,
    subject: "Confirm your email",
    text: `Welcome to Club na Fealsúnachta!\n\nPlease confirm your email address to activate your account:\n\n${verifyUrl}\n\nThis link expires in 3 days.`,
  });
}
