import { createTransport, CLUB_FROM, isEmailConfigured } from "./email";
import { createVerificationToken } from "./auth";

export async function sendVerificationEmail(email: string, origin: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Missing email configuration");
  }

  const transporter = createTransport();
  const token = createVerificationToken(email);
  const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: CLUB_FROM,
    to: email,
    subject: "Confirm your email",
    text: `Welcome to Club na Fealsúnachta!\n\nPlease confirm your email address to activate your account:\n\n${verifyUrl}\n\nThis link expires in 3 days.`,
  });
}
