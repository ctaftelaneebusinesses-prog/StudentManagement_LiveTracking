import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Users, GraduationCap, Wallet, Bus, FileText, History, Camera, Check, X, ClipboardEdit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ReceiptModal } from "@/pages/admin/fees/components/ReceiptModal";
import * as portalService from "@/services/teacher/portal.service";
import * as studentsService from "@/services/admin/students.service";
import * as documentsService from "@/services/admin/studentDocuments.service";
import * as siblingsService from "@/services/admin/studentSiblings.service";
import * as feesService from "@/services/admin/fees.service";
import * as activityService from "@/services/admin/studentActivity.service";
import * as transportService from "@/services/transport.service";
import * as profileChangeRequestService from "@/services/teacher/profileChangeRequest.service";
import { getApiErrorMessage } from "@/lib/axios";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { ProfileChangeStatus } from "@/types/portal.types";
import { DocumentType, Sibling, StudentProfile } from "@/types/admin.types";
import { TransportDirection } from "@/types/transport.types";
import {
  INDIAN_STATE_OPTIONS,
  NATIONALITY_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  RELIGION_OPTIONS,
  CATEGORY_OPTIONS,
  getDistrictOptionsForState,
} from "@/utils/indianRegions";
import { digitsOnly, PHONE_PATTERN, AADHAAR_PATTERN } from "@/utils/formHelpers";

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "birth_certificate", label: "Birth certificate" },
  { value: "id_proof", label: "ID proof (Aadhaar/Passport/etc.)" },
  { value: "transfer_certificate", label: "Transfer certificate" },
  { value: "photo", label: "Photo" },
  { value: "medical", label: "Medical record" },
  { value: "other", label: "Other" },
];

const DIRECTION_OPTIONS: { value: TransportDirection; label: string }[] = [
  { value: "both", label: "Morning & Evening" },
  { value: "morning", label: "Morning only" },
  { value: "evening", label: "Evening only" },
];
const DIRECTION_LABEL: Record<TransportDirection, string> = { both: "Morning & Evening", morning: "Morning only", evening: "Evening only" };

const ACTIVITY_TYPE_DOT: Record<string, string> = {
  activity_log: "bg-brand-500",
  attendance: "bg-amber-500",
  fee_payment: "bg-green-500",
  exam_mark: "bg-purple-500",
};

type TabKey = "profile" | "parents" | "academic" | "fees" | "transport" | "documents" | "activity" | "requests";

const TAB_ITEMS: TabItem<TabKey>[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "parents", label: "Family", icon: Users },
  { key: "academic", label: "Academic", icon: GraduationCap },
  { key: "fees", label: "Fee Information", icon: Wallet },
  { key: "transport", label: "Transport", icon: Bus },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "activity", label: "Activity", icon: History },
  { key: "requests", label: "Profile Requests", icon: ClipboardEdit },
];

const CHANGE_STATUS_BADGE: Record<ProfileChangeStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

export function TeacherStudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const id = studentId!;
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isPhotoBusy, setPhotoBusy] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Academic tab keeps the aggregated teacher-portal view (attendance %,
  // latest marks, homework status) — a single-call summary, unlike the rest
  // of this page which now mirrors admin's per-resource queries so a class
  // teacher gets the exact same editing surface admin/principal have.
  const detailQuery = useQuery({
    queryKey: ["teacher", "student-detail", id],
    queryFn: () => portalService.fetchStudentDetail(id),
    retry: false,
  });

  const studentQuery = useQuery({
    queryKey: ["teacher", "students", id],
    queryFn: () => studentsService.fetchStudent(id),
  });

  const documentsQuery = useQuery({
    queryKey: ["teacher", "students", id, "documents"],
    queryFn: () => documentsService.fetchDocuments(id),
  });

  function invalidateStudent() {
    queryClient.invalidateQueries({ queryKey: ["teacher", "students", id] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "student-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "my-students"] });
  }
  function invalidateDocuments() {
    queryClient.invalidateQueries({ queryKey: ["teacher", "students", id, "documents"] });
  }

  const photoMutation = useMutation({
    mutationFn: (file: File) => studentsService.uploadStudentPhoto(id, file),
    onSuccess: () => {
      invalidateStudent();
      toast.success("Photo updated.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to upload photo.")),
    onSettled: () => setPhotoBusy(false),
  });

  function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoBusy(true);
      photoMutation.mutate(file);
    }
    event.target.value = "";
  }

  if (studentQuery.isLoading || detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (studentQuery.isError) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard/teacher/students" className="text-sm text-brand-600 hover:underline">
          ← Back to students
        </Link>
        <ErrorState
          message={getApiErrorMessage(studentQuery.error, "Failed to load this student's profile.")}
          onRetry={() => void studentQuery.refetch()}
        />
      </div>
    );
  }
  if (!studentQuery.data) return <p className="text-sm text-[var(--ink-muted)]">Student not found.</p>;

  const student = studentQuery.data;
  const detail = detailQuery.data;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/dashboard/teacher/students" className="text-sm text-brand-600 hover:underline">
            ← Back to students
          </Link>
          <div className="mt-1 flex items-center gap-4">
            <button
              type="button"
              title="Change photo"
              onClick={() => photoInputRef.current?.click()}
              className="group relative block h-16 w-16 shrink-0 rounded-full"
            >
              <img
                src={student.users.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(student.users.full_name)}`}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-white/10"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                {isPhotoBusy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Camera size={18} className="text-white" strokeWidth={2} />
                )}
              </span>
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{student.users.full_name}</h1>
              <p className="text-sm text-[var(--ink-muted)]">
                Admission No: {student.admission_no} · Roll No: {student.roll_no ?? "—"} ·{" "}
                {student.classes ? `${student.classes.name} - ${student.classes.section}` : "Unassigned"}
              </p>
            </div>
          </div>
        </div>
      </div>
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />

      <Tabs tabs={TAB_ITEMS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "profile" && (
        <div className="space-y-6">
          <PersonalDetailsCard student={student} onSaved={invalidateStudent} />
          <MedicalInfoCard student={student} onSaved={invalidateStudent} />
          <SiblingsSection studentId={id} />
        </div>
      )}

      {activeTab === "parents" && (
        <div className="space-y-6">
          <ParentContactCard student={student} onSaved={invalidateStudent} />
        </div>
      )}

      {activeTab === "academic" && detail && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card className="space-y-2">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Attendance</h2>
              <p className="text-3xl font-semibold text-brand-600">
                {detail.attendance.percentage != null ? `${detail.attendance.percentage}%` : "—"}
              </p>
              <p className="text-xs text-[var(--ink-muted)]">
                {detail.attendance.from} – {detail.attendance.to}
              </p>
            </Card>
            <Card className="space-y-2">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Latest assessment</h2>
              {detail.marks.latestExam ? (
                <>
                  <p className="text-sm text-[var(--ink-muted)]">{detail.marks.latestExam.examName}</p>
                  <p className="text-3xl font-semibold text-brand-600">
                    {detail.marks.latestExam.percentage != null ? `${detail.marks.latestExam.percentage}%` : "—"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--ink-muted)]">No results recorded yet.</p>
              )}
            </Card>
          </div>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Subject-wise marks</h2>
            {detail.marks.exams.length === 0 ? (
              <EmptyState title="No exam results yet" />
            ) : (
              <DataTable
                rows={detail.marks.exams.flatMap((e) => e.subjects.map((s) => ({ ...s, examName: e.examName, examDate: e.examDate, key: `${e.examId}-${s.subjectId}` })))}
                rowKey={(r) => r.key}
                emptyMessage="No exam results yet."
                columns={[
                  { header: "Exam", cell: (r) => r.examName },
                  { header: "Subject", cell: (r) => r.subjectName },
                  { header: "Marks", cell: (r) => `${r.marksObtained} / ${r.maxMarks}` },
                  { header: "Grade", cell: (r) => r.grade ?? "—" },
                ]}
              />
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Homework status</h2>
              <span className="text-xs text-[var(--ink-muted)]">
                {detail.homework.filter((h) => h.submission).length} / {detail.homework.length} submitted
              </span>
            </div>
            {detail.homework.length === 0 ? (
              <EmptyState title="No homework assigned yet" />
            ) : (
              <DataTable
                rows={detail.homework.slice(0, 10)}
                rowKey={(h) => h.id}
                emptyMessage="No homework assigned yet."
                columns={[
                  { header: "Title", cell: (h) => h.title },
                  { header: "Subject", cell: (h) => h.subjects?.name ?? "—" },
                  { header: "Due date", cell: (h) => new Date(h.due_date).toLocaleDateString() },
                  {
                    header: "Status",
                    cell: (h) => <Badge variant={h.submission ? "success" : "warning"}>{h.submission ? "Submitted" : "Pending"}</Badge>,
                  },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      {activeTab === "fees" && <FeeSummaryReadOnlyCard studentId={id} />}

      {activeTab === "transport" && <TransportDetailsCard studentId={id} />}

      {activeTab === "documents" && (
        <DocumentsCard
          studentId={id}
          schoolId={user?.school_id ?? ""}
          documents={documentsQuery.data ?? []}
          isLoading={documentsQuery.isLoading}
          onChanged={invalidateDocuments}
        />
      )}

      {activeTab === "activity" && <ActivityTimelineCard studentId={id} />}

      {activeTab === "requests" && <ProfileChangeRequestQueue studentId={id} />}
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

// ----------------------------------------------------------------------------
// Same fields admin/principal can edit on a student, minus the class-move
// dropdown (PATCH /students/:id/class stays staff-only — see
// utils/teacherAccess.ts::requireStaffOnly) and the deactivate button
// (account lifecycle, also staff-only).
function PersonalDetailsCard({ student, onSaved }: { student: StudentProfile; onSaved: () => void }) {
  const [isEditing, setEditing] = useState(false);
  const toast = useToast();
  const isCustomNationality = !!student.nationality && !NATIONALITY_OPTIONS.some((o) => o.value === student.nationality);
  const isCustomReligion = !!student.religion && !RELIGION_OPTIONS.some((o) => o.value === student.religion);
  const [districtOptions, setDistrictOptions] = useState<{ value: string; label: string }[]>([]);
  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting, errors } } = useForm({
    defaultValues: {
      full_name: student.users.full_name,
      phone: student.users.phone ?? "",
      roll_no: student.roll_no ?? "",
      date_of_birth: student.date_of_birth ?? "",
      gender: student.gender ?? "",
      address: student.address ?? "",
      place_of_birth: student.place_of_birth ?? "",
      nationality: isCustomNationality ? "Other" : student.nationality ?? "Indian",
      nationality_other: isCustomNationality ? student.nationality ?? "" : "",
      religion: isCustomReligion ? "Other" : student.religion ?? "",
      religion_other: isCustomReligion ? student.religion ?? "" : "",
      category: student.category ?? "",
      aadhaar_number: student.aadhaar_number ?? "",
      city: student.city ?? "",
      district: student.district ?? "",
      state: student.state ?? "",
      pin_code: student.pin_code ?? "",
    },
  });

  useEffect(() => {
    if (student.state) getDistrictOptionsForState(student.state).then(setDistrictOptions);
  }, [student.state]);

  async function handleStateChange(stateName: string) {
    setValue("state", stateName);
    setValue("district", "");
    setDistrictOptions(await getDistrictOptionsForState(stateName));
  }

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => studentsService.updateStudent(student.id, values),
    onSuccess: () => {
      onSaved();
      setEditing(false);
      toast.success("Personal details updated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update personal details.")),
  });

  function onPersonalDetailsSubmit(values: Record<string, string>) {
    const { nationality_other, religion_other, ...rest } = values;
    updateMutation.mutate({
      ...rest,
      nationality: rest.nationality === "Other" ? nationality_other : rest.nationality,
      religion: rest.religion === "Other" ? religion_other : rest.religion,
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Personal details</h2>
        {!isEditing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onPersonalDetailsSubmit)}>
          <Input label="Full name" {...register("full_name", { required: true })} />
          <Input
            label="Phone"
            inputMode="numeric"
            error={errors.phone?.message}
            {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
          />
          <Input label="Roll number" {...register("roll_no")} />
          <Input label="Date of birth" type="date" {...register("date_of_birth")} />
          <Select
            label="Gender"
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
            placeholder="Select gender"
            {...register("gender")}
          />
          <Input label="Place of birth" {...register("place_of_birth")} />
          <Input
            label="Aadhaar number"
            inputMode="numeric"
            placeholder="12-digit Aadhaar number"
            error={errors.aadhaar_number?.message}
            {...digitsOnly(register("aadhaar_number", { pattern: AADHAAR_PATTERN }), 12)}
          />
          <Select label="Nationality" options={NATIONALITY_OPTIONS} {...register("nationality")} />
          {watch("nationality") === "Other" && <Input label="Specify nationality" {...register("nationality_other")} />}
          <SearchableSelect
            label="Religion"
            placeholder="Select religion"
            options={RELIGION_OPTIONS}
            value={watch("religion")}
            onChange={(v) => setValue("religion", v)}
          />
          {watch("religion") === "Other" && <Input label="Specify religion" {...register("religion_other")} />}
          <Select label="Category" placeholder="Select category" options={CATEGORY_OPTIONS} {...register("category")} />
          <Input label="Residential address" {...register("address")} />
          <SearchableSelect
            label="State"
            placeholder="Select state"
            options={INDIAN_STATE_OPTIONS}
            value={watch("state")}
            onChange={handleStateChange}
          />
          <SearchableSelect
            label="District"
            placeholder={watch("state") ? "Select district" : "Select a state first"}
            options={districtOptions}
            value={watch("district")}
            onChange={(v) => setValue("district", v)}
            disabled={!watch("state")}
          />
          <Input label="City / Town" placeholder="Not listed under District? Type it here" {...register("city")} />
          <Input label="PIN code" {...register("pin_code")} />
          <div className="col-span-full flex gap-3">
            <Button type="submit" isLoading={isSubmitting || updateMutation.isPending}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset();
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Field label="Email" value={student.users.email} />
          <Field label="Phone" value={student.users.phone ?? "—"} />
          <Field label="Roll number" value={student.roll_no ?? "—"} />
          <Field label="Date of birth" value={student.date_of_birth ?? "—"} />
          <Field label="Gender" value={student.gender ?? "—"} />
          <Field label="Place of birth" value={student.place_of_birth ?? "—"} />
          <Field label="Aadhaar number" value={student.aadhaar_number ?? "—"} />
          <Field label="Nationality" value={student.nationality ?? "—"} />
          <Field label="Religion" value={student.religion ?? "—"} />
          <Field label="Category" value={student.category ?? "—"} />
          <Field label="Residential address" value={student.address ?? "—"} />
          <Field label="City" value={student.city ?? "—"} />
          <Field label="District" value={student.district ?? "—"} />
          <Field label="State" value={student.state ?? "—"} />
          <Field label="PIN code" value={student.pin_code ?? "—"} />
          <Field label="Admission date" value={student.admission_date} />
        </dl>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
function MedicalInfoCard({ student, onSaved }: { student: StudentProfile; onSaved: () => void }) {
  const toast = useToast();
  const [isEditing, setEditing] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm({
    defaultValues: {
      blood_group: student.blood_group ?? "",
      allergies: student.allergies ?? "",
      medical_conditions: student.medical_conditions ?? "",
      emergency_contact_name: student.emergency_contact_name ?? "",
      emergency_contact_phone: student.emergency_contact_phone ?? "",
      doctor_name: student.doctor_name ?? "",
      doctor_phone: student.doctor_phone ?? "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => studentsService.updateStudent(student.id, values),
    onSuccess: () => {
      onSaved();
      setEditing(false);
      toast.success("Medical information updated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update medical information.")),
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Medical information</h2>
        {!isEditing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => updateMutation.mutate(values))}>
          <Select label="Blood group" placeholder="Select blood group" options={BLOOD_GROUP_OPTIONS} {...register("blood_group")} />
          <Input label="Allergies" {...register("allergies")} />
          <Input label="Medical conditions" {...register("medical_conditions")} />
          <Input label="Emergency contact name" {...register("emergency_contact_name")} />
          <Input
            label="Emergency contact phone"
            inputMode="numeric"
            error={errors.emergency_contact_phone?.message}
            {...digitsOnly(register("emergency_contact_phone", { pattern: PHONE_PATTERN }), 10)}
          />
          <Input label="Family doctor name" {...register("doctor_name")} />
          <Input
            label="Family doctor phone"
            inputMode="numeric"
            error={errors.doctor_phone?.message}
            {...digitsOnly(register("doctor_phone", { pattern: PHONE_PATTERN }), 10)}
          />
          <div className="col-span-full flex gap-3">
            <Button type="submit" isLoading={isSubmitting || updateMutation.isPending}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset();
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Field label="Blood group" value={student.blood_group ?? "—"} />
          <Field label="Allergies" value={student.allergies ?? "—"} />
          <Field label="Medical conditions" value={student.medical_conditions ?? "—"} />
          <Field label="Emergency contact name" value={student.emergency_contact_name ?? "—"} />
          <Field label="Emergency contact phone" value={student.emergency_contact_phone ?? "—"} />
          <Field label="Family doctor name" value={student.doctor_name ?? "—"} />
          <Field label="Family doctor phone" value={student.doctor_phone ?? "—"} />
        </dl>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
function SiblingsSection({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isLinkOpen, setLinkOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [unlinking, setUnlinking] = useState<Sibling | null>(null);

  const siblingsQuery = useQuery({
    queryKey: ["teacher", "students", studentId, "siblings"],
    queryFn: () => siblingsService.fetchSiblings(studentId),
  });

  const searchQuery = useQuery({
    queryKey: ["teacher", "students", studentId, "siblings", "search", search],
    queryFn: () => siblingsService.searchSiblingCandidates(studentId, search || undefined),
    enabled: isLinkOpen,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["teacher", "students", studentId, "siblings"] });
  }

  const linkMutation = useMutation({
    mutationFn: (siblingId: string) => siblingsService.linkSibling(studentId, siblingId),
    onSuccess: () => {
      invalidate();
      toast.success("Sibling linked");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to link sibling.")),
  });

  const unlinkMutation = useMutation({
    mutationFn: (siblingId: string) => siblingsService.unlinkSibling(studentId, siblingId),
    onSuccess: () => {
      invalidate();
      setUnlinking(null);
      toast.success("Sibling unlinked");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to unlink sibling.")),
  });

  const siblings = siblingsQuery.data ?? [];

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Siblings</h2>
        <Button variant="secondary" onClick={() => setLinkOpen(true)}>
          Link sibling
        </Button>
      </div>

      {siblingsQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : siblings.length === 0 ? (
        <EmptyState title="No siblings linked" description="Link a sibling studying in the same school." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {siblings.map((sibling) => (
            <li key={sibling.id} className="flex items-center justify-between rounded-lg border border-black/[0.06] p-3 dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <img
                  src={sibling.users.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(sibling.users.full_name)}`}
                  alt={sibling.users.full_name}
                  className="h-9 w-9 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--ink-primary)]">{sibling.users.full_name}</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {sibling.classes ? `${sibling.classes.name} - ${sibling.classes.section}` : "Unassigned"} · Roll {sibling.roll_no ?? "—"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setUnlinking(sibling)}>
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={isLinkOpen} onClose={() => setLinkOpen(false)} title="Link sibling">
        <div className="space-y-4">
          <Input label="Search by name or admission number" value={search} onChange={(e) => setSearch(e.target.value)} />
          {searchQuery.isLoading && <Spinner label="Searching..." />}
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {(searchQuery.data ?? []).map((candidate) => (
              <li key={candidate.id} className="flex items-center justify-between rounded-md border border-black/[0.06] p-3 dark:border-white/[0.08]">
                <div>
                  <p className="text-sm font-medium text-[var(--ink-primary)]">{candidate.users.full_name}</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {candidate.admission_no} · {candidate.classes ? `${candidate.classes.name} - ${candidate.classes.section}` : "Unassigned"}
                  </p>
                </div>
                <Button variant="secondary" className="!px-3 !py-1 text-xs" isLoading={linkMutation.isPending} onClick={() => linkMutation.mutate(candidate.id)}>
                  Link
                </Button>
              </li>
            ))}
          </ul>
          {searchQuery.data?.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No matching students found.</p>}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!unlinking}
        title="Unlink sibling"
        message={`Unlink ${unlinking?.users.full_name} as a sibling of this student?`}
        confirmLabel="Unlink"
        isLoading={unlinkMutation.isPending}
        onConfirm={() => unlinking && unlinkMutation.mutate(unlinking.id)}
        onCancel={() => setUnlinking(null)}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
/** Mandatory quick-capture Father/Mother contact fields, separate from the full Parent/Guardian login-account system below. */
function ParentContactCard({ student, onSaved }: { student: StudentProfile; onSaved: () => void }) {
  const [isEditing, setEditing] = useState(false);
  const toast = useToast();
  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm({
    defaultValues: {
      father_name: student.father_name ?? "",
      father_phone: student.father_phone ?? "",
      father_email: student.father_email ?? "",
      father_occupation: student.father_occupation ?? "",
      mother_name: student.mother_name ?? "",
      mother_phone: student.mother_phone ?? "",
      mother_email: student.mother_email ?? "",
      mother_occupation: student.mother_occupation ?? "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => studentsService.updateStudent(student.id, values),
    onSuccess: () => {
      onSaved();
      setEditing(false);
      toast.success("Parent contact details updated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update parent contact details.")),
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Parent contact details</h2>
          <p className="text-xs text-[var(--ink-muted)]">Quick-capture contact info — not a portal login account.</p>
        </div>
        {!isEditing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <form className="space-y-4" onSubmit={handleSubmit((values) => updateMutation.mutate(values))}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-4 rounded-lg border border-black/[0.06] p-4 dark:border-white/[0.08]">
              <h3 className="text-sm font-medium text-[var(--ink-secondary)]">Father</h3>
              <Input label="Name" {...register("father_name")} />
              <Input
                label="Mobile number"
                inputMode="numeric"
                error={errors.father_phone?.message}
                {...digitsOnly(register("father_phone", { pattern: PHONE_PATTERN }), 10)}
              />
              <Input label="Email" type="email" {...register("father_email")} />
              <Input label="Occupation" {...register("father_occupation")} />
            </div>
            <div className="space-y-4 rounded-lg border border-black/[0.06] p-4 dark:border-white/[0.08]">
              <h3 className="text-sm font-medium text-[var(--ink-secondary)]">Mother</h3>
              <Input label="Name" {...register("mother_name")} />
              <Input
                label="Mobile number"
                inputMode="numeric"
                error={errors.mother_phone?.message}
                {...digitsOnly(register("mother_phone", { pattern: PHONE_PATTERN }), 10)}
              />
              <Input label="Email" type="email" {...register("mother_email")} />
              <Input label="Occupation" {...register("mother_occupation")} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" isLoading={isSubmitting || updateMutation.isPending}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset();
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--ink-secondary)]">Father</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm">
              <Field label="Name" value={student.father_name ?? "—"} />
              <Field label="Mobile number" value={student.father_phone ?? "—"} />
              <Field label="Email" value={student.father_email ?? "—"} />
              <Field label="Occupation" value={student.father_occupation ?? "—"} />
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--ink-secondary)]">Mother</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm">
              <Field label="Name" value={student.mother_name ?? "—"} />
              <Field label="Mobile number" value={student.mother_phone ?? "—"} />
              <Field label="Email" value={student.mother_email ?? "—"} />
              <Field label="Occupation" value={student.mother_occupation ?? "—"} />
            </dl>
          </div>
        </div>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
/** View-only — fee structures and payments can only be edited by the school office (admin/principal/accountant), not a teacher. */
function FeeSummaryReadOnlyCard({ studentId }: { studentId: string }) {
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["teacher", "students", studentId, "fees", "summary"],
    queryFn: () => feesService.fetchFeeSummary(studentId),
  });

  if (summaryQuery.isLoading) return <Skeleton className="h-56 w-full" />;
  const summary = summaryQuery.data;
  if (!summary) return <EmptyState title="Fee information is not available" />;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Fee information</h2>
        <p className="text-xs text-[var(--ink-muted)]">View-only — fee records can only be edited by the school office.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Total due</p>
          <p className="text-xl font-semibold text-[var(--ink-primary)]">₹{summary.totalDue.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Total paid</p>
          <p className="text-xl font-semibold text-[var(--status-good)]">₹{summary.totalPaid.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">Balance</p>
          <p className="text-xl font-semibold text-[var(--status-serious)]">₹{Math.max(0, summary.balance).toFixed(2)}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--ink-secondary)]">Payment history ({summary.payments.length})</h3>
        {summary.payments.length === 0 ? (
          <EmptyState title="No payments recorded yet" />
        ) : (
          <DataTable
            rows={summary.payments}
            rowKey={(p) => p.id}
            emptyMessage="No payments recorded yet."
            columns={[
              { header: "Date", cell: (p) => p.payment_date },
              { header: "Amount", cell: (p) => `₹${Number(p.amount).toFixed(2)}` },
              { header: "Method", cell: (p) => p.payment_method.replace("_", " ") },
              { header: "Reference", cell: (p) => p.reference_no ?? "—" },
              {
                header: "",
                cell: (p) => (
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setReceiptPaymentId(p.id)}>
                    Receipt
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>

      <ReceiptModal paymentId={receiptPaymentId} onClose={() => setReceiptPaymentId(null)} />
    </Card>
  );
}

// ----------------------------------------------------------------------------
function TransportDetailsCard({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [routeId, setRouteId] = useState("");
  const [isAddStopOpen, setAddStopOpen] = useState(false);

  const transportQuery = useQuery({
    queryKey: ["teacher", "students", studentId, "transport"],
    queryFn: () => transportService.fetchStudentTransport(studentId),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["teacher", "transport", "routes"],
    queryFn: transportService.fetchRoutes,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["teacher", "students", studentId, "transport"] });

  const assignMutation = useMutation({
    mutationFn: ({ pickupPointId, direction }: { pickupPointId: string; direction?: TransportDirection }) =>
      transportService.assignStudentTransport(studentId, { pickup_point_id: pickupPointId, transport_direction: direction }),
    onSuccess: invalidate,
  });

  const unassignMutation = useMutation({
    mutationFn: () => transportService.unassignStudentTransport(studentId),
    onSuccess: invalidate,
  });

  if (transportQuery.isLoading) return <Skeleton className="h-40 w-full" />;
  const assignment = transportQuery.data;
  const pickupPoint = assignment?.pickup_points;
  const route = pickupPoint?.routes;
  const vehicle = route?.vehicle;
  const driver = route?.primary_driver?.users;

  const selectedRoute = routes.find((r) => r.id === (routeId || route?.id));
  const stopOptions = [...(selectedRoute?.pickup_points ?? [])].sort((a, b) => a.stop_order - b.stop_order).map((p) => ({ value: p.id, label: p.name }));

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Transport details</h2>

      {pickupPoint ? (
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Field label="Stop" value={pickupPoint.name} />
          <Field label="Pickup time" value={pickupPoint.pickup_time ?? "—"} />
          <Field label="When" value={DIRECTION_LABEL[assignment?.transport_direction ?? "both"]} />
          <Field label="Route" value={route ? route.name : "—"} />
          <Field label="Vehicle" value={vehicle ? (vehicle.name || vehicle.vehicle_number) : "—"} />
          <Field label="Driver" value={driver ? `${driver.full_name}${driver.phone ? ` — ${driver.phone}` : ""}` : "—"} />
        </dl>
      ) : (
        <EmptyState title="No transport assigned yet" />
      )}

      <div className="flex flex-wrap items-end gap-4 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
        <Select
          label="Route"
          placeholder="Select a route"
          options={routes.map((r) => ({ value: r.id, label: r.name }))}
          value={routeId || route?.id || ""}
          onChange={(e) => setRouteId(e.target.value)}
        />
        <Select
          label="Stop"
          placeholder="Select a stop"
          options={stopOptions}
          defaultValue={assignment?.pickup_point_id ?? ""}
          disabled={!selectedRoute}
          onChange={(e) => e.target.value && assignMutation.mutate({ pickupPointId: e.target.value, direction: assignment?.transport_direction })}
        />
        <Select
          label="When"
          options={DIRECTION_OPTIONS}
          defaultValue={assignment?.transport_direction ?? "both"}
          disabled={!assignment?.pickup_point_id}
          onChange={(e) => assignment?.pickup_point_id && assignMutation.mutate({ pickupPointId: assignment.pickup_point_id, direction: e.target.value as TransportDirection })}
        />
        {selectedRoute && (
          <Button type="button" variant="secondary" onClick={() => setAddStopOpen(true)}>
            + Add stop
          </Button>
        )}
        {assignment && (
          <Button variant="ghost" className="text-red-600" isLoading={unassignMutation.isPending} onClick={() => unassignMutation.mutate()}>
            Remove transport
          </Button>
        )}
        {assignMutation.isPending && <p className="text-sm text-[var(--ink-muted)]">Saving...</p>}
      </div>

      {selectedRoute && stopOptions.length === 0 && (
        <p className="text-sm text-[var(--ink-muted)]">"{selectedRoute.name}" has no stops yet — use "+ Add stop" above to create the first one.</p>
      )}

      {selectedRoute && (
        <AddStopModal
          isOpen={isAddStopOpen}
          route={selectedRoute}
          onClose={() => setAddStopOpen(false)}
          onAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["teacher", "transport", "routes"] });
            setAddStopOpen(false);
          }}
        />
      )}
    </Card>
  );
}

interface AddStopFormValues {
  name: string;
  address: string;
  pickup_time: string;
}

function AddStopModal({
  isOpen,
  route,
  onClose,
  onAdded,
}: {
  isOpen: boolean;
  route: { id: string; pickup_points: { id: string }[] };
  onClose: () => void;
  onAdded: () => void;
}) {
  const { register, handleSubmit, reset } = useForm<AddStopFormValues>({
    defaultValues: { name: "", address: "", pickup_time: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: AddStopFormValues) =>
      transportService.createPickup({
        route_id: route.id,
        name: values.name,
        address: values.address || undefined,
        stop_order: route.pickup_points.length + 1,
        pickup_time: values.pickup_time || undefined,
      }),
    onSuccess: () => {
      reset();
      onAdded();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add stop">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Input label="Name" {...register("name", { required: true })} />
        <Input label="Address (optional)" {...register("address")} />
        <Input label="Time (optional)" type="time" {...register("pickup_time")} />
        {mutation.isError && <p className="text-sm text-red-600">{getApiErrorMessage(mutation.error, "Failed to add stop.")}</p>}
        <Button type="submit" className="w-full" isLoading={mutation.isPending}>
          Add stop
        </Button>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
function DocumentsCard({
  studentId,
  schoolId,
  documents,
  isLoading,
  onChanged,
}: {
  studentId: string;
  schoolId: string;
  documents: Awaited<ReturnType<typeof documentsService.fetchDocuments>>;
  isLoading: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("other");
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<(typeof documents)[number] | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => documentsService.deleteDocument(studentId, documentId),
    onSuccess: () => {
      onChanged();
      setDeletingDoc(null);
      toast.success("Document deleted");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to delete document.")),
  });

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await documentsService.uploadDocument(schoolId, studentId, file, docType, notes || undefined);
      onChanged();
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Document uploaded");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Documents</h2>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : documents.length === 0 ? (
        <EmptyState title="No documents uploaded yet" description="Upload the student's photo, birth certificate, or other records." />
      ) : (
        <DataTable
          isLoading={isLoading}
          rows={documents}
          rowKey={(d) => d.id}
          emptyMessage="No documents uploaded yet."
          columns={[
            { header: "Type", cell: (d) => DOC_TYPE_OPTIONS.find((o) => o.value === d.doc_type)?.label ?? d.doc_type },
            { header: "File", cell: (d) => d.file_name },
            { header: "Uploaded", cell: (d) => new Date(d.uploaded_at).toLocaleDateString() },
            {
              header: "",
              cell: (d) => (
                <div className="flex gap-2">
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                      View
                    </a>
                  )}
                  <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setDeletingDoc(d)}>
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
        <Select label="Document type" options={DOC_TYPE_OPTIONS} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} />
        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--ink-secondary)]">File</label>
          <input ref={fileInputRef} type="file" className="text-sm" />
        </div>
        <Button onClick={handleUpload} isLoading={isUploading}>
          Upload
        </Button>
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

      <ConfirmDialog
        isOpen={!!deletingDoc}
        title="Delete document"
        message={`Delete "${deletingDoc?.file_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingDoc && deleteMutation.mutate(deletingDoc.id)}
        onCancel={() => setDeletingDoc(null)}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
function ActivityTimelineCard({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "students", studentId, "activity"],
    queryFn: () => activityService.fetchActivityTimeline(studentId),
  });

  const entries = data ?? [];

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Activity timeline</h2>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : entries.length === 0 ? (
        <EmptyState title="No activity recorded yet" />
      ) : (
        <ol className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTIVITY_TYPE_DOT[entry.type] ?? "bg-slate-400"}`} />
              <div>
                <p className="text-sm text-[var(--ink-primary)]">{entry.label}</p>
                <p className="text-xs text-[var(--ink-muted)]">{new Date(entry.date).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/**
 * This student's profile change requests, reviewable inline. The backend
 * queue endpoint (/profile-change-requests) returns every request across the
 * teacher's whole homeroom class — not just this student — so it's filtered
 * client-side to this page's studentId, same tradeoff TeacherLeavePage.tsx's
 * StudentLeaveQueue accepts for its own class-wide queue.
 */
function ProfileChangeRequestQueue({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);

  const queueQuery = useQuery({
    queryKey: ["teacher", "profile-change-queue"],
    queryFn: () => profileChangeRequestService.fetchProfileChangeQueue(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      profileChangeRequestService.reviewProfileChangeRequest(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "profile-change-queue"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "students", studentId] });
      setConfirmTarget(null);
      if (updated.alreadyReviewed) {
        toast.info("This request was already reviewed by someone else.");
      } else {
        toast.success(`Profile change request ${updated.status}.`);
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update the request."));
      setConfirmTarget(null);
    },
  });

  const forStudent = (queueQuery.data ?? []).filter((r) => r.student_id === studentId);
  const pending = forStudent.filter((r) => r.status === "pending");
  const history = forStudent.filter((r) => r.status !== "pending");

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">Pending profile change requests</h2>
        {queueQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : pending.length === 0 ? (
          <EmptyState title="No pending requests" description="Profile change requests for this student will appear here." />
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-lg border border-black/[0.06] p-3 text-sm dark:border-white/[0.08]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium capitalize text-[var(--ink-primary)]">{r.requester_role} requested a change</p>
                    {r.reason && <p className="text-[var(--ink-muted)]">{r.reason}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      variant="secondary"
                      className="!p-1.5 text-[var(--status-good)]"
                      title="Approve"
                      onClick={() => reviewMutation.mutate({ id: r.id, status: "approved" })}
                      isLoading={reviewMutation.isPending && reviewMutation.variables?.id === r.id && reviewMutation.variables?.status === "approved"}
                    >
                      <Check size={15} strokeWidth={2} />
                    </Button>
                    <Button
                      variant="secondary"
                      className="!p-1.5 text-[var(--status-serious)]"
                      title="Reject"
                      onClick={() => setConfirmTarget({ id: r.id, status: "rejected" })}
                    >
                      <X size={15} strokeWidth={2} />
                    </Button>
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-1.5 border-t border-black/[0.06] pt-2 text-xs dark:border-white/[0.08] sm:grid-cols-2">
                  {Object.entries(r.changes).map(([field, edit]) => (
                    <div key={field} className="flex justify-between gap-2">
                      <span className="capitalize text-[var(--ink-muted)]">{field.replace(/_/g, " ")}</span>
                      <span className="text-right text-[var(--ink-primary)]">
                        {String(edit.from ?? "—")} → {String(edit.to ?? "—")}
                      </span>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ink-primary)]">History</h2>
        <DataTable
          isLoading={queueQuery.isLoading}
          rows={history}
          rowKey={(r) => r.id}
          emptyMessage="No reviewed requests yet."
          columns={[
            { header: "Requested by", cell: (r) => <span className="capitalize">{r.requester_role}</span> },
            { header: "Fields", cell: (r) => Object.keys(r.changes).join(", ") },
            { header: "Status", cell: (r) => <Badge variant={CHANGE_STATUS_BADGE[r.status]}>{r.status}</Badge> },
          ]}
        />
      </Card>

      <ConfirmDialog
        isOpen={!!confirmTarget}
        title="Reject profile change request"
        message="Are you sure you want to reject this request?"
        confirmLabel="Reject"
        isLoading={reviewMutation.isPending}
        onConfirm={() => confirmTarget && reviewMutation.mutate(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
