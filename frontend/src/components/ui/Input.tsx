import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors
            placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500
            disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500
            dark:bg-white/10 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-white/[0.03] dark:disabled:text-slate-500
            ${error ? "border-red-500 dark:border-red-500" : "border-slate-300 dark:border-white/20"} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
