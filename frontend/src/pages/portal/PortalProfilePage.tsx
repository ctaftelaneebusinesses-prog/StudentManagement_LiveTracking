import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { User, Users, GraduationCap, ClipboardList, Wallet, FileText, Pencil } from "lucide-react";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as profileService from "@/services/portal/profile.service";
import * as dashboardService from "@/services/portal/dashboard.service";
import * as reportsService from "@/services/portal/reports.service";
import { getApiErrorMessage } from "@/lib/axios";
import { ProfileChangeFieldEdit, ProfileChangeStatus } from "@/types/portal.types";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalModal } from "./components/ui/PortalModal";
import { PortalProgressBar } from "./components/ui/PortalProgressBar";
import { pageTransition } from "./components/ui/portalMotion";

type TabKey = "personal" | "parents" | "academic" | "attendance" | "fees" | "reports" | "requests";

const TAB_ITEMS: TabItem<TabKey>[] = [
  { key: "personal", label: "Personal", icon: User },
  { key: "parents", label: "Family", icon: Users },
  { key: "academic", label: "Academic", icon: GraduationCap },
  { key: "attendance", label: "Attendance", icon: ClipboardList },
  { key: "fees", label: "Fees", icon: Wallet },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "requests", label: "Requests", icon: Pencil },
];

const STATUS_BADGE: Record<ProfileChangeStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

interface EditableFieldDef {
  key: string;
  label: string;
}

const EDITABLE_FIELD_DEFS: EditableFieldDef[] = [
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "district", label: "District" },
  { key: "state", label: "State" },
  { key: "pin_code", label: "PIN code" },
  { key: "blood_group", label: "Blood group" },
  { key: "allergies", label: "Allergies" },
  { key: "medical_conditions", label: "Medical conditions" },
  { key: "emergency_contact_name", label: "Emergency contact name" },
  { key: "emergency_contact_phone", label: "Emergency contact phone" },
  { key: "doctor_name", label: "Doctor name" },
  { key: "doctor_phone", label: "Doctor phone" },
  { key: "father_phone", label: "Father's phone" },
  { key: "father_email", label: "Father's email" },
  { key: "mother_phone", label: "Mother's phone" },
  { key: "mother_email", label: "Mother's email" },
];

export function PortalProfilePage() {
  const studentId = usePortalStudentId();
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [isRequestOpen, setRequestOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["portal", "profile", studentId],
    queryFn: () => profileService.fetchProfile(studentId),
    enabled: !!studentId,
  });
  const feesQuery = useQuery({
    queryKey: ["portal", "dashboard", "fees", studentId],
    queryFn: () => dashboardService.fetchPendingFees(studentId),
    enabled: !!studentId && activeTab === "fees",
  });
  const attendanceQuery = useQuery({
    queryKey: ["portal", "dashboard", "attendance-summary-alltime", studentId],
    queryFn: () => dashboardService.fetchAttendanceSummary(studentId),
    enabled: !!studentId && activeTab === "attendance",
  });
  const requestsQuery = useQuery({
    queryKey: ["portal", "profile-change-requests", studentId],
    queryFn: () => profileService.fetchMyProfileChangeRequests(studentId),
    enabled: !!studentId,
  });

  const submitMutation = useMutation({
    mutationFn: (input: { changes: Record<string, ProfileChangeFieldEdit>; reason?: string }) =>
      profileService.submitProfileChangeRequest(studentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "profile-change-requests", studentId] });
      setRequestOpen(false);
      toast.success("Your change request has been submitted for review.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to submit the change request.")),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PortalSkeleton className="h-20 w-full" />
        <PortalSkeleton className="h-10 w-full" />
        <PortalSkeleton className="h-64 w-full" />
      </div>
    );
  }

  const profile = profileQuery.data;
  if (!profile) return <p className="text-sm text-[var(--ink-muted)]">Profile not found.</p>;

  const pendingRequest = requestsQuery.data?.find((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <motion.img
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            src={profile.users?.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.users?.full_name ?? "Student")}`}
            alt=""
            className="h-16 w-16 rounded-full object-cover shadow-md"
            style={{ boxShadow: "0 0 0 3px var(--portal-accent-soft)" }}
          />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{profile.users?.full_name}</h1>
            <p className="text-sm text-[var(--ink-muted)]">
              Admission No: {profile.admission_no} · Roll No: {profile.roll_no ?? "—"} ·{" "}
              {profile.classes ? `${profile.classes.name} - ${profile.classes.section}` : "Unassigned"}
            </p>
          </div>
        </div>
        <Button onClick={() => setRequestOpen(true)} disabled={!!pendingRequest} title={pendingRequest ? "A request is already pending review" : undefined}>
          <Pencil size={15} className="mr-1.5 inline" strokeWidth={1.75} />
          Request a change
        </Button>
      </div>

      <Tabs tabs={TAB_ITEMS} active={activeTab} onChange={setActiveTab} />

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} variants={pageTransition} initial="initial" animate="animate" exit="exit">
          {activeTab === "personal" && (
            <PortalGlassCard noHover className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Personal information</h2>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <Field label="Date of birth" value={profile.date_of_birth ?? "—"} />
                <Field label="Gender" value={profile.gender ?? "—"} />
                <Field label="Blood group" value={profile.blood_group ?? "—"} />
                <Field label="Address" value={profile.address ?? "—"} />
                <Field label="City" value={profile.city ?? "—"} />
                <Field label="State" value={profile.state ?? "—"} />
                <Field label="Emergency contact" value={profile.emergency_contact_name ? `${profile.emergency_contact_name} — ${profile.emergency_contact_phone ?? "—"}` : "—"} />
                <Field label="Doctor" value={profile.doctor_name ? `${profile.doctor_name} — ${profile.doctor_phone ?? "—"}` : "—"} />
              </dl>
            </PortalGlassCard>
          )}

          {activeTab === "parents" && (
            <PortalGlassCard noHover className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Family information</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-[var(--ink-secondary)]">Father</h3>
                  <dl className="space-y-3 text-sm">
                    <Field label="Name" value={profile.father_name ?? "—"} />
                    <Field label="Phone" value={profile.father_phone ?? "—"} />
                    <Field label="Email" value={profile.father_email ?? "—"} />
                  </dl>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-[var(--ink-secondary)]">Mother</h3>
                  <dl className="space-y-3 text-sm">
                    <Field label="Name" value={profile.mother_name ?? "—"} />
                    <Field label="Phone" value={profile.mother_phone ?? "—"} />
                    <Field label="Email" value={profile.mother_email ?? "—"} />
                  </dl>
                </div>
              </div>
            </PortalGlassCard>
          )}

          {activeTab === "academic" && (
            <PortalGlassCard noHover className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Academic information</h2>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <Field label="Class" value={profile.classes ? `${profile.classes.name} - ${profile.classes.section}` : "—"} />
                <Field label="Admission date" value={profile.admission_date ?? "—"} />
              </dl>
            </PortalGlassCard>
          )}

          {activeTab === "attendance" && (
            <PortalGlassCard noHover className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Attendance summary</h2>
              {attendanceQuery.isLoading ? (
                <PortalSkeleton className="h-16 w-full" />
              ) : (
                <>
                  <p className="text-3xl font-semibold text-[var(--ink-primary)]">
                    {attendanceQuery.data?.percentage != null ? `${attendanceQuery.data.percentage}%` : "—"}
                  </p>
                  {attendanceQuery.data?.percentage != null && <PortalProgressBar percent={attendanceQuery.data.percentage} />}
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    {attendanceQuery.data &&
                      Object.entries(attendanceQuery.data.counts).map(([status, count]) => (
                        <div key={status} className="rounded-xl border p-2" style={{ borderColor: "var(--portal-glass-border)" }}>
                          <p className="font-semibold text-[var(--ink-primary)]">{count}</p>
                          <p className="text-xs capitalize text-[var(--ink-muted)]">{status.replace("_", " ")}</p>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </PortalGlassCard>
          )}

          {activeTab === "fees" && (
            <PortalGlassCard noHover className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Fee summary</h2>
              {feesQuery.isLoading ? (
                <PortalSkeleton className="h-20 w-full" />
              ) : (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Total fee</p>
                    <p className="text-xl font-semibold text-[var(--ink-primary)]">₹{(feesQuery.data?.totalDue ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Paid</p>
                    <p className="text-xl font-semibold text-[var(--status-good)]">₹{(feesQuery.data?.totalPaid ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Pending</p>
                    <p className="text-xl font-semibold text-[var(--status-serious)]">₹{Math.max(0, feesQuery.data?.balance ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </PortalGlassCard>
          )}

          {activeTab === "reports" && (
            <PortalGlassCard noHover className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Reports</h2>
              <p className="text-sm text-[var(--ink-muted)]">Download a summary report card of attendance and marks published so far.</p>
              <Button variant="secondary" onClick={() => void reportsService.fetchReportCard(studentId).then(downloadReport)}>
                Download report card
              </Button>
            </PortalGlassCard>
          )}

          {activeTab === "requests" && (
            <PortalGlassCard noHover className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Profile change requests</h2>
              {requestsQuery.isLoading ? (
                <PortalSkeleton className="h-24 w-full" />
              ) : !requestsQuery.data?.length ? (
                <p className="text-sm text-[var(--ink-muted)]">No profile change requests submitted yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {requestsQuery.data.map((r) => (
                    <li key={r.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--portal-glass-border)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--ink-primary)]">
                          {Object.keys(r.changes).length} field(s) changed
                        </span>
                        <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">Submitted {new Date(r.created_at).toLocaleString()}</p>
                      {r.reviewer_notes && <p className="mt-1 text-xs text-[var(--ink-muted)]">Note: {r.reviewer_notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </PortalGlassCard>
          )}
        </motion.div>
      </AnimatePresence>

      <RequestChangeModal
        isOpen={isRequestOpen}
        onClose={() => setRequestOpen(false)}
        isSubmitting={submitMutation.isPending}
        currentValues={{
          phone: profile.users?.phone ?? "",
          address: profile.address ?? "",
          city: profile.city ?? "",
          district: profile.district ?? "",
          state: profile.state ?? "",
          pin_code: profile.pin_code ?? "",
          blood_group: profile.blood_group ?? "",
          allergies: profile.allergies ?? "",
          medical_conditions: profile.medical_conditions ?? "",
          emergency_contact_name: profile.emergency_contact_name ?? "",
          emergency_contact_phone: profile.emergency_contact_phone ?? "",
          doctor_name: profile.doctor_name ?? "",
          doctor_phone: profile.doctor_phone ?? "",
          father_phone: profile.father_phone ?? "",
          father_email: profile.father_email ?? "",
          mother_phone: profile.mother_phone ?? "",
          mother_email: profile.mother_email ?? "",
        }}
        onSubmit={(changes, reason) => submitMutation.mutate({ changes, reason })}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--ink-primary)]">{value}</dd>
    </div>
  );
}

function downloadReport(report: Awaited<ReturnType<typeof reportsService.fetchReportCard>>) {
  const rows = report.marks.exams
    .flatMap((exam) =>
      exam.subjects.map(
        (mark) => `<tr><td>${exam.examName}</td><td>${mark.subjectName}</td><td>${mark.marksObtained}/${mark.maxMarks}</td><td>${mark.grade ?? ""}</td></tr>`
      )
    )
    .join("");
  const html = `<html><body><h1>Report card</h1><p>${report.student.users?.full_name ?? "Student"} · ${report.student.admission_no} · Attendance: ${report.attendance.percentage ?? "—"}%</p><table border="1"><tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Grade</th></tr>${rows || "<tr><td colspan=4>No marks published.</td></tr>"}</table></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.student.admission_no}-report-card.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RequestChangeModal({
  isOpen,
  onClose,
  isSubmitting,
  currentValues,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  isSubmitting: boolean;
  currentValues: Record<string, string>;
  onSubmit: (changes: Record<string, ProfileChangeFieldEdit>, reason: string) => void;
}) {
  const [edited, setEdited] = useState<Record<string, string>>(currentValues);
  const [reason, setReason] = useState("");

  const changedFields = useMemo(
    () => EDITABLE_FIELD_DEFS.filter((f) => (edited[f.key] ?? "") !== (currentValues[f.key] ?? "")),
    [edited, currentValues]
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const changes: Record<string, ProfileChangeFieldEdit> = {};
    for (const field of changedFields) {
      changes[field.key] = { from: currentValues[field.key] || null, to: edited[field.key] || null };
    }
    onSubmit(changes, reason);
  }

  return (
    <PortalModal isOpen={isOpen} onClose={onClose} title="Request a profile change" size="xl">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-[var(--ink-muted)]">
          Edit the fields you'd like to update. Your child's class teacher will review and approve the change before it's applied.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EDITABLE_FIELD_DEFS.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={edited[field.key] ?? ""}
              onChange={(e) => setEdited((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          ))}
        </div>
        <Textarea
          label="Reason for this change"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={5}
          maxLength={1000}
          required
        />
        {changedFields.length === 0 && <p className="text-xs text-[var(--ink-muted)]">Change at least one field to submit a request.</p>}
        <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={changedFields.length === 0}>
          Submit request ({changedFields.length} field{changedFields.length === 1 ? "" : "s"} changed)
        </Button>
      </form>
    </PortalModal>
  );
}
