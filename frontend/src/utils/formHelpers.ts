import { UseFormRegisterReturn } from "react-hook-form";

/**
 * Wraps a react-hook-form registration so the field strips non-digit
 * characters and caps length as the user types, instead of only rejecting
 * bad input on submit. Mutating `e.target.value` in place works because RHF
 * registers uncontrolled inputs — the DOM node's own value updates
 * immediately, and RHF's onChange then reads that same (now-clean) value.
 */
export function digitsOnly(registration: UseFormRegisterReturn, maxLength: number): UseFormRegisterReturn {
  return {
    ...registration,
    onChange: (e: { target: { value: string }; type?: string }) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, maxLength);
      return registration.onChange(e as Parameters<UseFormRegisterReturn["onChange"]>[0]);
    },
  };
}

export const PHONE_PATTERN = {
  value: /^\d{10}$/,
  message: "Phone number must be exactly 10 digits",
};

export const AADHAAR_PATTERN = {
  value: /^\d{12}$/,
  message: "Aadhaar number must be exactly 12 digits",
};
