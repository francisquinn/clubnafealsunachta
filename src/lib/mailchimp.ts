const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
const DC = MAILCHIMP_API_KEY?.split('-')[1];

const SITE_URL = 'https://clubnafealsunachta.com';
const GREEN = '#314837';
const BEIGE = '#faf6e9';
const ICON_GREY = '#9a9a9a';

const IG_IMG = `<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQ5IiBoZWlnaHQ9IjQ0OSIgdmlld0JveD0iMCAwIDQ0OSA0NDkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0yMjQuMyAxMTBDMTYwLjggMTA5LjggMTA5LjIgMTYxLjIgMTA5IDIyNC43QzEwOC44IDI4OC4yIDE2MC4yIDMzOS44IDIyMy43IDM0MEMyODcuMiAzNDAuMiAzMzguOCAyODguOCAzMzkgMjI1LjNDMzM5LjIgMTYxLjggMjg3LjggMTEwLjIgMjI0LjMgMTEwWk0yMjMuNyAxNTAuNEMyNjQuOSAxNTAuMiAyOTguNCAxODMuNSAyOTguNiAyMjQuN0MyOTguOCAyNjUuOSAyNjUuNSAyOTkuNCAyMjQuMyAyOTkuNkMxODMuMSAyOTkuOCAxNDkuNiAyNjYuNSAxNDkuNCAyMjUuM0MxNDkuMiAxODQuMSAxODIuNSAxNTAuNiAyMjMuNyAxNTAuNFpNMzE3LjEgMTA1LjNDMzE3LjEgOTAuNDk5OSAzMjkuMSA3OC40OTk5IDM0My45IDc4LjQ5OTlDMzU4LjcgNzguNDk5OSAzNzAuNyA5MC40OTk5IDM3MC43IDEwNS4zQzM3MC43IDEyMC4xIDM1OC43IDEzMi4xIDM0My45IDEzMi4xQzMyOS4xIDEzMi4xIDMxNy4xIDEyMC4xIDMxNy4xIDEwNS4zWk00NDYuOCAxMzIuNUM0NDUuMSA5Ni42IDQzNi45IDY0LjggNDEwLjYgMzguNkMzODQuNCAxMi40IDM1Mi42IDQuMTk5OTUgMzE2LjcgMi4zOTk5NUMyNzkuNyAwLjI5OTk1MSAxNjguOCAwLjI5OTk1MSAxMzEuOCAyLjM5OTk1Qzk2IDQuMDk5OTUgNjQuMiAxMi4yOTk5IDM3LjkgMzguNUMxMS42IDY0LjcgMy41IDk2LjQ5OTkgMS43IDEzMi40Qy0wLjQgMTY5LjQgLTAuNCAyODAuMyAxLjcgMzE3LjNDMy40IDM1My4yIDExLjYgMzg1IDM3LjkgNDExLjJDNjQuMiA0MzcuNCA5NS45IDQ0NS42IDEzMS44IDQ0Ny40QzE2OC44IDQ0OS41IDI3OS43IDQ0OS41IDMxNi43IDQ0Ny40QzM1Mi42IDQ0NS43IDM4NC40IDQzNy41IDQxMC42IDQxMS4yQzQzNi44IDM4NSA0NDUgMzUzLjIgNDQ2LjggMzE3LjNDNDQ4LjkgMjgwLjMgNDQ4LjkgMTY5LjUgNDQ2LjggMTMyLjVaTTM5OSAzNTdDMzkxLjIgMzc2LjYgMzc2LjEgMzkxLjcgMzU2LjQgMzk5LjZDMzI2LjkgNDExLjMgMjU2LjkgNDA4LjYgMjI0LjMgNDA4LjZDMTkxLjcgNDA4LjYgMTIxLjYgNDExLjIgOTIuMiAzOTkuNkM3Mi42IDM5MS44IDU3LjUgMzc2LjcgNDkuNiAzNTdDMzcuOSAzMjcuNSA0MC42IDI1Ny41IDQwLjYgMjI0LjlDNDAuNiAxOTIuMyAzOCAxMjIuMiA0OS42IDkyLjc5OTlDNTcuNCA3My4xOTk5IDcyLjUgNTguMDk5OSA5Mi4yIDUwLjE5OTlDMTIxLjcgMzguNDk5OSAxOTEuNyA0MS4xOTk5IDIyNC4zIDQxLjE5OTlDMjU2LjkgNDEuMTk5OSAzMjcgMzguNTk5OSAzNTYuNCA1MC4xOTk5QzM3NiA1Ny45OTk5IDM5MS4xIDczLjA5OTkgMzk5IDkyLjc5OTlDNDEwLjcgMTIyLjMgNDA4IDE5Mi4zIDQwOCAyMjQuOUM0MDggMjU3LjUgNDEwLjcgMzI3LjYgMzk5IDM1N1oiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=" width="20" height="20" alt="Instagram" style="display:block;border:0;">`;
const FB_IMG = `<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMSIgdmlld0JveD0iMCAwIDUxMiA1MTEiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik01MTIgMjU2QzUxMiAxMTQuNiAzOTcuNCAwIDI1NiAwQzExNC42IDAgMCAxMTQuNiAwIDI1NkMwIDM3NiA4Mi43IDQ3Ni44IDE5NC4yIDUwNC41VjMzNC4ySDE0MS40VjI1NkgxOTQuMlYyMjIuM0MxOTQuMiAxMzUuMiAyMzMuNiA5NC44IDMxOS4yIDk0LjhDMzM1LjQgOTQuOCAzNjMuNCA5OCAzNzQuOSAxMDEuMlYxNzJDMzY4LjkgMTcxLjQgMzU4LjQgMTcxIDM0NS4zIDE3MUMzMDMuMyAxNzEgMjg3LjEgMTg2LjkgMjg3LjEgMjI4LjJWMjU2SDM3MC43TDM1Ni4zIDMzNC4ySDI4N1Y1MTAuMUM0MTMuOCA0OTQuOCA1MTIgMzg2LjkgNTEyIDI1NloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=" width="20" height="20" alt="Facebook" style="display:block;border:0;">`;
const WEB_IMG = `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBkPSJNMzUyIDI1NmMwIDIyLjItMS4yIDQzLjYtMy4zIDY0SDE2My4zQzE2MS4yIDI5OS42IDE2MCAyNzguMiAxNjAgMjU2czEuMi00My42IDMuMy02NEgzNDguN2MyLjEgMjAuNCAzLjMgNDEuOCAzLjMgNjR6bTI4LjgtNjRINTAzLjljNS4zIDIwLjUgOC4xIDQxLjkgOC4xIDY0cy0yLjggNDMuNS04LjEgNjRIMzgwLjhjMi4xLTIwLjQgMy4yLTQxLjggMy4yLTY0cy0xLjEtNDMuNi0zLjItNjR6bTExMi42LTMySDM3Ni43Yy0xMC02My45LTI5LjgtMTE3LjQtNTUuMy0xNTEuNkMzOTkuNCAyOS4xIDQ2MyA4NS45IDQ5My40IDE2MHpNMzQ0LjMgMTYwSDE2Ny43YzYuMS0zNi40IDE1LjUtNjguNiAyNy05NC43YzEwLjUtMjMuNiAyMi4yLTQwLjcgMzMuNS01MS41QzIzOS40IDMuMiAyNDguNyAwIDI1NiAwczE2LjYgMy4yIDI3LjggMTMuOGMxMS4zIDEwLjggMjMgMjcuOSAzMy41IDUxLjVjMTEuNSAyNiAyMC45IDU4LjIgMjcgOTQuN3ptLTIwOSAwSDE4LjZDNDguNiA4NS45IDExMi4yIDI5LjEgMTkwLjYgOC40QzE2NS4xIDQyLjYgMTQ1LjMgOTYuMSAxMzUuMyAxNjB6TTguMSAxOTJIMTMxLjJjLTIuMSAyMC40LTMuMiA0MS44LTMuMiA2NHMxLjEgNDMuNiAzLjIgNjRIOC4xQzIuOCAyOTkuNSAwIDI3OC4xIDAgMjU2czIuOC00My41IDguMS02NHptMTg2LjYgMjU0LjZjLTExLjYtMjYtMjAuOS01OC4yLTI3LTk0LjZIMzQ0LjNjLTYuMSAzNi40LTE1LjUgNjguNi0yNyA5NC42Yy0xMC41IDIzLjYtMjIuMiA0MC43LTMzLjUgNTEuNUMyNzIuNiA1MDguOCAyNjMuMyA1MTIgMjU2IDUxMnMtMTYuNi0zLjItMjcuOC0xMy44Yy0xMS4zLTEwLjgtMjMtMjcuOS0zMy41LTUxLjV6TTEzNS4zIDM1MmMxMCA2My45IDI5LjggMTE3LjQgNTUuMyAxNTEuNkMxMTIuMiA0ODIuOSA0OC42IDQyNi4xIDE4LjYgMzUySDEzNS4zem0zNTguMSAwYy0zMCA3NC4xLTkzLjYgMTMwLjktMTcxLjkgMTUxLjZjMjUuNS0zNC4yIDQ1LjItODcuNyA1NS4zLTE1MS42SDQ5My40eiIgZmlsbD0id2hpdGUiLz48L3N2Zz4K" width="20" height="20" alt="Website" style="display:block;border:0;">`;

export interface EventDraft {
  name: string;
  date: string;
  slug: string;
  club_slug: string;
  meeting_url?: string | null;
  venue_name?: string | null;
  venue_url?: string | null;
}

export interface PostDraft {
  title: string;
  slug: string;
  body: string;
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const datePart = date.toLocaleDateString('en-IE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  });
  const timePart = date.toLocaleTimeString('en-IE', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC',
  });
  return `${datePart} @ ${timePart}`;
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
              <img src="${SITE_URL}/cnf-logo.svg" width="74" height="80" alt="Club na Féalscúnachta" style="display:block;border:0;height:auto;max-width:74px;">
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
                    <a href="https://www.instagram.com/clubnafealsunachta" style="display:inline-block;width:44px;height:44px;background-color:${ICON_GREY};border-radius:22px;text-align:center;text-decoration:none;line-height:44px;">
                      <table role="presentation" width="44" height="44" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle">${IG_IMG}</td></tr></table>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://www.facebook.com/clubnafealsunachta" style="display:inline-block;width:44px;height:44px;background-color:${ICON_GREY};border-radius:22px;text-align:center;text-decoration:none;line-height:44px;">
                      <table role="presentation" width="44" height="44" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle">${FB_IMG}</td></tr></table>
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="${SITE_URL}" style="display:inline-block;width:44px;height:44px;background-color:${ICON_GREY};border-radius:22px;text-align:center;text-decoration:none;line-height:44px;">
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

function buildEventEmailHtml(event: EventDraft): string {
  const venueHtml = event.meeting_url
    ? `<span style="display:block;text-align:center;"><a href="${event.meeting_url}" style="color:${GREEN};text-decoration:underline;font-family:'Noto Sans',Arial,sans-serif;font-size:15px;">Join online</a></span>`
    : event.venue_name
      ? event.venue_url
        ? `<span style="display:block;text-align:center;"><a href="${event.venue_url}" style="color:${GREEN};text-decoration:underline;font-family:'Noto Sans',Arial,sans-serif;font-size:15px;">${event.venue_name}</a></span>`
        : `<span style="display:block;text-align:center;color:${GREEN};">${event.venue_name}</span>`
      : '';

  return buildEmailHtml({
    label: 'Upcoming event',
    title: event.name,
    cardHtml: `<span style="display:block;text-align:center;">${formatEventDate(event.date)}</span>${venueHtml}`,
    ctaText: 'View event',
    ctaUrl: `${SITE_URL}/${event.club_slug}/events/${event.slug}`,
  });
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

async function sendCampaign({ subjectLine, previewText, html }: {
  subjectLine: string;
  previewText: string;
  html: string;
}): Promise<void> {
  // Never hit the real Mailchimp account from a local dev server, even if
  // a real API key is present in .env (e.g. pulled down via sync-env) —
  // creating draft campaigns while testing locally would clutter the live
  // account. Astro sets DEV based on how the app is actually running, not
  // on env-var presence, so there's nothing to remember to unset.
  if (import.meta.env.DEV) {
    console.warn(`Mailchimp campaign skipped in local dev: "${subjectLine}"`);
    return;
  }

  const authHeader = `Basic ${Buffer.from(`any:${MAILCHIMP_API_KEY}`).toString('base64')}`;
  const baseUrl = `https://${DC}.api.mailchimp.com/3.0`;

  const campaignRes = await fetch(`${baseUrl}/campaigns`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'regular',
      recipients: { list_id: MAILCHIMP_AUDIENCE_ID },
      settings: {
        subject_line: subjectLine,
        preview_text: previewText,
        from_name: 'Club na Féalscúnachta',
        reply_to: process.env.EMAIL_INFO,
      },
    }),
  });

  if (!campaignRes.ok) {
    const err = await campaignRes.json();
    throw new Error(`Mailchimp campaign creation failed: ${err.detail ?? campaignRes.statusText}`);
  }

  const { id: campaignId } = await campaignRes.json();

  const contentRes = await fetch(`${baseUrl}/campaigns/${campaignId}/content`, {
    method: 'PUT',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  });

  if (!contentRes.ok) {
    const err = await contentRes.json();
    throw new Error(`Mailchimp content update failed: ${err.detail ?? contentRes.statusText}`);
  }

  const sendRes = await fetch(`${baseUrl}/campaigns/${campaignId}/actions/send`, {
    method: 'POST',
    headers: { Authorization: authHeader },
  });

  if (!sendRes.ok) {
    const err = await sendRes.json();
    throw new Error(`Mailchimp send failed: ${err.detail ?? sendRes.statusText}`);
  }
}

export async function sendMailchimpEmail(event: EventDraft): Promise<void> {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_AUDIENCE_ID || !DC) {
    console.warn('Mailchimp not configured — skipping email send');
    return;
  }

  await sendCampaign({
    subjectLine: `Upcoming event - ${event.name}`,
    previewText: `Join us for ${event.name} — ${formatEventDate(event.date)}`,
    html: buildEventEmailHtml(event),
  });
}

export async function sendMailchimpPostEmail(post: PostDraft): Promise<void> {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_AUDIENCE_ID || !DC) {
    console.warn('Mailchimp not configured — skipping email send');
    return;
  }

  await sendCampaign({
    subjectLine: `New blog post - ${post.title}`,
    previewText: extractFirstParagraph(post.body).slice(0, 150),
    html: buildPostEmailHtml(post),
  });
}
