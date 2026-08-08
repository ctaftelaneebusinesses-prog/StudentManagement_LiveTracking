import { CircleAlert, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/15 bg-red-500/[0.04] px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-[var(--delta-bad)]">
        <CircleAlert size={22} strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--ink-primary)]">Couldn't load the dashboard</p>
        <p className="mt-1 max-w-sm text-xs text-[var(--ink-muted)]">
          {message ?? "Something went wrong while fetching the latest metrics."}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-700"
        >
          <RefreshCw size={14} strokeWidth={2} />
          Try again
        </button>
      )}
    </div>
  );
}
