import { z } from "zod";

/**
 * The password field is optional (omit it and the backend generates a
 * default), but every "Add X" form's password input defaults to/clears to
 * "" rather than leaving the field untouched — plain `.min(6).optional()`
 * rejects "" as a too-short password instead of treating it as "not set",
 * so this normalizes "" to undefined first, same idea as the class_id
 * `optionalUuid` fix.
 */
export const optionalPassword = z.preprocess(
  (val) => (val === "" ? undefined : val),
  z.string().min(6, "Password must be at least 6 characters").optional()
);

/** "" is normalized to undefined so an untouched optional field doesn't fail the digit-count check. */
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

export const optionalPhone = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits")
    .optional()
);

export const optionalAadhaar = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits")
    .optional()
);

/** An unselected <input type="date"> or <select> submits "" — same "" vs "not provided" fix as optionalUuid/optionalPassword. */
export const optionalDate = z.preprocess(emptyToUndefined, z.string().date().optional());

export const optionalGender = z.preprocess(emptyToUndefined, z.enum(["male", "female", "other"]).optional());

/** Self-registration's Mobile Number field is mandatory (unlike the admin-side "Add X" forms, which keep it optional). */
export const requiredPhone = z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits");

/** Student self-registration's Gender field is mandatory — the student dashboard theme is derived from it (see PortalThemeContext.tsx). */
export const requiredGender = z.enum(["male", "female", "other"], { errorMap: () => ({ message: "Select a gender" }) });
