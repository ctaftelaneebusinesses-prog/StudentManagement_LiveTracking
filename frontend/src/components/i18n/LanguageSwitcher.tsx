import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { TRANSLATE_LANGUAGES, getSavedLanguage, setLanguage } from "@/lib/googleTranslate";

export function LanguageSwitcher() {
  const [isOpen, setOpen] = useState(false);
  const [current, setCurrent] = useState(getSavedLanguage());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(code: string) {
    setCurrent(code);
    setLanguage(code);
    setOpen(false);
  }

  const currentLabel = TRANSLATE_LANGUAGES.find((l) => l.code === current)?.nativeLabel ?? "English";

  return (
    <div className="relative notranslate" translate="no" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <Languages size={17} strokeWidth={1.85} />
        <span className="hidden sm:inline">{currentLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/[0.08] dark:bg-[#17171a]">
          {TRANSLATE_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <span>{lang.nativeLabel}</span>
              {current === lang.code && <Check size={15} className="text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
