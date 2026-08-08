import { InputHTMLAttributes, forwardRef, useId } from "react";

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * Floating-label input for the glassmorphism auth panels (Login/Register) —
 * a distinct visual system from the dashboard's plain `Input` by design (see
 * AuthSplitLayout's header comment). The label sits inline as a placeholder
 * until the field has content or focus, then floats above the border via a
 * peer-* variant, the standard floating-label CSS trick.
 */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, id, className = "", placeholder, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            placeholder=" "
            className={`auth-input peer w-full rounded-lg border bg-white/5 px-3.5 pb-2 pt-5 text-sm text-white outline-none backdrop-blur transition-colors
              placeholder:text-transparent hover:border-white/25 focus:border-brand-400 focus:bg-white/[0.08] focus:ring-1 focus:ring-brand-400
              disabled:cursor-not-allowed disabled:opacity-50
              ${error ? "border-red-400 focus:border-red-400 focus:ring-red-400" : "border-white/15"} ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          <label
            htmlFor={inputId}
            className="pointer-events-none absolute left-3.5 top-2 origin-left text-xs text-slate-400 transition-all
              peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400
              peer-focus:top-2 peer-focus:text-xs peer-focus:text-brand-300"
          >
            {label}
          </label>
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
