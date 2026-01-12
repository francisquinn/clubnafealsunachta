import type { APIRoute } from "astro";
import { isValidEmail } from "../../utils/script";

const MAILCHIMP_API_KEY = import.meta.env.MAILCHIMP_API_KEY;
const AUDIENCE_ID = import.meta.env.MAILCHIMP_AUDIENCE_ID;
const DC = MAILCHIMP_API_KEY.split("-")[1];

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const email = await request.json();

  if (!isValidEmail(email)) {
    return new Response(
      JSON.stringify({
        message: "Please enter a valid email address.",
      }),
      {
        status: 400,
      }
    );
  }

  const response = await fetch(
    `https://${DC}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`any:${MAILCHIMP_API_KEY}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        status: "pending", // double opt-in
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    let message = "Whoops, something went wrong. Try again later.";

    if (data.title === "Member Exists") {
      message = "Looks like you're already subscribed!";
    }

    return new Response(JSON.stringify({ message }), {
      status: response.status,
    });
  }

  return new Response(
    JSON.stringify({
      message:
        "Thanks for signing up! Please check your email and click the confirmation link to finish subscribing.",
    }),
    {
      status: response.status,
    }
  );
};
