// Shared branded wrapper for transactional emails sent via nodemailer
// (verification, contact form, topic suggestion). Deliberately a separate,
// simpler template from mailchimp.ts's buildEmailHtml: that one leans on
// Mailchimp merge tags (*|UNSUB|*, *|MC_PREVIEW_TEXT|*, ...) that only
// resolve inside a real Mailchimp send, and an unsubscribe footer that
// doesn't apply to a one-off transactional/notification email. Same brand
// (colour, fonts, logo, social icons), lighter footer, no merge tags.
import { IG_IMG, FB_IMG, MEETUP_IMG, ICON_GREY } from "./mailchimp";

const SITE_URL = "https://clubnafealsunachta.com";
const GREEN = "#314837";
const BEIGE = "#faf6e9";

interface EmailTemplateOptions {
  label: string;
  title: string;
  bodyHtml: string;
  cta?: { text: string; url: string };
}

// bodyHtml is assembled from user-submitted content in some callers
// (contact form, topic suggestions) — escape any such value before
// interpolating it, so a message can't inject markup/script into the
// admin's rendered email.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Low-level wrapper (header, card, optional CTA, footer) — not exported.
// Each transactional email's own copy/subject lives in its own builder
// below, same split as mailchimp.ts's buildEmailHtml vs
// buildEventEmailHtml/buildPostEmailHtml.
function renderEmailHtml({ label, title, bodyHtml, cta }: EmailTemplateOptions): string {
  // cta.text/url can originate from user-submitted content (e.g. the
  // contact form's name feeding "Reply to <name>") — escape before
  // interpolating into markup/attributes, same reasoning as bodyHtml.
  const ctaHtml = cta
    ? (() => {
        const ctaText = escapeHtml(cta.text);
        const ctaUrl = escapeHtml(cta.url);
        return `
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${ctaUrl}" style="height:52px;v-text-anchor:middle;width:220px;" arcsize="50%" fillcolor="${GREEN}" stroke="f">
                <w:anchorlock/>
                <center style="color:${BEIGE};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${ctaText}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${ctaUrl}" style="display:inline-block;background-color:${GREEN};color:${BEIGE};text-decoration:none;font-family:'Noto Sans',Arial,sans-serif;font-size:16px;font-weight:300;padding:15px 44px;border-radius:50px;">${ctaText}</a>
              <!--<![endif]-->
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <p style="margin:0;font-family:'Noto Sans',Arial,sans-serif;font-size:12px;color:#999999;line-height:1.5;">Or click this link:<br><a href="${ctaUrl}" style="color:#999999;word-break:break-all;">${ctaUrl}</a></p>
            </td>
          </tr>`;
      })()
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Noto+Sans:wght@300;400;700&display=swap" rel="stylesheet" type="text/css">
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BEIGE};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BEIGE};">
    <tr>
      <td align="center" style="padding:48px 16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <img src="${SITE_URL}/cnf-logo.svg" width="74" height="80" alt="Club na Fealsúnachta" style="display:block;border:0;height:auto;max-width:74px;">
            </td>
          </tr>

          <!-- Label -->
          <tr>
            <td align="center" style="padding-bottom:12px;">
              <p style="margin:0;font-family:'Noto Sans',Arial,sans-serif;font-size:15px;font-weight:300;color:${GREEN};letter-spacing:0.5px;">${label}</p>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <h1 style="margin:0;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:34px;font-weight:700;color:${GREEN};line-height:1.15;">${title}</h1>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="padding-bottom:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:12px;">
                <tr>
                  <td style="padding:28px 32px;font-family:'Noto Sans',Arial,sans-serif;font-size:15px;color:#666666;line-height:1.8;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${ctaHtml}
          <!-- Social icons -->
          <tr>
            <td align="center" style="padding-top:8px;padding-bottom:20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 8px;">
                    <a href="https://www.instagram.com/clubnafealsunachta" style="display:inline-block;width:36px;height:36px;background-color:${ICON_GREY};border-radius:18px;text-align:center;text-decoration:none;line-height:36px;">
                      <table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle">${IG_IMG}</td></tr></table>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://www.facebook.com/people/Club-na-Fealsúnachta/61578150433186/" style="display:inline-block;width:36px;height:36px;background-color:${ICON_GREY};border-radius:18px;text-align:center;text-decoration:none;line-height:36px;">
                      <table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle">${FB_IMG}</td></tr></table>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://www.meetup.com/clubnafealsunachta/" style="display:inline-block;width:36px;height:36px;background-color:${ICON_GREY};border-radius:18px;text-align:center;text-decoration:none;line-height:36px;">
                      <table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle">${MEETUP_IMG}</td></tr></table>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:0;">
              <p style="margin:0;font-family:'Noto Sans',Arial,sans-serif;font-size:13px;color:#999999;line-height:1.6;">
                <a href="${SITE_URL}" style="color:#999999;text-decoration:underline;">clubnafealsunachta.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderVerificationEmail(verifyUrl: string): string {
  return renderEmailHtml({
    label: "Almost there",
    title: "Confirm your email",
    bodyHtml: `<p style="margin:0;">Welcome to Club na Fealsúnachta! Please confirm your email address to activate your account.</p><p style="margin:16px 0 0;font-size:13px;color:#999999;">This link expires in 3 days. If you didn't create an account, you can safely ignore this email.</p>`,
    cta: { text: "Confirm email", url: verifyUrl },
  });
}

export function renderContactMessageEmail({ name, email, message }: {
  name: string;
  email: string;
  message: string;
}): string {
  return renderEmailHtml({
    label: "Contact form",
    title: "New contact message",
    bodyHtml: `<p style="margin:0 0 12px;"><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>`,
    cta: { text: `Reply to ${name}`, url: `mailto:${email}` },
  });
}

export function renderTopicSuggestionEmail(topics: string[]): string {
  return renderEmailHtml({
    label: "Topic suggestions",
    title: "New topic suggestion(s)",
    bodyHtml: `<ul style="margin:0;padding-left:20px;">${topics.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`,
  });
}
