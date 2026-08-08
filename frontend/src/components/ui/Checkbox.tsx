import { InputHTMLAttributes, forwardRef } from "react";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={`h-4 w-4 cursor-pointer rounded border-slate-300 text-accent-600 focus:ring-2 focus:ring-accent-500 focus:ring-offset-0 dark:border-white/20 dark:bg-white/10 ${className}`}
      {...props}
    />
  );
});
Checkbox.displayName = "Checkbox";
