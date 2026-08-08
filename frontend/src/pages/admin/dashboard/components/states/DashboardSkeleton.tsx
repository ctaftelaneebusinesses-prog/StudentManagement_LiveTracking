function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-black/[0.06] dark:bg-white/[0.06] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-black/[0.05] to-transparent dark:via-white/[0.06]" />
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a]">
      <div className="flex items-center gap-2.5">
        <Shimmer className="h-9 w-9 rounded-xl" />
        <Shimmer className="h-3 w-24" />
      </div>
      <Shimmer className="mt-4 h-7 w-20" />
      <Shimmer className="mt-2 h-3 w-32" />
      <Shimmer className="mt-4 h-9 w-full" />
    </div>
  );
}

function ChartCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a] ${className}`}
    >
      <Shimmer className="h-4 w-40" />
      <Shimmer className="mt-2 h-3 w-28" />
      <Shimmer className="mt-6 h-56 w-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 14 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ChartCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton className="h-80" />
    </div>
  );
}
