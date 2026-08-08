import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { PoweredByCraftLanee } from "@/components/branding/PoweredByCraftLanee";
import { ROLE_LABEL } from "@/utils/roles";

interface PortalNavbarProps {
  onOpenMobileMenu: () => void;
}

/**
 * Portal-only top bar — glass panel matching PortalSidebar's theme instead
 * of the plain white header every other role uses. No Log out button here:
 * PortalSidebar's UserCard already has one, so this bar isn't the only way
 * out.
 */
export function PortalNavbar({ onOpenMobileMenu }: PortalNavbarProps) {
  const { user } = useAuth();

  return (
    <header
      className="flex h-16 items-center justify-between border-b px-4 backdrop-blur-xl sm:px-6"
      style={{ background: "var(--portal-glass-bg)", borderColor: "var(--portal-glass-border)" }}
    >
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink-primary)] dark:hover:bg-white/10 md:hidden"
      >
        <Menu size={20} strokeWidth={1.85} />
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 sm:gap-4">
        <LanguageSwitcher />
        {user && <NotificationBell />}
        {user && (
          <div className="flex items-center gap-2.5">
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-[var(--ink-primary)]">{user.full_name}</p>
              <p className="text-xs text-[var(--ink-muted)]">{ROLE_LABEL[user.roles.name]}</p>
            </div>
          </div>
        )}
        <div className="mx-0.5 hidden h-6 w-px bg-black/[0.08] dark:bg-white/[0.1] sm:block" />
        <PoweredByCraftLanee className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
