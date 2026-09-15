import { describe, it, expect } from "vitest";
import { getAvatarDisplayUrl, transformAvatarUrl, AVATAR_STORED_SIZE } from "./avatarTransform";

const OBJECT_URL = "https://tnexarybegoxvryavwxl.supabase.co/storage/v1/object/public/avatars/member-1";

describe("getAvatarDisplayUrl", () => {
  it("rewrites a Supabase object URL to the render/image endpoint with width/height", () => {
    expect(getAvatarDisplayUrl(OBJECT_URL, "sm")).toBe(
      "https://tnexarybegoxvryavwxl.supabase.co/storage/v1/render/image/public/avatars/member-1?width=64&height=64"
    );
  });

  it("uses a larger transform size for lg than sm", () => {
    const sm = getAvatarDisplayUrl(OBJECT_URL, "sm");
    const lg = getAvatarDisplayUrl(OBJECT_URL, "lg");

    expect(lg).toContain("width=128");
    expect(sm).not.toBe(lg);
  });

  // Defensive fallback: nothing in this app should ever produce a
  // non-Supabase avatar_url (uploadAvatar's getPublicUrl always returns
  // this shape), but a blob: preview URL (AccountForm's avatarPreview) or
  // a test fixture URL should still render, not break.
  it("returns the URL unchanged when it doesn't match the Supabase object-storage shape", () => {
    expect(getAvatarDisplayUrl("https://example.com/a.png", "sm")).toBe("https://example.com/a.png");
    expect(getAvatarDisplayUrl("blob:http://localhost/abc-123", "lg")).toBe("blob:http://localhost/abc-123");
  });
});

describe("transformAvatarUrl", () => {
  // Used by actions/avatar.ts to shrink the file actually written to
  // Storage, not just what's requested at display time — same rewrite,
  // any pixel size.
  it("rewrites to the render/image endpoint at an arbitrary pixel size", () => {
    expect(transformAvatarUrl(OBJECT_URL, AVATAR_STORED_SIZE)).toBe(
      `https://tnexarybegoxvryavwxl.supabase.co/storage/v1/render/image/public/avatars/member-1?width=${AVATAR_STORED_SIZE}&height=${AVATAR_STORED_SIZE}`
    );
  });

  it("returns the URL unchanged when it doesn't match the Supabase object-storage shape", () => {
    expect(transformAvatarUrl("https://example.com/a.png", 400)).toBe("https://example.com/a.png");
  });
});
