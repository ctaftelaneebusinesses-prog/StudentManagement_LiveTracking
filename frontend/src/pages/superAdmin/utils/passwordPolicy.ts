/**
 * Client-side mirror of the backend's `strongPassword` zod schema
 * (backend/src/validators/superAdmin.validator.ts). Keep the two in sync — the
 * server is the real gate, this only exists so the operator gets an inline
 * message instead of a round-trip 400.
 */
export const PASSWORD_POLICY_HINT =
  "At least 10 characters, including an uppercase letter, a lowercase letter, a number and a symbol.";

export function isStrongEnough(password: string): boolean {
  return (
    password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}
