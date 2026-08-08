import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { buildCalendarGrid, formatDisplayDate, MONTH_LABELS, WEEKDAY_LABELS } from "@/utils/date";

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  id?: string;
}

export function DatePicker({ label, value, onChange, error, placeholder = "Select date", minDate, maxDate, id }: DatePickerProps) {
  const [isOpen, setOpen] = useState(false);
  const today = new Date();
  const initial = value ? new Date(`${value}T00:00:00`) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const cells = buildCalendarGrid(viewYear, viewMonth);

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef}>
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <button
        type="button"
        id={inputId}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`flex items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm shadow-sm outline-none transition-colors
          focus:border-brand-500 focus:ring-1 focus:ring-brand-500
          dark:bg-white/10 dark:text-white
          ${value ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}
          ${error ? "border-red-500 dark:border-red-500" : "border-slate-300 dark:border-white/20"}`}
      >
        <span>{value ? formatDisplayDate(value) : placeholder}</span>
        <Calendar size={15} className="text-slate-400 dark:text-slate-500" />
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {isOpen && (
        <div
          role="dialog"
          className="absolute top-full z-20 mt-1 w-72 rounded-lg border border-black/[0.08] bg-white p-3 shadow-lg dark:border-white/[0.1] dark:bg-[#1c1c1f]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-[var(--ink-primary)]">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-medium text-[var(--ink-muted)]">
            {WEEKDAY_LABELS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const isSelected = cell.iso === value;
              const isDisabled = (!!minDate && cell.iso < minDate) || (!!maxDate && cell.iso > maxDate);
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors
                    disabled:cursor-not-allowed disabled:opacity-30
                    ${isSelected ? "bg-accent-600 font-semibold text-white" : "hover:bg-accent-50 dark:hover:bg-accent-500/10"}
                    ${!cell.isCurrentMonth && !isSelected ? "text-[var(--ink-muted)]" : "text-[var(--ink-primary)]"}`}
                >
                  {cell.date}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
