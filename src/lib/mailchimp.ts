import { IG_IMG, FB_IMG, WEB_IMG, emailImageUrl } from './emailIcons';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
const DC = MAILCHIMP_API_KEY?.split('-')[1];

// Test seam: vitest runs with import.meta.env.DEV === true, which would
// otherwise silently no-op every campaign send. Spying this flag in unit
// tests lets them exercise the real Mailchimp call paths against a stubbed
// fetch, while the guard itself still applies whenever the app actually
// runs in dev.
export const mailchimpRuntime = {
  isLocalDev: (): boolean => import.meta.env.DEV,
};

function isConfigured(): boolean {
  return Boolean(MAILCHIMP_API_KEY && MAILCHIMP_AUDIENCE_ID && DC);
}

async function mailchimpError(res: Response): Promise<Error> {
  let detail: string | undefined;
  try {
    const body = (await res.json()) as { detail?: string; title?: string };
    detail = body.detail ?? body.title;
  } catch {
    // Some proxies return non-JSON error bodies — fall through to the status.
  }
  return new Error(detail ?? `${res.status} ${res.statusText}`);
}

async function mailchimp(requestPath: string, init?: { method?: string; body?: unknown }): Promise<Response> {
  return fetch(`https://${DC}.api.mailchimp.com/3.0${requestPath}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`any:${MAILCHIMP_API_KEY}`).toString('base64')}`,
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

const SITE_URL = 'https://clubnafealsunachta.com';
const GREEN = '#314837';
const BEIGE = '#faf6e9';


export interface PostDraft {
  title: string;
  slug: string;
  body: string;
}

function extractFirstParagraph(markdown: string): string {
  const lines = markdown.split('\n');
  const paragraphs: string[] = [];
  let current = '';

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.trim()) {
        paragraphs.push(current.trim());
        current = '';
      }
    } else {
      current += (current ? ' ' : '') + line;
    }
  }
  if (current.trim()) paragraphs.push(current.trim());

  const first = paragraphs.find((p) => !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('!'));
  if (!first) return '';

  return first
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

function buildEmailHtml({ label, title, cardHtml, ctaText, ctaUrl }: {
  label: string;
  title: string;
  cardHtml: string;
  ctaText: string;
  ctaUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>*|MC:SUBJECT|*</title>
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Noto+Sans:wght@300;400;700&display=swap" rel="stylesheet" type="text/css">
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BEIGE};">
  <div style="display:none;font-size:1px;max-height:0;overflow:hidden;mso-hide:all;">*|MC_PREVIEW_TEXT|*&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BEIGE};">
    <tr>
      <td align="center" style="padding:48px 16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <img src="${emailImageUrl('cnf-logo.png')}" width="74" height="80" alt="Club na Fealsúnachta" style="display:block;border:0;height:auto;max-width:74px;">
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
              <h1 style="margin:0;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:42px;font-weight:700;color:${GREEN};line-height:1.15;">${title}</h1>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="padding-bottom:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:12px;">
                <tr>
                  <td style="padding:28px 32px;font-family:'Noto Sans',Arial,sans-serif;font-size:15px;color:#666666;line-height:1.8;">
                    ${cardHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${ctaUrl}" style="height:52px;v-text-anchor:middle;width:180px;" arcsize="50%" fillcolor="${GREEN}" stroke="f">
                <w:anchorlock/>
                <center style="color:${BEIGE};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${ctaText}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${ctaUrl}" style="display:inline-block;background-color:${GREEN};color:${BEIGE};text-decoration:none;font-family:'Noto Sans',Arial,sans-serif;font-size:16px;font-weight:300;padding:15px 44px;border-radius:50px;">${ctaText}</a>
              <!--<![endif]-->
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding-bottom:32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #d4d0c4;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- Social icons -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 8px;">
                    <a href="https://www.instagram.com/clubnafealsunachta" style="display:inline-block;width:44px;height:44px;text-align:center;text-decoration:none;line-height:44px;">
                      <table role="presentation" width="44" height="44" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle">${IG_IMG}</td></tr></table>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://www.facebook.com/clubnafealsunachta" style="display:inline-block;width:44px;height:44px;text-align:center;text-decoration:none;line-height:44px;">
                      <table role="presentation" width="44" height="44" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle">${FB_IMG}</td></tr></table>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="${SITE_URL}" style="display:inline-block;width:44px;height:44px;text-align:center;text-decoration:none;line-height:44px;">
                      <table role="presentation" width="44" height="44" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle">${WEB_IMG}</td></tr></table>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <p style="margin:0 0 6px 0;font-family:'Noto Sans',Arial,sans-serif;font-size:13px;color:#999999;line-height:1.6;">Want to change how you receive these emails?</p>
              <p style="margin:0;font-family:'Noto Sans',Arial,sans-serif;font-size:13px;color:#999999;line-height:1.6;">You can <a href="*|UPDATE_PROFILE|*" style="color:#999999;text-decoration:underline;">update your preferences</a> or <a href="*|UNSUB|*" style="color:#999999;text-decoration:underline;">unsubscribe</a></p>
            </td>
          </tr>

          <!-- Mailchimp badge -->
          <tr>
            <td align="center" style="padding-top:16px;padding-bottom:16px;">
              *|IF:REWARDS|* *|HTML:REWARDS|* *|END:IF|*
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPostEmailHtml(post: PostDraft): string {
  return buildEmailHtml({
    label: 'New blog post',
    title: post.title,
    cardHtml: extractFirstParagraph(post.body),
    ctaText: 'Read post',
    ctaUrl: `${SITE_URL}/posts/${post.slug}`,
  });
}

async function sendCampaign({ subjectLine, previewText, html, recipients }: {
  subjectLine: string;
  previewText: string;
  html: string;
  recipients: Record<string, unknown>;
}): Promise<void> {
  // Never hit the real Mailchimp account from a local dev server, even if
  // a real API key is present in .env (e.g. pulled down via sync-env) —
  // creating draft campaigns while testing locally would clutter the live
  // account. Astro sets DEV based on how the app is actually running, not
  // on env-var presence, so there's nothing to remember to unset. See
  // mailchimpRuntime above for why the check goes through an indirection.
  if (mailchimpRuntime.isLocalDev()) {
    console.warn(`Mailchimp campaign skipped in local dev: "${subjectLine}"`);
    return;
  }

  const campaignRes = await mailchimp('/campaigns', {
    method: 'POST',
    body: {
      type: 'regular',
      recipients,
      settings: {
        subject_line: subjectLine,
        preview_text: previewText,
        from_name: 'Club na Fealsúnachta',
        reply_to: process.env.EMAIL_INFO,
      },
    },
  });

  if (!campaignRes.ok) {
    throw new Error(`Mailchimp campaign creation failed: ${(await mailchimpError(campaignRes)).message}`);
  }

  const { id: campaignId } = await campaignRes.json();

  const contentRes = await mailchimp(`/campaigns/${campaignId}/content`, {
    method: 'PUT',
    body: { html },
  });

  if (!contentRes.ok) {
    throw new Error(`Mailchimp content update failed: ${(await mailchimpError(contentRes)).message}`);
  }

  const sendRes = await mailchimp(`/campaigns/${campaignId}/actions/send`, {
    method: 'POST',
  });

  if (!sendRes.ok) {
    throw new Error(`Mailchimp send failed: ${(await mailchimpError(sendRes)).message}`);
  }
}

export async function sendMailchimpPostEmail(post: PostDraft): Promise<void> {
  if (!isConfigured()) {
    console.warn('Mailchimp not configured — skipping email send');
    return;
  }
  if (mailchimpRuntime.isLocalDev()) {
    console.warn(`Mailchimp campaign skipped in local dev: "New blog post - ${post.title}"`);
    return;
  }

  await sendCampaign({
    subjectLine: `New blog post - ${post.title}`,
    previewText: extractFirstParagraph(post.body).slice(0, 150),
    html: buildPostEmailHtml(post),
    recipients: { list_id: MAILCHIMP_AUDIENCE_ID },
  });
}
