const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return "Please enter a valid username";
  }
  return null;
}

export function validateFullName(fullName: string): string | null {
  if (fullName.length > 100) {
    return "Full name must be 100 characters or fewer";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  return null;
}
