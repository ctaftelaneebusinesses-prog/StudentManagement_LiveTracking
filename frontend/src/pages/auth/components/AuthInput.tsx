import { InputHTMLAttributes, ReactNode, forwardRef, useId } from "react";

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Optional leading glyph (e.g. Mail/Lock from lucide-react) — shifts the field and its label right to make room. */
  icon?: ReactNode;
}

/**
 * Floating-label input for the glassmorphism auth panels (Login/Register) —
 * a distinct visual system from the dashboard's plain `Input` by design (see
 * AuthSplitLayout's header comment). The label sits inline as a placeholder
 * until the field has content or focus, then floats above the border via a
 * peer-* variant, the standard floating-label CSS trick.
 *
 * The field itself is a solid white "premium enterprise" surface (not the
 * translucent glass the rest of the card uses) — deliberate contrast against
 * AuthGlassCard's dark backdrop, and it keeps this exact DOM shape
 * (wrapper > input + label, not a separate label row) on purpose:
 * AuthPasswordInput absolutely-positions its copy/show/generate buttons
 * against this same wrapper at a fixed top offset, so restructuring to a
 * static label-above-input layout would misalign those buttons there.
 */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, id, className = "", placeholder, icon, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            placeholder=" "
            className={`auth-input peer w-full rounded-xl border bg-white ${icon ? "pl-11" : "pl-3.5"} pb-3 pr-3.5 pt-5 text-sm text-slate-900 outline-none transition-all
              placeholder:text-transparent hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15
              disabled:cursor-not-allowed disabled:opacity-50
              ${error ? "border-red-400 focus:border-red-400 focus:ring-red-400/15" : "border-slate-200"} ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          <label
            htmlFor={inputId}
            className={`pointer-events-none absolute ${icon ? "left-11" : "left-3.5"} top-2 origin-left text-xs text-slate-500 transition-all
              peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400
              peer-focus:top-2 peer-focus:text-xs peer-focus:text-brand-600`}
          >
            {label}
          </label>
          {icon && (
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors peer-focus:text-brand-600"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
