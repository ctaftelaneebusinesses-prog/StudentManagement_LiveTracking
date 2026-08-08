import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Calendar, Clock, Plus, Trash2, Trophy, Users as UsersIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { StaffFormModal } from "@/pages/admin/extracurricularStaff/components/StaffFormModal";
import { ClassSectionSelects, ClassSectionValue } from "@/pages/admin/teachers/components/ClassSectionSelects";
import * as staffService from "@/services/admin/extracurricularStaff.service";
import * as activitiesService from "@/services/admin/activities.service";
import * as classesService from "@/services/admin/classes.service";
import {
  BatchScope,
  ExtracurricularAchievement,
  ExtracurricularBatch,
  ExtracurricularScheduleSlot,
} from "@/types/extracurricularStaff.types";
import { getApiErrorMessage } from "@/lib/axios";
import { resolveClassId } from "@/utils/classPicker";

const EMPTY_CLASS_SECTION: ClassSectionValue = { academicYearId: "", className: "", section: "" };

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const staffId = id!;
  const queryClient = useQueryClient();
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["admin", "extracurricular-staff", staffId],
    queryFn: () => staffService.fetchExtracurricularStaffMember(staffId),
  });

  function invalidateProfile() {
    queryClient.invalidateQueries({ queryKey: ["admin", "extracurricular-staff", staffId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "extracurricular-staff"] });
  }

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!profileQuery.data) return <p className="text-sm text-slate-500 dark:text-slate-400">Staff member not found.</p>;

  const staff = profileQuery.data;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/dashboard/admin/extracurricular-staff" className="text-sm text-brand-600 hover:underline">
          ← Back to extracurricular staff
        </Link>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar src={staff.users.avatar_url} name={staff.users.full_name} size="md" className="h-16 w-16 text-xl" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{staff.users.full_name}</h1>
              <Badge variant={staff.users.is_active ? "success" : "neutral"}>
                {staff.users.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Staff code: {staff.staff_code}
              {staff.staff_type_activity && <span className="ml-2">• {staff.staff_type_activity.staff_title}</span>}
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setEditModalOpen(true)}>
          Edit
        </Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Personal details</h2>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Gender" value={staff.gender ? staff.gender.charAt(0).toUpperCase() + staff.gender.slice(1) : "—"} />
          <Field label="Date of birth" value={staff.date_of_birth ?? "—"} />
          <Field label="Joining date" value={staff.joining_date ?? "—"} />
          <Field label="Phone" value={staff.users.phone ?? "—"} />
          <Field label="Email" value={staff.users.email} />
          <Field label="Address" value={staff.address ?? "—"} />
          <Field label="Qualification" value={staff.qualification ?? "—"} />
          <Field label="Experience" value={staff.experience_years != null ? `${staff.experience_years} years` : "—"} />
        </dl>
        {staff.bio && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Bio</dt>
            <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{staff.bio}</dd>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Assigned activities</h2>
        {staff.assignedActivities.length === 0 ? (
          <EmptyState title="No activities assigned yet." description="Edit this staff member to assign activities." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {staff.assignedActivities.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5">
                <Badge variant="info">
                  {a.activities.name} ({a.activities.staff_title})
                </Badge>
                <Badge variant={a.status === "completed" ? "success" : "neutral"}>
                  {a.status === "completed" ? "Completed" : "Assigned"}
                </Badge>
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-400">
            <UsersIcon size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Students training</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{staff.studentCount}</p>
          </div>
        </Card>
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Sessions run</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{staff.attendanceSummary.sessionsRun}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Present rate</p>
            <p className="text-2xl font-semibold text-[var(--delta-good)]">
              {Math.round(staff.attendanceSummary.presentRate)}%
            </p>
          </div>
        </Card>
      </div>

      <BatchesCard staffId={staffId} batches={staff.batches} onChanged={invalidateProfile} />
      <ScheduleCard staffId={staffId} batches={staff.batches} />
      <AchievementsCard staffId={staffId} schoolId={staff.school_id} />

      <StaffFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        staff={staff}
        onClose={() => setEditModalOpen(false)}
        onSaved={invalidateProfile}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
function BatchesCard({
  staffId,
  batches,
  onChanged,
}: {
  staffId: string;
  batches: ExtracurricularBatch[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [removing, setRemoving] = useState<ExtracurricularBatch | null>(null);

  const { data: activities = [] } = useQuery({
    queryKey: ["admin", "activities", "all"],
    queryFn: () => activitiesService.fetchActivities({ is_active: true }),
    enabled: isModalOpen,
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
    enabled: isModalOpen,
  });

  const [activityId, setActivityId] = useState("");
  const [classPicker, setClassPicker] = useState<ClassSectionValue>(EMPTY_CLASS_SECTION);
  const [scope, setScope] = useState<BatchScope>("entire_class");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const classId = resolveClassId(classes, classPicker.academicYearId, classPicker.className, classPicker.section);

  const classStudentsQuery = useQuery({
    queryKey: ["admin", "classes", classId, "students", studentSearch],
    queryFn: () => classesService.fetchClassStudents(classId!, { search: studentSearch || undefined, pageSize: 200 }),
    enabled: !!classId && scope === "selected_students" && isModalOpen,
  });

  function resetForm() {
    setActivityId("");
    setClassPicker(EMPTY_CLASS_SECTION);
    setScope("entire_class");
    setSelectedStudentIds(new Set());
    setStudentSearch("");
    setFormError(null);
  }

  function openModal() {
    resetForm();
    setModalOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      staffService.createBatch(staffId, {
        activity_id: activityId,
        academic_year_id: classPicker.academicYearId,
        class_id: classId!,
        scope,
        student_ids: scope === "selected_students" ? Array.from(selectedStudentIds) : undefined,
      }),
    onSuccess: () => {
      onChanged();
      toast.success("Class assigned.");
      setModalOpen(false);
    },
    onError: (err) => setFormError(getApiErrorMessage(err, "Failed to assign class.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (batchId: string) => staffService.deleteBatch(batchId),
    onSuccess: () => {
      onChanged();
      toast.success("Class assignment removed.");
      setRemoving(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to remove class assignment.")),
  });

  function handleSave() {
    setFormError(null);
    if (!activityId || !classId) {
      setFormError("Select an activity, academic year, class, and section.");
      return;
    }
    if (scope === "selected_students" && selectedStudentIds.size === 0) {
      setFormError("Select at least one student, or choose \"Entire class\" instead.");
      return;
    }
    createMutation.mutate();
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Class assignments</h2>
        <Button variant="secondary" onClick={openModal}>
          <Plus size={14} className="mr-1" />
          Assign class
        </Button>
      </div>

      <DataTable
        rows={batches}
        rowKey={(b) => b.id}
        emptyMessage="No classes assigned yet."
        columns={[
          { header: "Activity", cell: (b) => b.activities?.name ?? "—" },
          {
            header: "Class",
            cell: (b) => (b.classes ? `${b.classes.name} - ${b.classes.section}` : "—"),
          },
          { header: "Academic year", cell: (b) => b.academic_years?.name ?? "—" },
          {
            header: "Scope",
            cell: (b) => <Badge variant="neutral">{b.scope === "entire_class" ? "Entire class" : "Selected students"}</Badge>,
          },
          { header: "Students", cell: (b) => b.student_count ?? "—" },
          {
            header: "",
            cell: (b) => (
              <Button variant="ghost" className="!p-1.5 text-red-600" title="Remove" onClick={() => setRemoving(b)}>
                <Trash2 size={14} />
              </Button>
            ),
            className: "text-right",
          },
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Assign class" size="lg">
        <div className="space-y-4">
          <SearchableSelect
            label="Activity"
            placeholder="Select activity"
            options={activities.map((a) => ({ value: a.id, label: a.name }))}
            value={activityId}
            onChange={setActivityId}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ClassSectionSelects classes={classes} value={classPicker} onChange={setClassPicker} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Scope</label>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => setScope("entire_class")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  scope === "entire_class"
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                    : "border-slate-300 text-slate-600 dark:border-white/20 dark:text-slate-300"
                }`}
              >
                Entire class
              </button>
              <button
                type="button"
                onClick={() => setScope("selected_students")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  scope === "selected_students"
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                    : "border-slate-300 text-slate-600 dark:border-white/20 dark:text-slate-300"
                }`}
              >
                Selected students
              </button>
            </div>
          </div>

          {scope === "selected_students" && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <Input
                label="Search students"
                placeholder="Search by name or admission no…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                disabled={!classId}
              />
              {!classId && <p className="text-xs text-slate-400 dark:text-slate-500">Select a class first.</p>}
              {classId && (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {classStudentsQuery.isLoading && <Skeleton className="h-20 w-full" />}
                  {classStudentsQuery.data?.items.length === 0 && (
                    <p className="py-2 text-sm text-slate-400 dark:text-slate-500">No students found.</p>
                  )}
                  {classStudentsQuery.data?.items.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                      <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                      {s.users.full_name}{" "}
                      <span className="text-xs text-slate-400 dark:text-slate-500">({s.admission_no})</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">{selectedStudentIds.size} student(s) selected</p>
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button className="w-full" onClick={handleSave} isLoading={createMutation.isPending}>
            Assign class
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!removing}
        title="Remove class assignment"
        message={`Remove the "${removing?.activities?.name}" assignment for ${removing?.classes?.name} - ${removing?.classes?.section}? This also removes its schedule slots.`}
        confirmLabel="Remove"
        isLoading={deleteMutation.isPending}
        onConfirm={() => removing && deleteMutation.mutate(removing.id)}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
function ScheduleCard({ staffId, batches }: { staffId: string; batches: ExtracurricularBatch[] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const [removing, setRemoving] = useState<ExtracurricularScheduleSlot | null>(null);

  const scheduleQuery = useQuery({
    queryKey: ["admin", "extracurricular-staff", staffId, "schedule"],
    queryFn: () => staffService.fetchStaffSchedule(staffId),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    batch_id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    venue: string;
  }>({
    defaultValues: { batch_id: "", day_of_week: "1", start_time: "", end_time: "", venue: "" },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "extracurricular-staff", staffId, "schedule"] });
  }

  const saveMutation = useMutation({
    mutationFn: (values: { batch_id: string; day_of_week: string; start_time: string; end_time: string; venue: string }) =>
      staffService.upsertScheduleSlot({
        batch_id: values.batch_id,
        day_of_week: Number(values.day_of_week),
        start_time: values.start_time,
        end_time: values.end_time,
        venue: values.venue || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Schedule slot saved.");
      reset();
      setModalOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to save schedule slot.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (slotId: string) => staffService.deleteScheduleSlot(slotId),
    onSuccess: () => {
      invalidate();
      toast.success("Schedule slot removed.");
      setRemoving(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to remove schedule slot.")),
  });

  const slots = scheduleQuery.data ?? [];
  const batchLabel = (batchId: string) => {
    const b = batches.find((x) => x.id === batchId);
    return b ? `${b.activities?.name ?? "Activity"} — ${b.classes ? `${b.classes.name} ${b.classes.section}` : ""}` : "—";
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Weekly schedule</h2>
        <Button
          variant="secondary"
          onClick={() => {
            reset();
            setModalOpen(true);
          }}
          disabled={batches.length === 0}
        >
          <Plus size={14} className="mr-1" />
          Add slot
        </Button>
      </div>

      {batches.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">Assign a class before scheduling sessions.</p>
      )}

      {slots.length === 0 ? (
        <EmptyState title="No schedule slots yet." description="Add a weekly slot for one of this staff member's assigned classes." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DAY_LABELS.map((day, dayIndex) => {
            const daySlots = slots.filter((s) => s.day_of_week === dayIndex);
            if (daySlots.length === 0) return null;
            return (
              <div key={day} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <Calendar size={12} />
                  {DAY_LABELS_SHORT[dayIndex]}
                </p>
                <div className="space-y-2">
                  {daySlots.map((slot) => (
                    <div key={slot.id} className="flex items-start justify-between gap-2 text-sm">
                      <div>
                        <p className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-100">
                          <Clock size={12} />
                          {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{batchLabel(slot.batch_id)}</p>
                        {slot.venue && <p className="text-xs text-slate-400 dark:text-slate-500">{slot.venue}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemoving(slot)}
                        className="shrink-0 text-slate-400 hover:text-red-600"
                        aria-label="Remove slot"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Add schedule slot">
        <form className="space-y-4" onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
          <Select
            label="Class"
            placeholder="Select class"
            options={batches.map((b) => ({
              value: b.id,
              label: `${b.activities?.name ?? "Activity"} — ${b.classes ? `${b.classes.name} ${b.classes.section}` : ""}`,
            }))}
            error={errors.batch_id?.message}
            {...register("batch_id", { required: "Select a class" })}
          />
          <Select
            label="Day of week"
            options={DAY_LABELS.map((d, i) => ({ value: String(i), label: d }))}
            {...register("day_of_week", { required: true })}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Start time" type="time" error={errors.start_time?.message} {...register("start_time", { required: "Required" })} />
            <Input label="End time" type="time" error={errors.end_time?.message} {...register("end_time", { required: "Required" })} />
          </div>
          <Input label="Venue (optional)" {...register("venue")} />
          <Button type="submit" className="w-full" isLoading={saveMutation.isPending}>
            Save slot
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!removing}
        title="Remove schedule slot"
        message="Remove this schedule slot?"
        confirmLabel="Remove"
        isLoading={deleteMutation.isPending}
        onConfirm={() => removing && deleteMutation.mutate(removing.id)}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
function AchievementsCard({ staffId, schoolId }: { staffId: string; schoolId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [achievedOn, setAchievedOn] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<ExtracurricularAchievement | null>(null);

  const achievementsQuery = useQuery({
    queryKey: ["admin", "extracurricular-staff", staffId, "achievements"],
    queryFn: () => staffService.fetchStaffAchievements(staffId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "extracurricular-staff", staffId, "achievements"] });
  }

  const deleteMutation = useMutation({
    mutationFn: (achievementId: string) => staffService.deleteStaffAchievement(staffId, achievementId),
    onSuccess: () => {
      invalidate();
      toast.success("Achievement deleted.");
      setRemoving(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to delete achievement.")),
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setAchievedOn("");
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !title.trim()) {
      setUploadError("Provide a title and select a file.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      await staffService.uploadStaffAchievement(staffId, schoolId, file, {
        title,
        description: description || undefined,
        achieved_on: achievedOn || undefined,
      });
      invalidate();
      toast.success("Achievement uploaded.");
      resetForm();
      setModalOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload achievement");
    } finally {
      setUploading(false);
    }
  }

  const achievements = achievementsQuery.data ?? [];

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Achievements</h2>
        <Button
          variant="secondary"
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
        >
          <Plus size={14} className="mr-1" />
          Upload achievement
        </Button>
      </div>

      {achievements.length === 0 ? (
        <EmptyState title="No achievements uploaded yet." icon={Trophy} />
      ) : (
        <div className="space-y-3">
          {achievements.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Award size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</p>
                  {a.description && <p className="text-sm text-slate-600 dark:text-slate-300">{a.description}</p>}
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {a.achieved_on ? `Achieved on ${a.achieved_on}` : `Uploaded ${new Date(a.uploaded_at).toLocaleDateString()}`}
                  </p>
                  {a.signed_url && (
                    <a href={a.signed_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                      View file ({a.file_name})
                    </a>
                  )}
                </div>
              </div>
              <Button variant="ghost" className="!p-1.5 text-red-600" title="Delete" onClick={() => setRemoving(a)}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Upload achievement">
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Description (optional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <DatePicker label="Achieved on (optional)" value={achievedOn} onChange={setAchievedOn} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">File</label>
            <input ref={fileInputRef} type="file" className="text-sm" />
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          <Button className="w-full" onClick={handleUpload} isLoading={isUploading}>
            Upload
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!removing}
        title="Delete achievement"
        message={`Delete "${removing?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => removing && deleteMutation.mutate(removing.id)}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  );
}
