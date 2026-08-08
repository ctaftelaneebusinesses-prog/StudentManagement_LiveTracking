import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ROLE_LABEL } from "@/utils/roles";

interface PortalNavbarProps {
  onOpenMobileMenu: () => void;
}

/** Portal-only top bar — glass panel matching PortalSidebar's theme instead of the plain white header every other role uses. */
export function PortalNavbar({ onOpenMobileMenu }: PortalNavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header
      className="flex h-16 items-center justify-between border-b px-4 backdrop-blur-xl sm:px-6"
      style={{ background: "var(--portal-glass-bg)", borderColor: "var(--portal-glass-border)" }}
    >
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
        className="rounded-lg p-2 text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink-primary)] dark:hover:bg-white/10 md:hidden"
      >
        <Menu size={20} strokeWidth={1.85} />
      </button>
      <div className="hidden items-center gap-1.5 md:flex">
        {/* Swap for an <img src="/craftlanee-logo.svg" className="h-4 w-auto" /> once the asset is in frontend/public. */}
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--ink-muted)] opacity-70">Powered by CraftLanee</span>
      </div>
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
        <Button variant="secondary" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
