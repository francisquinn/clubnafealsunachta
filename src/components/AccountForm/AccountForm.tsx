import { useEffect, useRef, useState } from "react";
import { actions } from "astro:actions";
import ChangeName from "../ChangeName/ChangeName";
import ChangeEmail from "../ChangeEmail/ChangeEmail";
import ChangePassword from "../ChangePassword/ChangePassword";
import Checkbox from "../Checkbox/Checkbox";
import LeaveChapterModal from "../LeaveChapterModal/LeaveChapterModal";
import Avatar from "../Avatar/Avatar";
import { getDisplayName } from "../../lib/memberDisplay";
import { getCachedMember, setCachedMember } from "../../utils/session";
import "../../styles/form.css";

type FieldName = "avatar";
type FieldErrors = Partial<Record<FieldName, string>>;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB — mirrors the server-side cap in actions/avatar.ts

// v1 client-side-only gate per #70's scope (the server re-checks both
// regardless — see actions/avatar.ts): a clear inline message beats a
// generic upload-failed error from the round trip.
function validateAvatarFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Must be an image file";
  if (file.size > MAX_AVATAR_BYTES) return "Must be 5MB or smaller";
  return null;
}

interface Props {
  initialMemberId: string;
  initialUsername: string;
  initialEmail: string;
  initialFullName: string | null;
  initialDisplayFullName: boolean;
  initialAvatarUrl: string | null;
  showChapters: boolean;
  chapters: { id: number; name: string; emailsEnabled: boolean }[];
}

type ChapterState = { emails: boolean };

export default function AccountForm({
  initialMemberId,
  initialUsername,
  initialEmail,
  initialFullName,
  initialDisplayFullName,
  initialAvatarUrl,
  showChapters,
  chapters,
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "uploading" | "saved">("idle");
  // A valid file waiting on the Update button.
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarSavedRef = useRef<HTMLParagraphElement>(null);
  // The Update button unmounts on success, so focus moves to the message.
  useEffect(() => {
    if (avatarStatus === "saved") avatarSavedRef.current?.focus();
  }, [avatarStatus]);
  // #219: everything here saves as it changes, so there's no Save button.
  // A box only flips once its save succeeds; until then it shows what's saved.
  const [chapterState, setChapterState] = useState<Record<number, ChapterState>>(() =>
    Object.fromEntries(chapters.map((chapter) => [chapter.id, { emails: chapter.emailsEnabled }]))
  );
  // Chapters left from here drop out of both lists.
  const [leftChapterIds, setLeftChapterIds] = useState<number[]>([]);
  const [leftNote, setLeftNote] = useState<string | null>(null);
  const leftNoteRef = useRef<HTMLParagraphElement>(null);
  const [savingChapterIds, setSavingChapterIds] = useState<number[]>([]);
  // One status line per chapter, under its email setting.
  const [chapterNotes, setChapterNotes] = useState<Record<number, { text: string; error: boolean }>>({});
  // The chapter whose untick is waiting on the leave confirmation.
  const [confirmLeave, setConfirmLeave] = useState<{ id: number; name: string } | null>(null);
  // The confirmation fades out after confirmLeave clears, so its title keeps
  // the last name rather than reading "Leave ?".
  const [leaveTitleName, setLeaveTitleName] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const leaveReturnFocusRef = useRef<HTMLElement | null>(null);

  const memberChapters = chapters.filter((chapter) => !leftChapterIds.includes(chapter.id));
  const hasChapters = memberChapters.length > 0;
  // The saved name, kept current by the Name section so a rename shows in
  // the avatar's letter straight away.
  const [name, setName] = useState({
    username: initialUsername,
    fullName: initialFullName,
    displayFullName: initialDisplayFullName,
  });
  // Real display name (not a generic "your photo" label) so the letter-avatar
  // fallback shows the same initial as everywhere else on the site.
  const displayName = getDisplayName({
    username: name.username,
    full_name: name.fullName,
    display_full_name: name.displayFullName,
  });

  function setChapter(id: number, change: Partial<ChapterState>) {
    setChapterState((prev) => ({ ...prev, [id]: { ...prev[id]!, ...change } }));
  }

  function setSaving(id: number, saving: boolean) {
    setSavingChapterIds((ids) => (saving ? [...ids, id] : ids.filter((other) => other !== id)));
  }

  function note(id: number, text: string, error = false) {
    setChapterNotes((prev) => ({ ...prev, [id]: { text, error } }));
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    setAvatarStatus("idle");
    setPendingAvatar(null);
    if (!file) {
      setAvatarPreview(null);
      setFieldErrors((prev) => (prev.avatar ? { ...prev, avatar: undefined } : prev));
      return;
    }

    const error = validateAvatarFile(file);
    setFieldErrors((prev) => ({ ...prev, avatar: error ?? undefined }));
    // A locally-rejected file still gets a preview — seeing what you picked
    // (even though it won't upload) is clearer than the input just going
    // quiet on you.
    setAvatarPreview(URL.createObjectURL(file));
    if (!error) setPendingAvatar(file);
  }

  async function uploadAvatar() {
    if (!pendingAvatar) return;
    setAvatarStatus("uploading");
    const formData = new FormData();
    formData.set("avatar", pendingAvatar);
    let result: Awaited<ReturnType<typeof actions.uploadAvatar>> | null = null;
    try {
      result = await actions.uploadAvatar(formData);
    } catch {
      result = null;
    }
    if (!result || result.error || !result.data) {
      // Keeps the chosen file and its preview, so Update can be tried again.
      setAvatarStatus("idle");
      setFieldErrors((prev) => ({
        ...prev,
        avatar:
          result?.error?.code === "CONTENT_TOO_LARGE"
            ? "Your photo is too large to upload. Try a smaller file."
            : result?.error?.message ?? "Something went wrong. Please try again.",
      }));
      return;
    }

    // AccountMenu's header avatar is seeded from this cache on the next page
    // load (see session.ts), so update it now rather than leave the old photo
    // up until the background /api/me fetch catches up.
    const base = getCachedMember() ?? {
      id: initialMemberId,
      username: initialUsername,
      full_name: initialFullName,
      display_full_name: initialDisplayFullName,
      avatar_url: initialAvatarUrl,
    };
    setCachedMember({ ...base, id: initialMemberId, avatar_url: result.data.avatar_url });
    setPendingAvatar(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    setAvatarStatus("saved");
  }

  async function leave() {
    if (!confirmLeave) return;
    const { id, name } = confirmLeave;
    setLeaving(true);
    setLeaveError(null);
    let failed = true;
    try {
      failed = Boolean((await actions.leaveChapter({ chapterId: id })).error);
    } catch {
      failed = true;
    }
    setLeaving(false);
    if (failed) {
      setLeaveError("Something went wrong. Please try again.");
      return;
    }
    setLeftChapterIds((ids) => [...ids, id]);
    setLeftNote(`You've left ${name}.`);
    // Its box is gone, so focus lands on the note saying so.
    leaveReturnFocusRef.current = leftNoteRef.current;
    setConfirmLeave(null);
  }

  async function setEmails(id: number, name: string, enabled: boolean) {
    setSaving(id, true);
    let failed = true;
    let notMember = false;
    try {
      const { error } = await actions.setChapterEmails({ chapterId: id, enabled });
      failed = Boolean(error);
      notMember = error?.code === "NOT_FOUND";
    } catch {
      failed = true;
    }
    setSaving(id, false);
    if (notMember) {
      // Left in another tab or on the chapter page since this page loaded.
      setLeftChapterIds((ids) => [...ids, id]);
      setLeftNote(`You're no longer in ${name}.`);
      leftNoteRef.current?.focus();
      return;
    }
    if (failed) {
      note(id, "Couldn't save that. Please try again.", true);
      return;
    }
    setChapter(id, { emails: enabled });
    note(id, enabled ? `Saved: you'll get emails about ${name}'s events.` : `Saved: no more emails about ${name}'s events.`);
  }

  return (
    // Each part saves on its own, so the form is never submitted.
    <form className="cnf-form" onSubmit={(e) => e.preventDefault()} aria-label="Account settings form" noValidate>

      <fieldset className="cnf-form__fieldset">
        <legend>Account details</legend>
        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="avatar">Photo</label>
          <div className="cnf-form__avatar-row">
            <Avatar avatarUrl={avatarPreview ?? initialAvatarUrl} alt={displayName} id={initialMemberId} size="lg" />
            <input
              ref={avatarInputRef}
              id="avatar"
              type="file"
              name="avatar"
              accept="image/*"
              className="cnf-form__input"
              onChange={handleAvatarChange}
              disabled={avatarStatus === "uploading"}
              aria-invalid={!!fieldErrors.avatar}
            />
          </div>
          <p className="cnf-form__hint">JPG, PNG, or similar, up to 5MB.</p>
          {pendingAvatar && (
            <button
              type="button"
              className={`cnf-button cnf-button__gold cnf-form__avatar-update${avatarStatus === "uploading" ? " cnf-button--loading" : ""}`}
              // aria-disabled, not disabled: a disabled button drops focus.
              aria-disabled={avatarStatus === "uploading"}
              aria-busy={avatarStatus === "uploading"}
              onClick={() => {
                if (avatarStatus !== "uploading") uploadAvatar();
              }}
            >
              <span className="cnf-button__text">Update photo</span>
            </button>
          )}
          {/* The live region stays put; the tinted message only appears
              once there's something to say. */}
          <div className="cnf-form__status" aria-live="polite">
            {avatarStatus === "saved" && (
              <p ref={avatarSavedRef} tabIndex={-1} className="cnf-form__message--success">
                Your photo is updated.
              </p>
            )}
          </div>
          {fieldErrors.avatar && (
            <div className="cnf-form__message--error" role="alert">
              {fieldErrors.avatar}
            </div>
          )}
        </div>

        <ChangeName
          memberId={initialMemberId}
          username={initialUsername}
          fullName={initialFullName}
          displayFullName={initialDisplayFullName}
          avatarUrl={initialAvatarUrl}
          onSaved={setName}
        />

        <ChangeEmail email={initialEmail} />

        <ChangePassword />
      </fieldset>

      {showChapters && (
        <fieldset className="cnf-form__fieldset">
          <legend>Chapter memberships</legend>

          {/* One line for both states. After leaving, focus moves here, which
              reads out "You've left …" (a live region too would read it twice). */}
          <p ref={leftNoteRef} tabIndex={-1} className="cnf-form__hint">
            {leftNote && <>{leftNote} </>}
            {hasChapters ? (
              "Untick a chapter to leave it. To join one, use the button on its page."
            ) : (
              <>
                You haven't joined a chapter yet. Find one on the <a href="/chapters">chapters page</a>.
              </>
            )}
          </p>

          {hasChapters && (
            <div className="cnf-form__group">
              {memberChapters.map((chapter) => (
                <Checkbox
                  key={chapter.id}
                  id={`chapter-${chapter.id}`}
                  name="chapter_id"
                  value={String(chapter.id)}
                  // Stays ticked until leaving is confirmed and saved.
                  checked
                  label={chapter.name}
                  onChange={(e) => {
                    leaveReturnFocusRef.current = e.target;
                    setLeaveError(null);
                    setLeaveTitleName(chapter.name);
                    setConfirmLeave({ id: chapter.id, name: chapter.name });
                  }}
                />
              ))}
            </div>
          )}
          {/* Outside the list, so leaving the last chapter doesn't unmount it
              mid-close. */}
          <LeaveChapterModal
            isOpen={confirmLeave !== null}
            chapterName={leaveTitleName}
            leaving={leaving}
            error={leaveError}
            onConfirm={leave}
            onCancel={() => setConfirmLeave(null)}
            returnFocusRef={leaveReturnFocusRef}
          />
        </fieldset>
      )}

      {showChapters && (
        <fieldset id="email-notifications" className="cnf-form__fieldset">
          <legend>Email notifications</legend>

          {hasChapters ? (
            <>
              <p className="cnf-form__hint">Get an email when a chapter you're in posts a new event.</p>

              <div className="cnf-form__group">
                {memberChapters.map((chapter) => {
                  const state = chapterState[chapter.id]!;
                  const noteId = `chapter-${chapter.id}-note`;
                  const chapterNote = chapterNotes[chapter.id];
                  return (
                    <div key={chapter.id}>
                      <Checkbox
                        id={`chapter-${chapter.id}-emails`}
                        name="chapter_emails"
                        value={String(chapter.id)}
                        checked={state.emails}
                        // Not disabled while saving, which would drop
                        // keyboard focus; extra clicks are ignored instead.
                        busy={savingChapterIds.includes(chapter.id)}
                        describedBy={noteId}
                        label={`Upcoming events in ${chapter.name}`}
                        onChange={(e) => {
                          if (!savingChapterIds.includes(chapter.id)) setEmails(chapter.id, chapter.name, e.target.checked);
                        }}
                      />
                      {/* Always rendered so screen readers announce each save. */}
                      <p
                        id={noteId}
                        className={
                          !chapterNote
                            ? "cnf-form__hint"
                            : chapterNote.error
                              ? "cnf-form__message--error"
                              : "cnf-form__message--success"
                        }
                        aria-live="polite"
                      >
                        {chapterNote?.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="cnf-form__hint">Join a chapter to get emails about its events.</p>
          )}
        </fieldset>
      )}

    </form>
  );
}
