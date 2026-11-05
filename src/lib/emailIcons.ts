// Brand social icons for the site's emails: the Mailchimp newsletter
// (mailchimp.ts) and the Zoho-sent emails (emailTemplate.ts). Hosted PNGs
// rather than inline SVG, which Gmail and Outlook don't show. Drawn in the
// brand green, with no circle behind them.
const SITE_URL = 'https://clubnafealsunachta.com';

// Mail apps load email images through proxies (Apple's, Gmail's) that cache
// by address, and they cached 404s from test emails sent before these PNGs
// were deployed. The version makes a fresh address; bump it whenever an
// image changes so the new one shows.
const IMAGE_VERSION = 2;

export function emailImageUrl(file: string): string {
  return `${SITE_URL}/${file}?v=${IMAGE_VERSION}`;
}

export const IG_IMG = `<img src="${emailImageUrl("email-instagram.png")}" width="24" height="24" alt="Instagram" style="display:block;border:0;">`;
export const FB_IMG = `<img src="${emailImageUrl("email-facebook.png")}" width="24" height="24" alt="Facebook" style="display:block;border:0;">`;
export const MEETUP_IMG = `<img src="${emailImageUrl("email-meetup.png")}" width="24" height="24" alt="Meetup" style="display:block;border:0;">`;
export const WEB_IMG = `<img src="${emailImageUrl("email-website.png")}" width="24" height="24" alt="Website" style="display:block;border:0;">`;
