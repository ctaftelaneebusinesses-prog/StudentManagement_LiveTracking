import { ReactNode } from "react";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  skeletonRows?: number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyMessage = "No records found.",
  onRowClick,
  skeletonRows = 5,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
        <table className="min-w-full divide-y divide-black/[0.06] text-sm dark:divide-white/[0.08]">
          <thead className="bg-black/[0.02] dark:bg-white/[0.04]">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className={`px-4 py-3 text-left ${col.headerClassName ?? "font-medium text-[var(--ink-muted)]"}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] bg-white dark:divide-white/[0.05] dark:bg-[#17171a]">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i}>
                {columns.map((_col, j) => (
                  <td key={j} className="px-4 py-3">
                    <Skeleton className="h-4 w-full max-w-[10rem]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/[0.08] dark:border-white/[0.1]">
        <EmptyState title={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
      <table className="min-w-full divide-y divide-black/[0.06] text-sm dark:divide-white/[0.08]">
        <thead className="bg-black/[0.02] dark:bg-white/[0.04]">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className={`px-4 py-3 text-left ${col.headerClassName ?? "font-medium text-[var(--ink-muted)]"}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.04] bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)] dark:divide-white/[0.05] dark:bg-[#17171a]">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.04] ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((col, i) => (
                <td key={i} className={`px-4 py-3 text-[var(--ink-secondary)] ${col.className ?? ""}`}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
