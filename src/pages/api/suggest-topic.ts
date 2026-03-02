import type { APIRoute } from "astro";
import nodemailer from "nodemailer";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const topics: string[] = await request.json();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: import.meta.env.EMAIL_TO,
        pass: import.meta.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Club na Fealsúnachta" <${import.meta.env.EMAIL_TO}>`,
      to: import.meta.env.EMAIL_TO,
      subject: "New topic suggestion(s)",
      text: `Suggested topics: ${topics.join(', ')}`,
    });

    return new Response(
      JSON.stringify({ message: "Thanks for your suggestion(s)! Consider it added to my list :)" }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Whoops, something went wrong :(" }),
      { status: 500 }
    );
  }
};