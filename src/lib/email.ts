import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// process.env first: #205's deploy-succeeded Netlify function runs this
// outside Astro's build, where import.meta.env doesn't exist.
const env = (name: string): string | undefined => process.env[name] ?? import.meta.env?.[name];

const SMTP_HOST = env("ZOHO_SMTP_HOST");
const SMTP_PORT = env("ZOHO_SMTP_PORT");
const SMTP_USER = env("ZOHO_SMTP_USER");
const SMTP_PASS = env("ZOHO_APP_PASSWORD");

// #205: sent from the club's address, EMAIL_INFO (also where contact-form
// messages go). With the Zoho mailbox that was the SMTP user too, but Zoho
// CPaaS's SMTP user is a login name, not an address. Falls back to the SMTP
// user as before.
const FROM_ADDRESS = env("EMAIL_INFO") ?? SMTP_USER ?? "info@clubnafealsunachta.com";
export const CLUB_FROM = `"Club na Fealsúnachta" <${FROM_ADDRESS}>`;

export function isEmailConfigured(): boolean {
  return Boolean(
    SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_PORT && Number.isInteger(Number(SMTP_PORT)),
  );
}

let transporter: Transporter | undefined;

export function createTransport(): Transporter {
  if (!transporter) {
    const port = Number(SMTP_PORT);
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER as string, pass: SMTP_PASS as string },
    });
  }
  return transporter;
}

// #205: event announcements send one email per member, several at once, so
// they get their own pooled transport: a few reused connections instead of
// one per message. Close it when done, or the function waits on open sockets.
export const ANNOUNCEMENT_CONNECTIONS = 3;
const SMTP_TIMEOUT_MS = 8_000;

export function createPooledTransport(): Transporter {
  const port = Number(SMTP_PORT);
  return nodemailer.createTransport({
    pool: true,
    maxConnections: ANNOUNCEMENT_CONNECTIONS,
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER as string, pass: SMTP_PASS as string },
    // nodemailer waits minutes by default. The send budget only stops new
    // sends, so a stuck one must fail on its own inside the 60s limit.
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}
