import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-secondary)] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
    >
      {theme === "dark" ? <Sun size={17} strokeWidth={1.85} /> : <Moon size={17} strokeWidth={1.85} />}
    </button>
  );
}
