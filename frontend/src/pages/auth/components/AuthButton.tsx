import { ButtonHTMLAttributes, forwardRef } from "react";
import { ArrowRight } from "lucide-react";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

/**
 * Primary call-to-action for the Login/Register flow — a brand→accent
 * gradient pill with a hover-slide arrow, distinct from the flat
 * `components/ui/Button` used across the rest of the (utilitarian) app by
 * design, same reasoning as AuthGlassCard/AuthInput.
 */
export const AuthButton = forwardRef<HTMLButtonElement, AuthButtonProps>(
  ({ isLoading, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_rgba(14,165,160,0.55)] transition-all hover:shadow-[0_16px_36px_-8px_rgba(14,165,160,0.65)] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 ${className}`}
        {...props}
      >
        {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {children}
        {!isLoading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
    );
  }
);

AuthButton.displayName = "AuthButton";
