import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import * as superAdminService from "@/services/superAdmin.service";
import { SchoolAdmin } from "@/types/superAdmin.types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { isStrongEnough, PASSWORD_POLICY_HINT } from "../utils/passwordPolicy";

/**
 * §3/§5 — issue a new password for a School Admin.
 *
 * The Super Admin can generate and read the value they are setting, then copy
 * it to hand over. What they cannot do is read an *existing* password: Supabase
 * stores only a bcrypt hash and this app never keeps a plaintext copy, so once
 * this dialog closes the value is unrecoverable by anyone, including the
 * platform operator. That is deliberate — a retrievable password store would
 * turn a single database leak into a full account compromise.
 */
export function ResetPasswordModal({
  admin,
  onClose,
}: {
  admin: SchoolAdmin | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (admin) {
      setPassword("");
      setError(undefined);
    }
  }, [admin]);

  const mutation = useMutation({
    mutationFn: (value: string) => superAdminService.resetSchoolAdminPassword(admin!.id, value),
    onSuccess: () => {
      toast.success(`Password updated for ${admin?.full_name}. Copy it now — it can't be viewed again.`);
      onClose();
    },
    onError: (err: Error) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? err.message;
      toast.error(message || "Couldn't reset the password");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isStrongEnough(password)) {
      setError(PASSWORD_POLICY_HINT);
      return;
    }
    setError(undefined);
    mutation.mutate(password);
  }

  return (
    <Modal isOpen={Boolean(admin)} onClose={onClose} title="Reset password">
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-[var(--ink-secondary)]">
          Set a new password for <span className="font-medium text-[var(--ink-primary)]">{admin?.full_name}</span> (
          {admin?.email}).
        </p>

        <div className="mt-4">
          <PasswordField label="New password" value={password} onChange={setPassword} error={error} />
        </div>

        <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3">
          <ShieldAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
            Copy this password before saving — it is hashed immediately and cannot be retrieved afterwards, by anyone.
            The admin&apos;s existing sessions stay valid until they sign out.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
