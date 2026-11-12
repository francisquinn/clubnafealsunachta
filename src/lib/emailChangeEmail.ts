import { createTransport, CLUB_FROM, isEmailConfigured } from "./email";
import { createEmailChangeToken } from "./auth";
import { renderEmailChangeEmail, renderEmailChangedNotice } from "./emailTemplate";

export async function sendEmailChangeConfirmation(
  memberId: string,
  oldEmail: string,
  newEmail: string,
  origin: string,
): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Missing email configuration");
  }

  const transporter = createTransport();
  const token = createEmailChangeToken(memberId, oldEmail, newEmail);
  const confirmUrl = `${origin}/confirm-email-change?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: CLUB_FROM,
    to: newEmail,
    subject: "Confirm your new email",
    text: `You asked to use this address for your Club na Fealsúnachta account. Confirm it here and we'll switch your account over:\n\n${confirmUrl}\n\nThis link expires in 24 hours. If you didn't ask for this, you can safely ignore this email.`,
    html: renderEmailChangeEmail(confirmUrl),
  });
}

// Sent to the old address once the switch has happened, so a member whose
// account was taken over hears about it somewhere the attacker can't reach.
export async function sendEmailChangedNotice(oldEmail: string, newEmail: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Missing email configuration");
  }

  await createTransport().sendMail({
    from: CLUB_FROM,
    to: oldEmail,
    subject: "Your email was changed",
    text: `The email on your Club na Fealsúnachta account is now ${newEmail}. We'll send everything there from now on.\n\nIf you didn't make this change, reply to this email and we'll help you get your account back.`,
    html: renderEmailChangedNotice(newEmail),
  });
}
