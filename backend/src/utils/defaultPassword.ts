import { randomBytes } from "crypto";

/**
 * Generates a one-time initial password for a provisioned account when the
 * admin does not supply one (e.g. a bulk-import row).
 *
 * SEC-13: this MUST NOT be predictable. The previous scheme (first 5 letters of
 * the name + a known id such as phone/roll no/employee id) let anyone who knew
 * the person's name and id guess their password. The value is now
 * cryptographically random.
 *
 * The parameters are kept only for call-site compatibility; they are
 * deliberately NOT used to derive the secret. The generated value is never
 * logged. The account should complete setup via the password-reset flow; an
 * admin who needs to hand over an initial credential should reset it explicitly
 * rather than rely on a derivable default.
 */
export function generateDefaultPassword(_fullName?: string, _idPart?: string): string {
  // 18 random bytes -> 24 url-safe chars (~144 bits). Append one char from each
  // class so the result satisfies any downstream strength policy regardless of
  // what the random bytes happen to contain.
  const random = randomBytes(18).toString("base64url");
  return `${random}Aa1!`;
}
