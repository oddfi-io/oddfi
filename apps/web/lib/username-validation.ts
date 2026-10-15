export type UsernameErrorCode =
  | "tooShort"
  | "tooLong"
  | "invalidChars"
  | "consecutiveSpecial"
  | "edgeSpecial";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

const ALLOWED_CHARS = /^[a-zA-Z0-9._\-]+$/;
const EDGE_SPECIAL = /^[._\-]|[._\-]$/;
const CONSECUTIVE_SPECIAL = /[._\-]{2}/;

export function validateUsername(input: string): UsernameErrorCode | null {
  const value = input.trim();
  if (value.length === 0) return null;
  if (value.length < USERNAME_MIN_LENGTH) return "tooShort";
  if (value.length > USERNAME_MAX_LENGTH) return "tooLong";
  if (!ALLOWED_CHARS.test(value)) return "invalidChars";
  if (EDGE_SPECIAL.test(value)) return "edgeSpecial";
  if (CONSECUTIVE_SPECIAL.test(value)) return "consecutiveSpecial";
  return null;
}

export function isValidUsername(input: string): boolean {
  return validateUsername(input) === null;
}
