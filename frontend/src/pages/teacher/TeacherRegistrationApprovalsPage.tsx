import { RegistrationApprovalsView } from "@/pages/shared/RegistrationApprovalsView";

/** A class teacher's queue of self-registered students for their own class. */
export function TeacherRegistrationApprovalsPage() {
  return (
    <RegistrationApprovalsView
      title="Student Registrations"
      description="Approve or reject students who registered themselves for your class."
      emptyMessage="No student registrations for your class."
    />
  );
}
