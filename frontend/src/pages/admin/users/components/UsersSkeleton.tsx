import { Skeleton } from "@/components/ui/Skeleton";

export function UsersStatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-[#17171a]"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function UsersTableSkeleton() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="rounded-2xl border border-black/[0.06] bg-white p-2 dark:border-white/[0.08] dark:bg-[#17171a]">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="my-1.5 h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
