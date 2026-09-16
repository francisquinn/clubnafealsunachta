import { useState } from "react";
import { actions } from "astro:actions";
import { validateUsername, validateFullName, validatePassword } from "../../utils/validation";
import Checkbox from "../Checkbox/Checkbox";
import Avatar from "../Avatar/Avatar";
import { getDisplayName } from "../../lib/memberDisplay";
import { getCachedMember, setCachedMember } from "../../utils/session";
import "../../styles/form.css";

type FieldName = "username" | "full_name" | "current_password" | "new_password" | "confirm_password" | "avatar";
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
  initialFullName: string | null;
  initialDisplayFullName: boolean;
  initialAvatarUrl: string | null;
  clubs: { id: number; name: string }[];
  initialClubIds: number[];
}

function capitalize(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// "a" -> "a", "a and b" -> "a and b", "a, b, and c" -> "a, b, and c" — scales
// to however many parts of the form actually saved this time.
function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export default function AccountForm({
  initialMemberId,
  initialUsername,
  initialFullName,
  initialDisplayFullName,
  initialAvatarUrl,
  clubs,
  initialClubIds,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const hasClubs = clubs.length > 0;
  // Real display name (not a generic "your photo" label) so the letter-avatar
  // fallback shows the same initial as everywhere else on the site.
  const displayName = getDisplayName({
    username: initialUsername,
    full_name: initialFullName,
    display_full_name: initialDisplayFullName,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.name as FieldName;
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
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
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const username = formData.get("username")?.toString().trim() ?? "";
    const fullName = formData.get("full_name")?.toString().trim() ?? "";
    const currentPassword = formData.get("current_password")?.toString() ?? "";
    const newPassword = formData.get("new_password")?.toString() ?? "";
    const confirmPassword = formData.get("confirm_password")?.toString() ?? "";
    const avatarFile = formData.get("avatar");
    // An empty file input still shows up in FormData, just as a zero-size File.
    const wantsAvatarUpload = avatarFile instanceof File && avatarFile.size > 0;
    // Mirrors updateUsername.ts's own parsing — needed locally too, to cache
    // the right value alongside username/full_name below.
    const displayFullName = formData.get("display_full_name") === "true";

    // A filled-in "new password" is what signals intent to change the password, not
    // "current password" — password managers autofill current-password fields on page
    // load, which would otherwise make an untouched form look like a password-change
    // attempt.
    const wantsPasswordChange = newPassword !== "";

    const errors: FieldErrors = {
      username: validateUsername(username) ?? undefined,
      full_name: validateFullName(fullName) ?? undefined,
      current_password: wantsPasswordChange && !currentPassword ? "Enter your current password" : undefined,
      new_password: wantsPasswordChange ? validatePassword(newPassword) ?? undefined : undefined,
      confirm_password: wantsPasswordChange && newPassword !== confirmPassword ? "Passwords do not match" : undefined,
      avatar: wantsAvatarUpload ? validateAvatarFile(avatarFile) ?? undefined : undefined,
    };
    setFieldErrors(errors);

    if (Object.values(errors).some(Boolean)) {
      return;
    }

    setStatus("loading");

    try {
      // updateUsername and uploadAvatar each independently rebuild the full
      // cnf_avatar_hint cookie (name + photo together) from a fresh DB read,
      // so running them in parallel races whichever Set-Cookie the browser
      // applies last — the cookie could end up pairing a new username with
      // the old photo, or vice versa. Sequencing them (avatar first) means
      // updateUsername's read/cookie-write always reflects both changes.
      const avatarResult = wantsAvatarUpload ? await actions.uploadAvatar(formData) : null;
      const [usernameResult, passwordResult, clubsResult] = await Promise.all([
        actions.updateUsername(formData),
        wantsPasswordChange ? actions.changePassword(formData) : Promise.resolve(null),
        hasClubs ? actions.updateClubMemberships(formData) : Promise.resolve(null),
      ]);

      const parts: { label: string; code?: string; error: string | null }[] = [
        { label: "info", code: usernameResult.error?.code, error: usernameResult.error?.message ?? null },
      ];
      if (wantsPasswordChange) {
        parts.push({ label: "password", code: passwordResult?.error?.code, error: passwordResult?.error?.message ?? null });
      }
      if (hasClubs) {
        parts.push({ label: "club settings", code: clubsResult?.error?.code, error: clubsResult?.error?.message ?? null });
      }
      if (wantsAvatarUpload) {
        parts.push({ label: "photo", code: avatarResult?.error?.code, error: avatarResult?.error?.message ?? null });
      }

      const failedParts = parts.filter((p) => p.error);
      const succeededLabels = parts.filter((p) => !p.error).map((p) => p.label);

      // AccountMenu's header avatar is seeded from this same cache on the
      // next page load (see session.ts) — updating it here, right when a
      // save actually succeeds, means that next load is already correct
      // instead of showing the just-replaced photo/letter for one more
      // load until the background /api/me fetch catches up.
      if (!usernameResult.error || (wantsAvatarUpload && !avatarResult?.error)) {
        const base = getCachedMember() ?? {
          id: initialMemberId,
          username: initialUsername,
          full_name: initialFullName,
          display_full_name: initialDisplayFullName,
          avatar_url: initialAvatarUrl,
        };
        setCachedMember({
          ...base,
          id: initialMemberId,
          ...(!usernameResult.error ? { username, full_name: fullName || null, display_full_name: displayFullName } : {}),
          ...(wantsAvatarUpload && !avatarResult?.error && avatarResult?.data
            ? { avatar_url: avatarResult.data.avatar_url }
            : {}),
        });
      }

      if (failedParts.length === 0) {
        setStatus("success");
        setMessage(`Your ${joinWithAnd(succeededLabels)} ${succeededLabels.length > 1 ? "have" : "has"} been updated.`);
        return;
      }

      setStatus("error");

      // A too-large request fails before it even reaches the server, so it
      // always takes every part of this shared submission down together
      // (all parts post the same FormData, avatar file included) — the raw
      // "Request body exceeds N bytes" repeated per field reads like three
      // separate problems when it's really just one oversized photo.
      if (failedParts.every((p) => p.code === "CONTENT_TOO_LARGE")) {
        setMessage(
          wantsAvatarUpload
            ? "Your photo is too large to submit. Try a smaller file."
            : "That's too much to submit at once. Try again with less at a time."
        );
        return;
      }

      const failedText = failedParts.map((p) => `${capitalize(p.label)} unchanged: ${p.error}`).join(" ");
      setMessage(
        succeededLabels.length > 0
          ? `Your ${joinWithAnd(succeededLabels)} ${succeededLabels.length > 1 ? "have" : "has"} been updated. ${failedText}`
          : failedText
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p>{message}</p>;
  }

  return (
    <form className="cnf-form" onSubmit={handleSubmit} aria-label="Account settings form" noValidate>
      {message && <div className="cnf-form__message--error">{message}</div>}

      <fieldset className="cnf-form__fieldset">
        <legend className="cnf-visually-hidden">Profile details</legend>
        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="avatar">Photo</label>
          <Avatar avatarUrl={avatarPreview ?? initialAvatarUrl} alt={displayName} id={initialMemberId} size="lg" />
          <input
            id="avatar"
            type="file"
            name="avatar"
            accept="image/*"
            className="cnf-form__input"
            onChange={handleAvatarChange}
            aria-invalid={!!fieldErrors.avatar}
          />
          <p className="cnf-form__hint">Optional. JPG, PNG, or similar, up to 5MB.</p>
          {fieldErrors.avatar && <div className="cnf-form__message--error">{fieldErrors.avatar}</div>}
        </div>

        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            name="username"
            className="cnf-form__input"
            defaultValue={initialUsername}
            required
            onChange={handleChange}
            aria-invalid={!!fieldErrors.username}
          />
          <p className="cnf-form__hint">3-20 characters: letters, numbers, and underscores only.</p>
          {fieldErrors.username && <div className="cnf-form__message--error">{fieldErrors.username}</div>}
        </div>

        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            type="text"
            name="full_name"
            className="cnf-form__input"
            defaultValue={initialFullName ?? ""}
            onChange={handleChange}
            aria-invalid={!!fieldErrors.full_name}
          />
          {fieldErrors.full_name && <div className="cnf-form__message--error">{fieldErrors.full_name}</div>}
        </div>

        <div className="cnf-form__group">
          <Checkbox
            id="display_full_name"
            name="display_full_name"
            value="true"
            defaultChecked={initialDisplayFullName}
            label="Show my full name instead of my username"
          />
        </div>
      </fieldset>

      <fieldset className="cnf-form__fieldset">
        <legend>Change password</legend>

        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            name="current_password"
            className="cnf-form__input"
            autoComplete="current-password"
            onChange={handleChange}
            aria-invalid={!!fieldErrors.current_password}
          />
          <p className="cnf-form__hint">Leave these blank to keep your current password.</p>
          {fieldErrors.current_password && <div className="cnf-form__message--error">{fieldErrors.current_password}</div>}
        </div>

        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            name="new_password"
            className="cnf-form__input"
            autoComplete="new-password"
            onChange={handleChange}
            aria-invalid={!!fieldErrors.new_password}
          />
          <p className="cnf-form__hint">At least 8 characters, with a number and an uppercase letter.</p>
          {fieldErrors.new_password && <div className="cnf-form__message--error">{fieldErrors.new_password}</div>}
        </div>

        <div className="cnf-form__group">
          <label className="cnf-form__label" htmlFor="confirm-new-password">Confirm new password</label>
          <input
            id="confirm-new-password"
            type="password"
            name="confirm_password"
            className="cnf-form__input"
            autoComplete="new-password"
            onChange={handleChange}
            aria-invalid={!!fieldErrors.confirm_password}
          />
          {fieldErrors.confirm_password && <div className="cnf-form__message--error">{fieldErrors.confirm_password}</div>}
        </div>
      </fieldset>

      {hasClubs && (
        <fieldset className="cnf-form__fieldset">
          <legend>Club memberships</legend>

          <p className="cnf-form__hint">Select the clubs you're part of.</p>

          <div className="cnf-form__group">
            {clubs.map((club) => (
              <Checkbox
                key={club.id}
                id={`club-${club.id}`}
                name="club_id"
                value={String(club.id)}
                defaultChecked={initialClubIds.includes(club.id)}
                label={club.name}
              />
            ))}
          </div>
        </fieldset>
      )}

      <button type="submit" disabled={status === "loading"} aria-busy={status === "loading"} className={`cnf-form__submit cnf-button cnf-button__gold${status === "loading" ? " cnf-button--loading" : ""}`}>
        <span className="cnf-button__text">Save</span>
      </button>
    </form>
  );
}
