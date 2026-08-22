import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABEL } from "@/utils/roles";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors duration-150 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover transition-transform duration-150 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-accent-700 text-xs font-semibold text-white transition-transform duration-150 group-hover:scale-105">
            {initials(user.full_name)}
          </span>
        )}
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight text-[var(--ink-primary)]">{user.full_name}</span>
          <span className="block text-[11px] leading-tight text-[var(--ink-muted)]">{ROLE_LABEL[user.roles.name]}</span>
        </span>
        <ChevronDown size={14} className="hidden text-[var(--ink-muted)] sm:block" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 w-56 animate-slide-up overflow-hidden rounded-xl border border-black/[0.08] bg-white p-1.5 shadow-xl dark:border-white/[0.1] dark:bg-[#1c1c1f]">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-[var(--ink-primary)]">{user.full_name}</p>
            <p className="truncate text-xs text-[var(--ink-muted)]">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/dashboard/profile");
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--ink-secondary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
          >
            <User size={16} strokeWidth={1.85} />
            My profile
          </button>
          <div className="my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--delta-bad)] transition-colors hover:bg-red-500/10"
          >
            <LogOut size={16} strokeWidth={1.85} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
