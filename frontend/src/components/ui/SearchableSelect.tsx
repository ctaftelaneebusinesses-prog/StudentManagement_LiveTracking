import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  name?: string;
}

/**
 * Type-to-filter single-select combobox. Options can grow long (e.g. subject
 * lists) where a plain <select> gets unwieldy — this keeps the same value
 * contract as Select (a plain string value) so it drops into react-hook-form
 * via a controlled `value`/`onChange` pair instead of `register()`.
 */
export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  error,
  disabled,
  name,
}: SearchableSelectProps) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="relative">
        <button
          type="button"
          name={name}
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm outline-none transition-colors
            focus:border-brand-500 focus:ring-1 focus:ring-brand-500
            disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500
            dark:bg-white/10 dark:text-white dark:disabled:bg-white/[0.03] dark:disabled:text-slate-500
            ${error ? "border-red-500 dark:border-red-500" : "border-slate-300 dark:border-white/20"}`}
        >
          <span className={selected ? "" : "text-slate-400 dark:text-slate-500"}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={15} className="shrink-0 text-slate-400" />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#1c1c1f]">
            <div className="relative border-b border-slate-100 p-2 dark:border-white/10">
              <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                  }
                }}
                placeholder="Search..."
                className="w-full rounded-md border-0 bg-slate-50 py-1.5 pl-7 pr-2 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-brand-500 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">No matches</p>
              )}
              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/10 ${
                    option.value === value
                      ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
