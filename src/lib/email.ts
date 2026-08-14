import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const SMTP_HOST = import.meta.env.ZOHO_SMTP_HOST;
const SMTP_PORT = import.meta.env.ZOHO_SMTP_PORT;
const SMTP_USER = import.meta.env.ZOHO_SMTP_USER;
const SMTP_PASS = import.meta.env.ZOHO_APP_PASSWORD;

export const CLUB_FROM = `"Club na Fealsúnachta" <${SMTP_USER ?? "info@clubnafealsunachta.com"}>`;

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
