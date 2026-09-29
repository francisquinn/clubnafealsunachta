import { createTransport, CLUB_FROM, isEmailConfigured } from "./email";
import { createPasswordResetToken } from "./auth";
import { renderPasswordResetEmail } from "./emailTemplate";

export async function sendPasswordResetEmail(
  email: string,
  memberId: string,
  passwordHash: string,
  origin: string,
): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Missing email configuration");
  }

  const transporter = createTransport();
  const token = createPasswordResetToken(memberId, passwordHash);
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: CLUB_FROM,
    to: email,
    subject: "Reset your password",
    text: `We got a request to reset the password on your Club na Fealsúnachta account. Choose a new one here:\n\n${resetUrl}\n\nThis link expires in 1 hour and only works once. If you didn't ask for this, you can safely ignore this email.`,
    html: renderPasswordResetEmail(resetUrl),
  });
}
