import { describe, it, expect } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { memberInsertErrorMessage } from "./memberErrors";

function makeError(overrides: Partial<PostgrestError>): PostgrestError {
  return {
    name: "PostgrestError",
    message: "",
    details: "",
    hint: "",
    code: "",
    ...overrides,
  } as PostgrestError;
}

describe("memberInsertErrorMessage", () => {
  it("maps a unique violation on email to a CONFLICT with an email-specific message", () => {
    const error = makeError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "members_email_key"',
      details: "Key (email)=(user@example.com) already exists.",
    });

    expect(memberInsertErrorMessage(error)).toEqual({
      code: "CONFLICT",
      message: "An account with that email already exists",
    });
  });

  it("maps a unique violation on username to a CONFLICT with a username-specific message", () => {
    const error = makeError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "members_username_key"',
      details: "Key (username)=(validuser) already exists.",
    });

    expect(memberInsertErrorMessage(error)).toEqual({
      code: "CONFLICT",
      message: "That username is already taken",
    });
  });

  it("maps a unique violation on the case-insensitive username index to a CONFLICT with a username-specific message", () => {
    const error = makeError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "members_username_lower_idx"',
      details: "Key (lower(username))=(validuser) already exists.",
    });

    expect(memberInsertErrorMessage(error)).toEqual({
      code: "CONFLICT",
      message: "That username is already taken",
    });
  });

  it("falls back to a generic error for a unique violation on an unrecognized column", () => {
    const error = makeError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "members_some_other_key"',
      details: "Key (some_other_column)=(x) already exists.",
    });

    expect(memberInsertErrorMessage(error)).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create account",
    });
  });

  it("falls back to a generic error for non-unique-violation errors", () => {
    const error = makeError({ code: "PGRST301", message: "RLS denied the insert" });

    expect(memberInsertErrorMessage(error)).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create account",
    });
  });
});
