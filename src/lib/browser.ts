// Real Safari (desktop and iOS) is the one browser documented to special-case
// a text/calendar resource into its native "Add to Calendar" screen when no
// `download` attribute forces a save instead — see AddToCalendarButton. Every
// other browser, including Chrome/Firefox on iOS (which run on the same
// WebKit engine but are not Safari.app itself, and report CriOS/FxiOS), gets
// no such handoff and should keep `download` for a clean filename instead.
export function isSafariBrowser(userAgent: string): boolean {
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|edg|fxios|firefox|opr\//i.test(userAgent);
}
