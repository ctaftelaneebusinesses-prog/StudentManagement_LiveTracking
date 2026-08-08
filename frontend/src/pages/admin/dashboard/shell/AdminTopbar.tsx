import { Menu } from "lucide-react";
import { PoweredByCraftLanee } from "@/components/branding/PoweredByCraftLanee";
import { CommandSearch } from "./CommandSearch";
import { SchoolSelectorMenu } from "./SchoolSelectorMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileMenu } from "./ProfileMenu";

interface AdminTopbarProps {
  onOpenMobileMenu: () => void;
}

export function AdminTopbar({ onOpenMobileMenu }: AdminTopbarProps) {
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center gap-3 border-b border-black/[0.06] bg-white/80 px-4 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#111113]/80 sm:px-6 print:hidden">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
        className="rounded-lg p-2 text-[var(--ink-secondary)] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] md:hidden"
      >
        <Menu size={20} strokeWidth={1.85} />
      </button>

      <div className="min-w-0 flex-1">
        <CommandSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <SchoolSelectorMenu />
        <div className="mx-0.5 hidden h-6 w-px bg-black/[0.08] dark:bg-white/[0.1] sm:block" />
        <ThemeToggle />
        <NotificationsMenu />
        <div className="mx-0.5 hidden h-6 w-px bg-black/[0.08] dark:bg-white/[0.1] sm:block" />
        <PoweredByCraftLanee className="hidden text-[var(--ink-muted)] lg:inline" />
        <div className="mx-0.5 hidden h-6 w-px bg-black/[0.08] dark:bg-white/[0.1] sm:block" />
        <ProfileMenu />
      </div>
    </header>
  );
}
