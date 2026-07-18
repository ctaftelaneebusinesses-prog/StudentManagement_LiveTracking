import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { ROLE_LABEL } from "@/utils/roles";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[user.roles.name]}</p>
          </div>
        )}
        <Button variant="secondary" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
