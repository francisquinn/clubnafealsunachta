import type { APIRoute } from "astro";
import nodemailer from "nodemailer";
import { isValidEmail } from "../../utils/script";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.EMAIL_TO || !import.meta.env.GMAIL_APP_PASSWORD) {
    console.error("Missing email configuration");
    return new Response(
      JSON.stringify({ message: "Server configuration error." }),
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const { name, email, message, website } = body ?? {};

    if (typeof website === "string" && website.trim()) {
      return new Response(
        JSON.stringify({ message: "Thanks for getting in touch! We'll get back to you soon." }),
        { status: 200 }
      );
    }

    if (
      typeof name !== "string" || !name.trim() ||
      typeof email !== "string" || !email.trim() ||
      typeof message !== "string" || !message.trim()
    ) {
      return new Response(
        JSON.stringify({ message: "Please fill in all required fields." }),
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ message: "Please enter a valid email address." }),
        { status: 400 }
      );
    }

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
      replyTo: email,
      subject: "New contact message",
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    });

    return new Response(
      JSON.stringify({ message: "Thanks for getting in touch! We'll get back to you soon." }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Whoops, something went wrong :(" }),
      { status: 500 }
    );
  }
};
