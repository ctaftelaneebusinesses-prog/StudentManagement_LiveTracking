interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = "Loading..." }: SpinnerProps) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 p-8 text-slate-500">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
