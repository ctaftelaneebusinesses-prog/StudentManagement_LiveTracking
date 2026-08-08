/** Theme-tinted shimmer skeleton for the Student/Parent Portal — same shimmer sweep as components/ui/Skeleton, tinted by the active --portal-accent so loading states read as part of the themed product instead of neutral grey. */
export function PortalSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--portal-accent)_8%,transparent)] ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer"
        style={{ backgroundImage: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--portal-accent) 18%, transparent), transparent)" }}
      />
    </div>
  );
}
