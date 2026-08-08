import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ClassRoom } from "@/types/admin.types";

interface PromoteTransferModalProps {
  mode: "promote" | "transfer" | null;
  classes: ClassRoom[];
  selectedCount: number;
  isSubmitting: boolean;
  onConfirm: (targetClassId: string) => void;
  onClose: () => void;
}

const COPY: Record<"promote" | "transfer", { title: string; description: string; confirmLabel: string }> = {
  promote: {
    title: "Promote students",
    description: "Move the selected students to the next class, e.g. into a new academic year's section.",
    confirmLabel: "Promote",
  },
  transfer: {
    title: "Transfer students",
    description: "Move the selected students into a different class or section.",
    confirmLabel: "Transfer",
  },
};

export function PromoteTransferModal({
  mode,
  classes,
  selectedCount,
  isSubmitting,
  onConfirm,
  onClose,
}: PromoteTransferModalProps) {
  const [targetClassId, setTargetClassId] = useState("");

  if (!mode) return null;
  const copy = COPY[mode];

  return (
    <Modal isOpen={mode !== null} onClose={onClose} title={copy.title}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--ink-muted)]">{copy.description}</p>
        <p className="text-sm font-medium text-[var(--ink-primary)]">
          {selectedCount} student{selectedCount === 1 ? "" : "s"} selected
        </p>
        <Select
          label="Destination class"
          placeholder="Select a class"
          value={targetClassId}
          onChange={(e) => setTargetClassId(e.target.value)}
          options={classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }))}
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button disabled={!targetClassId} isLoading={isSubmitting} onClick={() => onConfirm(targetClassId)}>
            {copy.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
