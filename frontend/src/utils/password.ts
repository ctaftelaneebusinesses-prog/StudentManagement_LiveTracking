/**
 * SEC-13: generates a cryptographically RANDOM initial password for the admin
 * "Generate" buttons. The admin sees the value once and shares it with the
 * user (the app's deliberate no-email provisioning model); the user can then
 * change it, or use "Forgot password" to set their own.
 *
 * The previous scheme (first 5 letters of the name + a known id such as
 * phone/roll no/employee id) was predictable — anyone who knew the person's
 * name and id could guess it. The parameters are kept only so the many call
 * sites don't change; they are deliberately NOT used to derive the secret.
 */
export function generateDefaultPassword(_fullName?: string, _idPart?: string): string {
  // Ambiguous characters (0/O, 1/l/I) omitted so a shared password is easy to
  // read and type. ~14 chars from this set is well over 64 bits of entropy.
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = lower + upper + digits + symbols;

  const pick = (set: string, n: number): string => {
    const out: string[] = [];
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    for (let i = 0; i < n; i++) out.push(set[buf[i] % set.length]);
    return out.join("");
  };

  // Guarantee one of each class, then fill to length 14, then shuffle.
  const base = pick(lower, 1) + pick(upper, 1) + pick(digits, 1) + pick(symbols, 1) + pick(all, 10);
  const chars = base.split("");
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = order[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
