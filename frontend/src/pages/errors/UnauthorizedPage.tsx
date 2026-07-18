import { Link } from "react-router-dom";

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Access denied</h1>
      <p className="text-sm text-slate-500">
        Your account role does not have permission to view this page.
      </p>
      <Link to="/login" className="text-sm font-medium text-brand-600 hover:underline">
        Back to login
      </Link>
    </div>
  );
}
