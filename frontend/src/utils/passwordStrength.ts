export type PasswordStrength = "empty" | "weak" | "fair" | "good" | "strong";

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: "",
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  empty: "bg-transparent",
  weak: "bg-red-500",
  fair: "bg-amber-500",
  good: "bg-brand-500",
  strong: "bg-emerald-500",
};

/**
 * Dependency-free strength heuristic (no zxcvbn in package.json, and this
 * doesn't need to be cryptographically rigorous — just a helpful, honest
 * signal): length + character-class diversity, same idea every password
 * meter uses, scored 0-4.
 */
export function scorePasswordStrength(password: string): PasswordStrength {
  if (!password) return "empty";

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score <= 4) return "good";
  return "strong";
}

export function passwordStrengthLabel(strength: PasswordStrength): string {
  return STRENGTH_LABEL[strength];
}

export function passwordStrengthColor(strength: PasswordStrength): string {
  return STRENGTH_COLOR[strength];
}

/** Strong random password: uppercase, lowercase, digit, special char, then padded to 12 chars from a broad pool — always passes its own "strong" scoring. */
export function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*?";
  const all = upper + lower + digits + special;

  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));

  const chars = [...required, ...rest];
  // Fisher-Yates shuffle so the required chars aren't always in the same spot.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
