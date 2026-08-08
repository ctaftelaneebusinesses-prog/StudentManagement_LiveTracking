import { ReactNode } from "react";

export function FormSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 border-b border-slate-200 pb-1.5 text-sm font-semibold text-slate-700 first:mt-0 dark:border-white/10 dark:text-slate-200">
      {children}
    </h3>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];
