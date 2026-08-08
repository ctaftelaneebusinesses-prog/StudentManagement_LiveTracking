import { AlertTriangle, Building2, ShieldCheck, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface ImpactDialogProps {
  isOpen: boolean;
  title: string;
  /** One-line statement of what is about to happen. */
  message: string;
  /** Names of the schools this action touches — shown in full, never truncated to a count. */
  schoolNames: string[];
  affectedSchools: number;
  affectedUsers: number;
  confirmLabel: string;
  /** "danger" for anything that removes access; "primary" for restoring it. */
  intent?: "danger" | "primary";
  isLoading?: boolean;
  /** True while the impact preview is still being fetched — confirm stays disabled until the numbers are real. */
  isPreviewLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The confirmation surface for every access-changing platform action (§21).
 *
 * The numbers shown here always come from a server-side preview endpoint
 * (`/impact`) rather than being computed in the browser, so what the operator
 * confirms is what the server will actually do. Confirm is disabled until that
 * preview has loaded — a dialog that says "0 users affected" because a request
 * is still in flight is worse than one that says nothing yet.
 */
export function ImpactDialog({
  isOpen,
  title,
  message,
  schoolNames,
  affectedSchools,
  affectedUsers,
  confirmLabel,
  intent = "danger",
  isLoading,
  isPreviewLoading,
  onConfirm,
  onCancel,
}: ImpactDialogProps) {
  const isDanger = intent === "danger";

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div
        className={`flex gap-3 rounded-xl border p-3.5 ${
          isDanger
            ? "border-amber-500/25 bg-amber-500/[0.07]"
            : "border-emerald-500/25 bg-emerald-500/[0.07]"
        }`}
      >
        <span className={`mt-0.5 shrink-0 ${isDanger ? "text-amber-600" : "text-emerald-600"}`}>
          {isDanger ? <AlertTriangle size={18} strokeWidth={2} /> : <ShieldCheck size={18} strokeWidth={2} />}
        </span>
        <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">{message}</p>
      </div>

      {isPreviewLoading ? (
        <div className="mt-4 flex justify-center py-6">
          <Spinner label="Calculating impact…" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ImpactStat icon={Building2} label={isDanger ? "Schools affected" : "Schools restored"} value={affectedSchools} />
            <ImpactStat icon={Users} label={isDanger ? "Users losing access" : "Users regaining access"} value={affectedUsers} />
          </div>

          {schoolNames.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                Schools
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-black/[0.06] bg-black/[0.02] p-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                {schoolNames.map((name) => (
                  <li key={name} className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
                    <Building2 size={13} strokeWidth={1.9} className="shrink-0 text-[var(--ink-muted)]" />
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {isDanger && (
        <p className="mt-4 text-xs leading-relaxed text-[var(--ink-muted)]">
          No records are deleted. Students, teachers, attendance, fees, exams, transport and all other school data
          remain stored — only login access is switched off, and it can be restored later.
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant={isDanger ? "danger" : "primary"}
          onClick={onConfirm}
          isLoading={isLoading}
          disabled={isPreviewLoading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

function ImpactStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-3 dark:border-white/[0.08] dark:bg-[#1c1c1f]">
      <div className="flex items-center gap-1.5 text-[var(--ink-muted)]">
        <Icon size={13} strokeWidth={1.9} />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-[var(--ink-primary)]">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}
