import { RegistrationApprovalsView } from "@/pages/shared/RegistrationApprovalsView";

/** Admin sees Principal registration requests; Principal sees Teacher/Accountant/Driver/Extracurricular-Staff requests — the backend scopes the queue by the caller's own role/permission (see registration.controller.ts::listQueue). */
export function RegistrationApprovalsPage() {
  return (
    <RegistrationApprovalsView
      title="Registration Approvals"
      description="Review and approve or reject self-registration requests."
      emptyMessage="No registration requests."
    />
  );
}
