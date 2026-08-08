import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Users, GraduationCap, Wallet, Bus, FileText, History, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Spinner } from "@/components/ui/Spinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReceiptModal } from "@/pages/admin/fees/components/ReceiptModal";
import { FeeStructureSection } from "@/pages/admin/fees/components/FeeStructureSection";
import * as studentsService from "@/services/admin/students.service";
import * as classesService from "@/services/admin/classes.service";
import * as documentsService from "@/services/admin/studentDocuments.service";
import * as feesService from "@/services/admin/fees.service";
import * as studentTransportService from "@/services/admin/studentTransport.service";
import * as transportService from "@/services/transport.service";
import * as siblingsService from "@/services/admin/studentSiblings.service";
import * as activityService from "@/services/admin/studentActivity.service";
import * as academicService from "@/services/admin/studentAcademic.service";
import { fetchStudentDashboard } from "@/services/studentDashboard.service";
import { fetchAllHomework } from "@/services/student/homework.service";
import { getApiErrorMessage } from "@/lib/axios";
import { DocumentType, Sibling } from "@/types/admin.types";
import { TransportDirection } from "@/types/transport.types";
import {
  INDIAN_STATE_OPTIONS,
  NATIONALITY_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  RELIGION_OPTIONS,
  CATEGORY_OPTIONS,
  getDistrictOptionsForState,
} from "@/utils/indianRegions";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { digitsOnly, PHONE_PATTERN, AADHAAR_PATTERN } from "@/utils/formHelpers";

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "birth_certificate", label: "Birth certificate" },
  { value: "id_proof", label: "ID proof (Aadhaar/Passport/etc.)" },
  { value: "transfer_certificate", label: "Transfer certificate" },
  { value: "photo", label: "Photo" },
  { value: "medical", label: "Medical record" },
  { value: "other", label: "Other" },
];

type TabKey = "profile" | "parents" | "academic" | "fees" | "transport" | "documents" | "activity";

const TAB_ITEMS: TabItem<TabKey>[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "parents", label: "Family", icon: Users },
  { key: "academic", label: "Academic", icon: GraduationCap },
  { key: "fees", label: "Fee Information", icon: Wallet },
  { key: "transport", label: "Transport", icon: Bus },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "activity", label: "Activity Timeline", icon: History },
];

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const studentId = id!;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  const studentQuery = useQuery({
    queryKey: ["admin", "students", studentId],
    queryFn: () => studentsService.fetchStudent(studentId),
  });

  const documentsQuery = useQuery({
    queryKey: ["admin", "students", studentId, "documents"],
    queryFn: () => documentsService.fetchDocuments(studentId),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  function invalidateStudent() {
    queryClient.invalidateQueries({ queryKey: ["admin", "students", studentId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
  }
  function invalidateDocuments() {
    queryClient.invalidateQueries({ queryKey: ["admin", "students", studentId, "documents"] });
  }

  if (studentQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!studentQuery.data) return <p className="text-sm text-slate-500 dark:text-slate-400">Student not found.</p>;

  const student = studentQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/dashboard/admin/students" className="text-sm text-brand-600 hover:underline">
            ← Back to students
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{student.users.full_name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Admission No: {student.admission_no}
            {!student.users.is_active && <span className="ml-2 text-red-600">(Deactivated)</span>}
          </p>
        </div>
        <PhotoUpload student={student} onUploaded={invalidateStudent} />
      </div>

      <Tabs tabs={TAB_ITEMS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "profile" && (
        <div className="space-y-6">
          <PersonalDetailsCard student={student} onSaved={invalidateStudent} />
          <ClassDetailsCard student={student} classOptions={classOptions} onAssigned={invalidateStudent} />
          <MedicalInfoCard student={student} onSaved={invalidateStudent} />
          <SiblingsSection studentId={studentId} />
        </div>
      )}

      {activeTab === "parents" && (
        <div className="space-y-6">
          <ParentContactCard student={student} onSaved={invalidateStudent} />
        </div>
      )}

      {activeTab === "academic" && (
        <div className="space-y-6">
          <AttendanceMarksSummaryCard studentId={studentId} />
          <MarksTable studentId={studentId} />
          <HomeworkSummaryCard studentId={studentId} />
        </div>
      )}

      {activeTab === "fees" && <FeeSummaryCard studentId={studentId} />}

      {activeTab === "transport" && <TransportDetailsCard studentId={studentId} />}

      {activeTab === "documents" && (
        <DocumentsCard
          studentId={studentId}
          schoolId={user?.school_id ?? ""}
          documents={documentsQuery.data ?? []}
          isLoading={documentsQuery.isLoading}
          onChanged={invalidateDocuments}
        />
      )}

      {activeTab === "activity" && <ActivityTimelineCard studentId={studentId} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
function PhotoUpload({
  student,
  onUploaded,
}: {
  student: Awaited<ReturnType<typeof studentsService.fetchStudent>>;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const toast = useToast();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => studentsService.uploadStudentPhoto(student.id, file),
    onSuccess: () => {
      onUploaded();
      setError(null);
      toast.success("Photo updated");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to upload photo"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => studentsService.deleteStudentPhoto(student.id),
    onSuccess: () => {
      onUploaded();
      setConfirmingDelete(false);
      toast.success("Photo removed");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to remove photo");
      setConfirmingDelete(false);
    },
  });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={student.users.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(student.users.full_name)}`}
        alt="Student avatar"
        className="h-16 w-16 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-white/10"
      />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <div className="flex gap-1">
        <Button
          variant="ghost"
          className="!px-2 !py-1 text-xs"
          isLoading={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          Change photo
        </Button>
        {student.users.avatar_url && (
          <Button
            variant="ghost"
            className="!px-2 !py-1 text-xs text-red-600"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <ConfirmDialog
        isOpen={confirmingDelete}
        title="Remove photo"
        message="Remove this student's profile photo?"
        confirmLabel="Remove"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
function PersonalDetailsCard({
  student,
  onSaved,
}: {
  student: Awaited<ReturnType<typeof studentsService.fetchStudent>>;
  onSaved: () => void;
}) {
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
  });

  function onPersonalDetailsSubmit(values: Record<string, string>) {
    const { nationality_other, religion_other, ...rest } = values;
    updateMutation.mutate({
      ...rest,
      nationality: rest.nationality === "Other" ? nationality_other : rest.nationality,
      religion: rest.religion === "Other" ? religion_other : rest.religion,
    });
  }

  const deactivateMutation = useMutation({
    mutationFn: () => studentsService.deactivateStudent(student.id),
    onSuccess: onSaved,
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Personal details</h2>
        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {student.users.is_active && (
            <Button variant="danger" onClick={() => deactivateMutation.mutate()} isLoading={deactivateMutation.isPending}>
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit(onPersonalDetailsSubmit)}
        >
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

// ----------------------------------------------------------------------------
function ClassDetailsCard({
  student,
  classOptions,
  onAssigned,
}: {
  student: Awaited<ReturnType<typeof studentsService.fetchStudent>>;
  classOptions: { value: string; label: string }[];
  onAssigned: () => void;
}) {
  const assignClassMutation = useMutation({
    mutationFn: (classId: string) => studentsService.assignClass(student.id, classId),
    onSuccess: onAssigned,
  });

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Class details</h2>
      <div className="flex items-end gap-4">
        <Select
          key={student.class_id ?? "unassigned"}
          label="Class"
          placeholder="Unassigned"
          options={classOptions}
          defaultValue={student.class_id ?? ""}
          onChange={(e) => e.target.value && assignClassMutation.mutate(e.target.value)}
        />
        {assignClassMutation.isPending && <p className="text-sm text-slate-500 dark:text-slate-400">Saving...</p>}
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
/** Mandatory quick-capture Father/Mother contact fields, separate from the full Parent/Guardian login-account system below. */
function ParentContactCard({
  student,
  onSaved,
}: {
  student: Awaited<ReturnType<typeof studentsService.fetchStudent>>;
  onSaved: () => void;
}) {
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
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Parent contact details</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Quick-capture contact info — not a portal login account.
          </p>
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
            <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Father</h3>
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
            <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Mother</h3>
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
            <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Father</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm">
              <Field label="Name" value={student.father_name ?? "—"} />
              <Field label="Mobile number" value={student.father_phone ?? "—"} />
              <Field label="Email" value={student.father_email ?? "—"} />
              <Field label="Occupation" value={student.father_occupation ?? "—"} />
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Mother</h3>
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
function SiblingsSection({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isLinkOpen, setLinkOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [unlinking, setUnlinking] = useState<Sibling | null>(null);

  const siblingsQuery = useQuery({
    queryKey: ["admin", "students", studentId, "siblings"],
    queryFn: () => siblingsService.fetchSiblings(studentId),
  });

  const searchQuery = useQuery({
    queryKey: ["admin", "students", studentId, "siblings", "search", search],
    queryFn: () => siblingsService.searchSiblingCandidates(studentId, search || undefined),
    enabled: isLinkOpen,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "students", studentId, "siblings"] });
  }

  const linkMutation = useMutation({
    mutationFn: (siblingId: string) => siblingsService.linkSibling(studentId, siblingId),
    onSuccess: () => {
      invalidate();
      toast.success("Sibling linked");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (siblingId: string) => siblingsService.unlinkSibling(studentId, siblingId),
    onSuccess: () => {
      invalidate();
      setUnlinking(null);
      toast.success("Sibling unlinked");
    },
  });

  const siblings = siblingsQuery.data ?? [];

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Siblings</h2>
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
            <li
              key={sibling.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-white/10"
            >
              <Link
                to={`/dashboard/admin/students/${sibling.id}`}
                className="flex items-center gap-3 hover:text-brand-600"
              >
                <img
                  src={sibling.users.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(sibling.users.full_name)}`}
                  alt={sibling.users.full_name}
                  className="h-9 w-9 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{sibling.users.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {sibling.classes ? `${sibling.classes.name} - ${sibling.classes.section}` : "Unassigned"} · Roll{" "}
                    {sibling.roll_no ?? "—"}
                  </p>
                </div>
              </Link>
              <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setUnlinking(sibling)}>
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={isLinkOpen} onClose={() => setLinkOpen(false)} title="Link sibling">
        <div className="space-y-4">
          <Input
            label="Search by name or admission number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searchQuery.isLoading && <Spinner label="Searching..." />}
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {(searchQuery.data ?? []).map((candidate) => (
              <li
                key={candidate.id}
                className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-white/10"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{candidate.users.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {candidate.admission_no} ·{" "}
                    {candidate.classes ? `${candidate.classes.name} - ${candidate.classes.section}` : "Unassigned"}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="!px-3 !py-1 text-xs"
                  isLoading={linkMutation.isPending}
                  onClick={() => linkMutation.mutate(candidate.id)}
                >
                  Link
                </Button>
              </li>
            ))}
          </ul>
          {searchQuery.data?.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No matching students found.</p>
          )}
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
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Documents</h2>

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
            {
              header: "Uploaded",
              cell: (d) => new Date(d.uploaded_at).toLocaleDateString(),
            },
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

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
        <Select
          label="Document type"
          options={DOC_TYPE_OPTIONS}
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocumentType)}
        />
        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">File</label>
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
function MedicalInfoCard({
  student,
  onSaved,
}: {
  student: Awaited<ReturnType<typeof studentsService.fetchStudent>>;
  onSaved: () => void;
}) {
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
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Medical information</h2>
        {!isEditing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        >
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
function AttendanceMarksSummaryCard({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "students", studentId, "dashboard-summary"],
    queryFn: () => fetchStudentDashboard(studentId),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return null;

  const { attendance, marks } = data;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Attendance summary</h2>
        <p className="text-3xl font-semibold text-brand-600">
          {attendance.percentage !== null ? `${attendance.percentage}%` : "—"}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
          {Object.entries(attendance.counts ?? {}).map(([status, count]) => (
            <div key={status}>
              <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{status.replace("_", " ")}</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">{count}</dd>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Marks summary</h2>
        {marks.latestExam ? (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Latest: {marks.latestExam.examName}
              {marks.latestExam.examDate ? ` (${marks.latestExam.examDate})` : ""}
            </p>
            <p className="text-3xl font-semibold text-brand-600">
              {marks.latestExam.percentage !== null ? `${marks.latestExam.percentage}%` : "—"}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No exam results recorded yet.</p>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
function MarksTable({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "students", studentId, "marks"],
    queryFn: () => academicService.fetchMarksForStudent(studentId),
  });

  const marks = data ?? [];

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Subject-wise marks</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">Class rank: —</span>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : marks.length === 0 ? (
        <EmptyState title="No exam results yet" description="Marks will appear here once an exam is published." />
      ) : (
        <DataTable
          rows={marks}
          rowKey={(m) => m.id}
          emptyMessage="No exam results yet."
          columns={[
            { header: "Exam", cell: (m) => m.exams?.name ?? "—" },
            { header: "Date", cell: (m) => m.exams?.exam_date ?? "—" },
            { header: "Subject", cell: (m) => m.subjects?.name ?? "—" },
            { header: "Marks", cell: (m) => `${m.marks_obtained} / ${m.max_marks}` },
            { header: "Grade", cell: (m) => m.grade ?? "—" },
          ]}
        />
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
function HomeworkSummaryCard({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "students", studentId, "homework"],
    queryFn: () => fetchAllHomework(studentId),
  });

  const homework = data ?? [];
  const completed = homework.filter((h) => h.submission).length;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Homework summary</h2>
        {!isLoading && homework.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {completed} / {homework.length} submitted
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : homework.length === 0 ? (
        <EmptyState title="No homework assigned yet" />
      ) : (
        <DataTable
          rows={homework.slice(0, 10)}
          rowKey={(h) => h.id}
          emptyMessage="No homework assigned yet."
          columns={[
            { header: "Title", cell: (h) => h.title },
            { header: "Subject", cell: (h) => h.subjects?.name ?? "—" },
            { header: "Due date", cell: (h) => new Date(h.due_date).toLocaleDateString() },
            { header: "Status", cell: (h) => (h.submission ? "Submitted" : "Pending") },
          ]}
        />
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
function FeeSummaryCard({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["admin", "students", studentId, "fees", "summary"],
    queryFn: () => feesService.fetchFeeSummary(studentId),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { amount: "", payment_method: "cash" as const, reference_no: "", notes: "" },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "students", studentId, "fees", "summary"] });
  }

  const paymentMutation = useMutation({
    mutationFn: (values: { amount: string; payment_method: string; reference_no: string; notes: string }) =>
      feesService.recordPayment(studentId, {
        amount: Number(values.amount),
        payment_method: values.payment_method as feesService.RecordPaymentInput["payment_method"],
        reference_no: values.reference_no || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      invalidate();
      reset();
      setPaymentOpen(false);
      toast.success("Payment recorded");
    },
  });

  if (summaryQuery.isLoading) return <Skeleton className="h-56 w-full" />;
  const summary = summaryQuery.data;
  if (!summary) return null;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Fee summary</h2>
        <Button onClick={() => setPaymentOpen(true)}>Record payment</Button>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Total due</p>
          <p className="text-xl font-semibold text-slate-800 dark:text-slate-100">₹{summary.totalDue.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Total paid</p>
          <p className="text-xl font-semibold text-green-600 dark:text-green-400">₹{summary.totalPaid.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Balance</p>
          <p
            className={`text-xl font-semibold ${
              summary.balance > 0
                ? "text-red-600 dark:text-red-400"
                : summary.balance < 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-slate-800 dark:text-slate-100"
            }`}
          >
            ₹{Math.abs(summary.balance).toFixed(2)} {summary.balance < 0 ? "credit" : summary.balance > 0 ? "due" : ""}
          </p>
        </div>
      </div>

      <FeeStructureSection
        studentId={studentId}
        structures={summary.structures}
        transportFee={summary.transportFee}
        onChanged={invalidate}
      />

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Payment history ({summary.payments.length})</h3>
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

      <Modal isOpen={isPaymentOpen} onClose={() => setPaymentOpen(false)} title="Record payment">
        <form className="space-y-4" onSubmit={handleSubmit((values) => paymentMutation.mutate(values))}>
          <Input label="Amount" type="number" step="0.01" {...register("amount", { required: true })} />
          <Select
            label="Payment method"
            options={[
              { value: "cash", label: "Cash" },
              { value: "card", label: "Card" },
              { value: "bank_transfer", label: "Bank transfer" },
              { value: "online", label: "Online" },
              { value: "cheque", label: "Cheque" },
              { value: "other", label: "Other" },
            ]}
            {...register("payment_method")}
          />
          <Input label="Reference number (optional)" {...register("reference_no")} />
          <Input label="Notes (optional)" {...register("notes")} />
          <Button type="submit" className="w-full" isLoading={isSubmitting || paymentMutation.isPending}>
            Record payment
          </Button>
        </form>
      </Modal>

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
    queryKey: ["admin", "students", studentId, "transport"],
    queryFn: () => studentTransportService.fetchStudentTransport(studentId),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["admin", "transport", "routes"],
    queryFn: transportService.fetchRoutes,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "students", studentId, "transport"] });

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
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Transport details</h2>

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

      {routes.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No transport routes exist yet.{" "}
          <Link to="/dashboard/admin/transport?tab=routes" className="font-medium text-brand-600 hover:underline">
            Add a route
          </Link>{" "}
          first, then add stops to it below.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4 border-t border-slate-100 pt-4 dark:border-white/10">
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
        {assignMutation.isPending && <p className="text-sm text-slate-500 dark:text-slate-400">Saving...</p>}
      </div>

      {selectedRoute && stopOptions.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          "{selectedRoute.name}" has no stops yet — use "+ Add stop" above to create the first one.
        </p>
      )}

      {selectedRoute && (
        <AddStopModal
          isOpen={isAddStopOpen}
          route={selectedRoute}
          onClose={() => setAddStopOpen(false)}
          onAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "transport", "routes"] });
            setAddStopOpen(false);
          }}
        />
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
const DIRECTION_OPTIONS: { value: TransportDirection; label: string }[] = [
  { value: "both", label: "Morning & Evening" },
  { value: "morning", label: "Morning only" },
  { value: "evening", label: "Evening only" },
];
const DIRECTION_LABEL: Record<TransportDirection, string> = { both: "Morning & Evening", morning: "Morning only", evening: "Evening only" };

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
const ACTIVITY_TYPE_DOT: Record<string, string> = {
  activity_log: "bg-brand-500",
  attendance: "bg-amber-500",
  fee_payment: "bg-green-500",
  exam_mark: "bg-purple-500",
};

function ActivityTimelineCard({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "students", studentId, "activity"],
    queryFn: () => activityService.fetchActivityTimeline(studentId),
  });

  const entries = data ?? [];

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activity timeline</h2>
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
                <p className="text-sm text-slate-800 dark:text-slate-200">{entry.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.date).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
