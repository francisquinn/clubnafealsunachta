import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  renderVerificationEmail,
  renderContactMessageEmail,
  renderTopicSuggestionEmail,
} from "./emailTemplate";

describe("escapeHtml", () => {
  it("escapes markup-significant characters", () => {
    expect(escapeHtml(`<script>alert("hi")</script> & 'quote'`)).toBe(
      "&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; &#39;quote&#39;",
    );
  });
});

describe("renderVerificationEmail", () => {
  const html = renderVerificationEmail("https://clubnafealsunachta.com/verify-email?token=abc");

  it("includes the confirm link as both the CTA and the fallback link", () => {
    const matches = html.match(/https:\/\/clubnafealsunachta\.com\/verify-email\?token=abc/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it("tells the recipient to ignore it if they didn't sign up", () => {
    expect(html).toContain("safely ignore this email");
  });

  it("does not include any Mailchimp merge tags", () => {
    expect(html).not.toMatch(/\*\|.*\|\*/);
  });
});

describe("renderContactMessageEmail", () => {
  it("escapes the submitted name, email, and message", () => {
    const html = renderContactMessageEmail({
      name: '<b>Name</b>',
      email: "a@b.com",
      message: "<script>evil()</script>",
    });
    expect(html).not.toContain("<b>Name</b>");
    expect(html).toContain("&lt;b&gt;Name&lt;/b&gt;");
    expect(html).not.toContain("<script>evil()</script>");
  });
});

describe("renderTopicSuggestionEmail", () => {
  it("renders one escaped list item per topic", () => {
    const html = renderTopicSuggestionEmail({ topics: ["Stoicism", "<script>x</script>"], chapterName: "Dublin", name: null });
    expect(html).toContain("<li>Stoicism</li>");
    expect(html).toContain("<li>&lt;script&gt;x&lt;/script&gt;</li>");
  });

  it("says only the chapter when the member stays anonymous", () => {
    const html = renderTopicSuggestionEmail({ topics: ["Stoicism"], chapterName: "Dublin", name: null });
    expect(html).toContain("From a member of Dublin");
  });

  it("names the member, escaped, when they include their name", () => {
    const html = renderTopicSuggestionEmail({ topics: ["Stoicism"], chapterName: "Dublin", name: "<b>Ann</b>" });
    expect(html).toContain("From &lt;b&gt;Ann&lt;/b&gt;, Dublin");
  });
});
