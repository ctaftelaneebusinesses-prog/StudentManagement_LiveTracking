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
    </div>
  );
}

function ChartCardSkeleton() {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a]">
      <Shimmer className="h-4 w-40" />
      <Shimmer className="mt-2 h-3 w-28" />
      <Shimmer className="mt-6 h-56 w-full" />
    </div>
  );
}

/** Loading state shared by every Reports tab — stat + chart counts scale to each tab's actual layout. */
export function ReportsTabSkeleton({ stats = 4, charts = 2, table = true }: { stats?: number; charts?: number; table?: boolean }) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: stats }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {charts > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: charts }).map((_, i) => (
            <ChartCardSkeleton key={i} />
          ))}
        </div>
      )}
      {table && (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="my-1.5 h-10 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
