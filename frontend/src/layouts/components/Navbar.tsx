import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { SidebarTour } from "@/components/quickTour/SidebarTour";
import { PoweredByCraftLanee } from "@/components/branding/PoweredByCraftLanee";
import { ROLE_LABEL } from "@/utils/roles";

interface NavbarProps {
  onOpenMobileMenu: () => void;
}

/** No Log out button here: Sidebar's UserCard already has one, so this bar isn't the only way out. */
export function Navbar({ onOpenMobileMenu }: NavbarProps) {
  const { user } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-white/[0.08] dark:bg-[#17171a] sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200 md:hidden"
      >
        <span className="sr-only">Open menu</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 sm:gap-4">
        <SidebarTour />
        <LanguageSwitcher />
        {user && <NotificationBell />}
        {user && (
          <div className="flex items-center gap-2.5">
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{user.full_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ROLE_LABEL[user.roles.name]}</p>
            </div>
          </div>
        )}
        <div className="mx-0.5 hidden h-6 w-px bg-slate-200 dark:bg-white/[0.1] sm:block" />
        <PoweredByCraftLanee className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
