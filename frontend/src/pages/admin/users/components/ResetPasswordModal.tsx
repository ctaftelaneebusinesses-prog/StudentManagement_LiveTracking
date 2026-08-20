import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import * as usersService from "@/services/admin/users.service";
import { generateDefaultPassword } from "@/utils/password";
import { getApiErrorMessage } from "@/lib/axios";

/** Just the fields this modal actually needs — lets callers pass a student/teacher record (or the fuller AdminUser row) interchangeably. */
export interface ResetPasswordTarget {
  id: string;
  full_name: string;
  phone?: string | null;
}

export function ResetPasswordModal({
  user,
  onClose,
}: {
  user: ResetPasswordTarget | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");

  const resetMutation = useMutation({
    mutationFn: () => usersService.resetPassword(user!.id, password),
    onSuccess: () => {
      setPassword("");
      onClose();
    },
  });

  function handleClose() {
    setPassword("");
    resetMutation.reset();
    onClose();
  }

  return (
    <Modal isOpen={!!user} onClose={handleClose} title="Reset password" size="md">
      <div className="space-y-4">
        <p className="text-sm text-[var(--ink-secondary)]">
          Set a new password for <span className="font-semibold text-[var(--ink-primary)]">{user?.full_name}</span>.
          No email is sent — share the new password with them directly.
        </p>
        <PasswordField
          value={password}
          onChange={setPassword}
          onGenerate={() => setPassword(generateDefaultPassword(user?.full_name ?? "", user?.phone ?? undefined))}
        />
        {resetMutation.isError && (
          <p className="text-sm text-red-600">{getApiErrorMessage(resetMutation.error, "Failed to reset password.")}</p>
        )}
        <Button
          className="w-full"
          disabled={password.length < 6}
          isLoading={resetMutation.isPending}
          onClick={() => resetMutation.mutate()}
        >
          <KeyRound size={16} /> Reset password
        </Button>
      </div>
    </Modal>
  );
}
