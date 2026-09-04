import { describe, it, expect } from "vitest";
import { isSafariBrowser } from "./browser";

const MACOS_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const MACOS_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const IOS_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1";
const IOS_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/128.0 Mobile/15E148 Safari/605.1.15";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0";
const DESKTOP_FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0";

describe("isSafariBrowser", () => {
  it("identifies macOS Safari", () => {
    expect(isSafariBrowser(MACOS_SAFARI)).toBe(true);
  });

  it("identifies iOS Safari", () => {
    expect(isSafariBrowser(IOS_SAFARI)).toBe(true);
  });

  it("does not misidentify desktop Chrome, which also carries 'Safari' in its UA", () => {
    expect(isSafariBrowser(MACOS_CHROME)).toBe(false);
  });

  it("does not misidentify Android Chrome", () => {
    expect(isSafariBrowser(ANDROID_CHROME)).toBe(false);
  });

  it("does not misidentify iOS Chrome (CriOS), despite running on WebKit", () => {
    expect(isSafariBrowser(IOS_CHROME)).toBe(false);
  });

  it("does not misidentify iOS Firefox (FxiOS)", () => {
    expect(isSafariBrowser(IOS_FIREFOX)).toBe(false);
  });

  it("does not misidentify Edge", () => {
    expect(isSafariBrowser(WINDOWS_EDGE)).toBe(false);
  });

  it("does not misidentify desktop Firefox", () => {
    expect(isSafariBrowser(DESKTOP_FIREFOX)).toBe(false);
  });
});
