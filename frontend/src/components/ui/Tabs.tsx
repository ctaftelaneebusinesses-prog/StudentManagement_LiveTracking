import type { LucideIcon } from "lucide-react";

export interface TabItem<T extends string> {
  key: T;
  label: string;
  icon?: LucideIcon;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-black/[0.06] bg-white p-1 dark:border-white/[0.08] dark:bg-[#17171a]">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
            active === key
              ? "bg-accent-600 text-white shadow-sm"
              : "text-[var(--ink-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          }`}
        >
          {Icon && <Icon size={16} strokeWidth={1.75} />}
          {label}
        </button>
      ))}
    </div>
  );
}
