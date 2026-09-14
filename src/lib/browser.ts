// Real Safari (desktop and iOS) is the one browser documented to special-case
// a text/calendar resource into its native "Add to Calendar" screen when no
// `download` attribute forces a save instead — see AddToCalendarButton. Every
// other browser, including Chrome/Firefox on iOS (which run on the same
// WebKit engine but are not Safari.app itself, and report CriOS/FxiOS), gets
// no such handoff and should keep `download` for a clean filename instead.
//
// This is an allowlist, not a denylist: it requires an Apple-platform token
// (Macintosh/iPhone/iPad/iPod) plus genuine Safari's own "Version/X.Y ...
// Safari/…" shape, on top of excluding known non-Safari browser markers.
// That's still UA-sniffing, so it can't fully eliminate false positives —
// an iOS in-app WebView (DuckDuckGo, Instagram, etc.) that leaves the
// default WKWebView UA untouched is genuinely indistinguishable from real
// Safari this way — but it does rule out non-Apple browsers that merely
// carry a bare "Safari/…" suffix with no "Version/" token, such as some
// Samsung Internet builds (see #74).
export function isSafariBrowser(userAgent: string): boolean {
  return (
    /(macintosh|iphone|ipad|ipod)/i.test(userAgent) &&
    /version\/[\d.]+.*safari\//i.test(userAgent) &&
    !/chrome|chromium|crios|edg|fxios|firefox|opr\//i.test(userAgent)
  );
}
