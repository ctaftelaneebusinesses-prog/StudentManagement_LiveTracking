/** India's 28 states + 8 union territories — stable, well-defined list (current post-2020 reorganization). */
export const INDIAN_STATE_OPTIONS = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
].map((name) => ({ value: name, label: name }));

/**
 * Common nationalities for a school admission form, not an exhaustive
 * country list. "Other" is paired with a free-text fallback in the form
 * itself rather than trying to enumerate every possible nationality here.
 */
export const NATIONALITY_OPTIONS = [
  "Indian",
  "American",
  "British",
  "Canadian",
  "Australian",
  "Pakistani",
  "Bangladeshi",
  "Nepali",
  "Sri Lankan",
  "Bhutanese",
  "Afghan",
  "Other",
].map((name) => ({ value: name, label: name }));

export const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((name) => ({
  value: name,
  label: name,
}));

/** "Other" is paired with a free-text fallback in the form, same pattern as nationality. */
export const RELIGION_OPTIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other"].map((name) => ({
  value: name,
  label: name,
}));

export const CATEGORY_OPTIONS = ["General", "OBC", "SC", "ST", "EWS", "Other"].map((name) => ({
  value: name,
  label: name,
}));

/**
 * The `country-state-city` package ships every country's full city dataset
 * (~150k rows) — dynamically imported so it never lands in the main bundle,
 * only pulled in when a location field is actually used.
 *
 * India has no well-maintained district-level dataset available anywhere
 * (checked at build time — no viable npm package covers it reliably), so
 * this package's per-state "city" list is used as the practical stand-in
 * for the district tier; the finest data this package actually offers.
 * The user then still has a free-text City field beneath it for the exact
 * town/area, satisfying the "let me add one that's not listed" requirement.
 */
export async function getDistrictOptionsForState(stateName: string): Promise<{ value: string; label: string }[]> {
  if (!stateName) return [];
  const { State, City } = await import("country-state-city");
  const state = State.getStatesOfCountry("IN").find((s) => s.name === stateName);
  if (!state) return [];
  return City.getCitiesOfState("IN", state.isoCode)
    .map((c) => ({ value: c.name, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
