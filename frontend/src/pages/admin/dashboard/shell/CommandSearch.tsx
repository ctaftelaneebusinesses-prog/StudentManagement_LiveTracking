import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { ALL_ADMIN_NAV_ITEMS } from "./navConfig";

export function CommandSearch() {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ADMIN_NAV_ITEMS;
    return ALL_ADMIN_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => setActiveIndex(0), [query]);

  function go(index: number) {
    const item = results[index];
    if (!item) return;
    navigate(item.to);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(activeIndex);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-sm items-center gap-2.5 rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-left text-sm text-[var(--ink-muted)] transition-colors hover:bg-black/[0.05] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
      >
        <Search size={16} strokeWidth={1.85} />
        <span className="hidden flex-1 sm:inline">Search students, teachers, classes…</span>
        <span className="hidden shrink-0 rounded border border-black/[0.1] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)] dark:border-white/[0.15] md:inline">
          ⌘K
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
            <div
              className="absolute inset-0 bg-black/50 animate-fade-in"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="relative w-full max-w-lg animate-slide-up overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-2xl dark:border-white/[0.1] dark:bg-[#1c1c1f]">
              <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
                <Search size={17} className="text-[var(--ink-muted)]" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search for a page or module…"
                  className="w-full bg-transparent text-sm text-[var(--ink-primary)] outline-none placeholder:text-[var(--ink-muted)]"
                />
                <kbd className="shrink-0 rounded border border-black/[0.1] px-1.5 py-0.5 text-[10px] text-[var(--ink-muted)] dark:border-white/[0.15]">
                  Esc
                </kbd>
              </div>
              <div className="max-h-80 overflow-y-auto p-1.5">
                {results.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-[var(--ink-muted)]">No matches for "{query}"</p>
                ) : (
                  results.map((item, i) => (
                    <button
                      key={item.to}
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(i)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        i === activeIndex
                          ? "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
                          : "text-[var(--ink-secondary)]"
                      }`}
                    >
                      <item.icon size={16} strokeWidth={1.85} />
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
