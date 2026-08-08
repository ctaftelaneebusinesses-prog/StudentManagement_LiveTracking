import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import * as teachersService from "@/services/admin/teachers.service";
import * as classesService from "@/services/admin/classes.service";
import * as teacherDocumentsService from "@/services/admin/teacherDocuments.service";
import * as leaveRequestsService from "@/services/admin/leaveRequests.service";
import { LeaveRequest, Teacher, TeacherAssignment, TeacherDocumentType } from "@/types/admin.types";
import { getApiErrorMessage } from "@/lib/axios";
import { resolveClassId } from "@/utils/classPicker";
import { digitsOnly, PHONE_PATTERN } from "@/utils/formHelpers";
import { ClassSectionSelects, ClassSectionValue } from "./components/ClassSectionSelects";
import { AttendanceReportCard } from "./components/AttendanceReportCard";

const DOC_TYPE_OPTIONS: { value: TeacherDocumentType; label: string }[] = [
  { value: "resume", label: "Resume / CV" },
  { value: "id_proof", label: "ID proof" },
  { value: "degree_certificate", label: "Degree certificate" },
  { value: "experience_letter", label: "Experience letter" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
];

const EMPTY_CLASS_SECTION: ClassSectionValue = { academicYearId: "", className: "", section: "" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-200 py-8 text-center dark:border-white/10">
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

export function TeacherProfilePage() {
  const { id } = useParams<{ id: string }>();
  const teacherId = id!;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const teacherQuery = useQuery({
    queryKey: ["admin", "teachers", teacherId],
    queryFn: () => teachersService.fetchTeacher(teacherId),
  });

  function invalidateTeacher() {
    queryClient.invalidateQueries({ queryKey: ["admin", "teachers", teacherId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
  }

  if (teacherQuery.isLoading) return <Spinner label="Loading teacher profile..." />;
  if (!teacherQuery.data) return <p className="text-sm text-slate-500 dark:text-slate-400">Teacher not found.</p>;

  const teacher = teacherQuery.data;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/dashboard/admin/teachers" className="text-sm text-brand-600 hover:underline">
          ← Back to teachers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--ink-primary)]">{teacher.users.full_name}</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Employee ID: {teacher.employee_id}
          {!teacher.users.is_active && <span className="ml-2 text-red-600">(Deactivated)</span>}
        </p>
      </div>

      <PersonalDetailsCard teacher={teacher} onSaved={invalidateTeacher} />
      <ClassTeacherCard teacher={teacher} onChanged={invalidateTeacher} />
      <AssignSubjectsCard teacherId={teacherId} />
      <AttendanceReportCard teacherId={teacherId} teacherName={teacher.users.full_name} />
      <LeaveRequestsCard teacherId={teacherId} />
      <DocumentsCard teacherId={teacherId} schoolId={user?.school_id ?? ""} />
    </div>
  );
}

// ----------------------------------------------------------------------------
function TeacherPhotoUpload({ teacher, onUploaded }: { teacher: Teacher; onUploaded: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const toast = useToast();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => teachersService.uploadTeacherPhoto(teacher.id, file),
    onSuccess: () => {
      onUploaded();
      toast.success("Photo updated");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to upload photo"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => teachersService.deleteTeacherPhoto(teacher.id),
    onSuccess: () => {
      onUploaded();
      setConfirmingDelete(false);
      toast.success("Photo removed");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo");
      setConfirmingDelete(false);
    },
  });

  return (
    <div className="flex items-center gap-4">
      {teacher.users.avatar_url ? (
        <img
          src={teacher.users.avatar_url}
          alt={teacher.users.full_name}
          className="h-14 w-14 rounded-full object-cover ring-2 ring-white dark:ring-white/10"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {getInitials(teacher.users.full_name)}
        </div>
      )}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
          }}
        />
        <div className="flex gap-1">
          <Button
            variant="ghost"
            className="!px-2 !py-1 text-xs"
            isLoading={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            Change photo
          </Button>
          {teacher.users.avatar_url && (
            <Button
              variant="ghost"
              className="!px-2 !py-1 text-xs text-red-600"
              onClick={() => setConfirmingDelete(true)}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmingDelete}
        title="Remove photo"
        message="Remove this teacher's profile photo?"
        confirmLabel="Remove"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

function PersonalDetailsCard({ teacher, onSaved }: { teacher: Teacher; onSaved: () => void }) {
  const toast = useToast();
  const [isEditing, setEditing] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      full_name: teacher.users.full_name,
      phone: teacher.users.phone ?? "",
      qualification: teacher.qualification ?? "",
      experience_years: teacher.experience_years != null ? String(teacher.experience_years) : "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: { full_name: string; phone: string; qualification: string; experience_years: string }) =>
      teachersService.updateTeacher(teacher.id, {
        full_name: values.full_name,
        phone: values.phone || undefined,
        qualification: values.qualification || undefined,
        experience_years: values.experience_years ? Number(values.experience_years) : undefined,
      }),
    onSuccess: () => {
      onSaved();
      toast.success("Personal details updated.");
      setEditing(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update teacher.")),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => teachersService.deactivateTeacher(teacher.id),
    onSuccess: () => {
      onSaved();
      toast.success("Teacher deactivated.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to deactivate teacher.")),
  });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <TeacherPhotoUpload teacher={teacher} onUploaded={onSaved} />
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Personal &amp; professional details</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Employee ID {teacher.employee_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {teacher.users.is_active && (
            <Button variant="danger" onClick={() => deactivateMutation.mutate()} isLoading={deactivateMutation.isPending}>
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        >
          <Input label="Full name" {...register("full_name", { required: true })} />
          <Input
            label="Phone"
            inputMode="numeric"
            error={errors.phone?.message}
            {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
          />
          <Input label="Qualification" {...register("qualification")} />
          <Input label="Experience (years)" type="number" min={0} max={80} {...register("experience_years")} />
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
          <Field label="Email" value={teacher.users.email} />
          <Field label="Phone" value={teacher.users.phone ?? "—"} />
          <Field label="Qualification" value={teacher.qualification ?? "—"} />
          <Field label="Experience" value={teacher.experience_years != null ? `${teacher.experience_years} years` : "—"} />
          <Field label="Joining date" value={teacher.joining_date ?? "—"} />
        </dl>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
function ClassTeacherCard({ teacher, onChanged }: { teacher: Teacher; onChanged: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });

  const [isPickerOpen, setPickerOpen] = useState(false);
  const [picker, setPicker] = useState<ClassSectionValue>(EMPTY_CLASS_SECTION);
  const [conflict, setConflict] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!isPickerOpen) return;
    setConflict(null);
    setPicker(
      teacher.homeroom
        ? {
            academicYearId: teacher.homeroom.academic_year_id,
            className: teacher.homeroom.name,
            section: teacher.homeroom.section,
          }
        : EMPTY_CLASS_SECTION
    );
  }, [isPickerOpen, teacher.homeroom]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
    onChanged();
  }

  const assignMutation = useMutation({
    mutationFn: ({ classId, force }: { classId: string; force: boolean }) =>
      teachersService.setHomeroomTeacher(teacher.id, classId, force),
    onSuccess: () => {
      invalidate();
      toast.success("Class teacher assignment saved.");
      setPickerOpen(false);
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 409) {
        setConflict(getApiErrorMessage(err, "This class already has a class teacher."));
      } else {
        toast.error(getApiErrorMessage(err, "Failed to assign class teacher."));
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => teachersService.clearHomeroomTeacher(teacher.id),
    onSuccess: () => {
      invalidate();
      toast.success("Class teacher assignment removed.");
      setConfirmRemove(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to remove assignment.")),
  });

  const resolvedClassId = resolveClassId(classes, picker.academicYearId, picker.className, picker.section);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Class teacher assignment</h2>
        {!teacher.homeroom && (
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            Assign
          </Button>
        )}
      </div>

      {teacher.homeroom ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-400">
              <GraduationCap size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Class teacher of</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {teacher.homeroom.name} - {teacher.homeroom.section}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{teacher.homeroom.academic_years?.name ?? "—"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPickerOpen(true)}>
              Change
            </Button>
            <Button variant="danger" onClick={() => setConfirmRemove(true)}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState message="Not currently a class teacher for any class." />
      )}

      <Modal
        isOpen={isPickerOpen}
        onClose={() => setPickerOpen(false)}
        title={teacher.homeroom ? "Change class teacher assignment" : "Assign as class teacher"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ClassSectionSelects classes={classes} value={picker} onChange={setPicker} />
          </div>
          {conflict && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-300">
              <p>{conflict}</p>
              <button
                type="button"
                className="mt-1 font-semibold underline"
                onClick={() => resolvedClassId && assignMutation.mutate({ classId: resolvedClassId, force: true })}
              >
                Reassign anyway
              </button>
            </div>
          )}
          <Button
            className="w-full"
            disabled={!resolvedClassId}
            isLoading={assignMutation.isPending}
            onClick={() => resolvedClassId && assignMutation.mutate({ classId: resolvedClassId, force: false })}
          >
            Save
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmRemove}
        title="Remove class teacher assignment"
        message={`Remove ${teacher.users.full_name} as class teacher of ${teacher.homeroom?.name} - ${teacher.homeroom?.section}?`}
        confirmLabel="Remove"
        isLoading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate()}
        onCancel={() => setConfirmRemove(false)}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
function AssignSubjectsCard({ teacherId }: { teacherId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const { data: subjects = [] } = useQuery({ queryKey: ["admin", "subjects"], queryFn: classesService.fetchSubjects });
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["admin", "teachers", teacherId, "assignments"],
    queryFn: () => teachersService.fetchTeacherAssignments(teacherId),
  });

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TeacherAssignment | null>(null);
  const [picker, setPicker] = useState<ClassSectionValue>(EMPTY_CLASS_SECTION);
  const [subjectId, setSubjectId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeacherAssignment | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "teachers", teacherId, "assignments"] });
  }

  function openAddModal() {
    setEditingAssignment(null);
    setPicker(EMPTY_CLASS_SECTION);
    setSubjectId("");
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(assignment: TeacherAssignment) {
    setEditingAssignment(assignment);
    setPicker({
      academicYearId: classes.find((c) => c.id === assignment.class_id)?.academic_year_id ?? "",
      className: assignment.classes.name,
      section: assignment.classes.section,
    });
    setSubjectId(assignment.subject_id);
    setFormError(null);
    setModalOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async ({ classId, subjectId: newSubjectId }: { classId: string; subjectId: string }) => {
      if (editingAssignment && (editingAssignment.class_id !== classId || editingAssignment.subject_id !== newSubjectId)) {
        await classesService.removeSubjectFromClass(editingAssignment.class_id, editingAssignment.subject_id);
      }
      return teachersService.bulkAssignSubjects(teacherId, [{ class_id: classId, subject_id: newSubjectId }]);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editingAssignment ? "Subject assignment updated." : "Subject assignment added.");
      setModalOpen(false);
    },
    onError: (err) => setFormError(getApiErrorMessage(err, "Failed to save subject assignment.")),
  });

  const removeMutation = useMutation({
    mutationFn: ({ classId, subjectId: id }: { classId: string; subjectId: string }) =>
      classesService.removeSubjectFromClass(classId, id),
    onSuccess: () => {
      invalidate();
      toast.success("Subject assignment removed.");
      setRemoving(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to remove assignment.")),
  });

  function handleSave() {
    setFormError(null);
    const classId = resolveClassId(classes, picker.academicYearId, picker.className, picker.section);
    if (!classId || !subjectId) {
      setFormError("Select an academic year, class, section, and subject.");
      return;
    }
    const duplicate = assignments.some(
      (a) => a.class_id === classId && a.subject_id === subjectId && a.id !== editingAssignment?.id
    );
    if (duplicate) {
      setFormError("This teacher is already assigned to this class + subject.");
      return;
    }
    saveMutation.mutate({ classId, subjectId });
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Subjects Assigned</h2>
        <Button variant="secondary" onClick={openAddModal}>
          <Plus size={14} className="mr-1" />
          Add assignment
        </Button>
      </div>

      <DataTable
        isLoading={isLoading}
        rows={assignments}
        rowKey={(a) => a.id}
        emptyMessage="No subjects assigned yet."
        columns={[
          { header: "Academic Year", cell: (a) => a.classes.academic_years?.name ?? "—" },
          { header: "Class", cell: (a) => a.classes.name },
          { header: "Section", cell: (a) => a.classes.section },
          { header: "Subject", cell: (a) => `${a.subjects.name} (${a.subjects.code})` },
          {
            header: "",
            cell: (a) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => openEditModal(a)}>
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  className="!p-1.5 text-red-600"
                  title="Remove"
                  onClick={() => setRemoving(a)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ),
            className: "text-right",
          },
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingAssignment ? "Edit subject assignment" : "Add subject assignment"}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ClassSectionSelects classes={classes} value={picker} onChange={setPicker} />
          </div>
          <SearchableSelect
            label="Subject"
            placeholder="Select subject"
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            value={subjectId}
            onChange={setSubjectId}
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button className="w-full" onClick={handleSave} isLoading={saveMutation.isPending}>
            {editingAssignment ? "Save changes" : "Add assignment"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!removing}
        title="Remove subject assignment"
        message={
          removing
            ? `Remove ${removing.subjects.name} for ${removing.classes.name} - ${removing.classes.section}?`
            : ""
        }
        confirmLabel="Remove"
        isLoading={removeMutation.isPending}
        onConfirm={() => removing && removeMutation.mutate({ classId: removing.class_id, subjectId: removing.subject_id })}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------------
function LeaveRequestsCard({ teacherId }: { teacherId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isLogOpen, setLogOpen] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin", "teachers", teacherId, "leave-requests"],
    queryFn: () => leaveRequestsService.fetchLeaveRequestsForTeacher(teacherId),
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { start_date: todayIso(), end_date: todayIso(), reason: "" },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "teachers", teacherId, "leave-requests"] });
  }

  const createMutation = useMutation({
    mutationFn: (values: { start_date: string; end_date: string; reason: string }) =>
      leaveRequestsService.createLeaveRequest({
        teacher_id: teacherId,
        start_date: values.start_date,
        end_date: values.end_date,
        reason: values.reason || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Leave request logged.");
      reset();
      setLogOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to log leave request.")),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      leaveRequestsService.reviewLeaveRequest(id, status),
    onSuccess: (_, variables) => {
      invalidate();
      toast.success(`Leave request ${variables.status}.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update leave request.")),
  });

  const statusBadgeClass: Record<LeaveRequest["status"], string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    approved: "bg-emerald-500/10 text-[var(--delta-good)]",
    rejected: "bg-red-500/10 text-[var(--delta-bad)]",
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Leave requests</h2>
        <Button onClick={() => setLogOpen(true)}>Log leave</Button>
      </div>

      <DataTable
        isLoading={isLoading}
        rows={requests}
        rowKey={(r) => r.id}
        emptyMessage="No leave requests yet."
        columns={[
          { header: "From", cell: (r) => r.start_date },
          { header: "To", cell: (r) => r.end_date },
          { header: "Reason", cell: (r) => r.reason ?? "—" },
          {
            header: "Status",
            cell: (r) => (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[r.status]}`}>
                {r.status}
              </span>
            ),
          },
          {
            header: "",
            cell: (r) =>
              r.status === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 text-xs text-[var(--delta-good)]"
                    onClick={() => reviewMutation.mutate({ id: r.id, status: "approved" })}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 text-xs text-red-600"
                    onClick={() => reviewMutation.mutate({ id: r.id, status: "rejected" })}
                  >
                    Reject
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />

      <Modal isOpen={isLogOpen} onClose={() => setLogOpen(false)} title="Log leave request">
        <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <Input label="Start date" type="date" {...register("start_date", { required: true })} />
          <Input label="End date" type="date" {...register("end_date", { required: true })} />
          <Input label="Reason (optional)" {...register("reason")} />
          {createMutation.isError && <p className="text-sm text-red-600">Failed to log leave request.</p>}
          <Button type="submit" className="w-full" isLoading={createMutation.isPending}>
            Log leave (pending review)
          </Button>
        </form>
      </Modal>
    </Card>
  );
}

// ----------------------------------------------------------------------------
function DocumentsCard({ teacherId, schoolId }: { teacherId: string; schoolId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<TeacherDocumentType>("other");
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);

  const documentsQuery = useQuery({
    queryKey: ["admin", "teachers", teacherId, "documents"],
    queryFn: () => teacherDocumentsService.fetchDocuments(teacherId),
  });
  const documents = documentsQuery.data ?? [];
  const [deletingDoc, setDeletingDoc] = useState<(typeof documents)[number] | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "teachers", teacherId, "documents"] });
  }

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => teacherDocumentsService.deleteDocument(teacherId, documentId),
    onSuccess: () => {
      invalidate();
      toast.success("Document deleted.");
      setDeletingDoc(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to delete document.")),
  });

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await teacherDocumentsService.uploadDocument(schoolId, teacherId, file, docType, notes || undefined);
      invalidate();
      toast.success("Document uploaded.");
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Documents</h2>

      <DataTable
        isLoading={documentsQuery.isLoading}
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

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
        <Select
          label="Document type"
          options={DOC_TYPE_OPTIONS}
          value={docType}
          onChange={(e) => setDocType(e.target.value as TeacherDocumentType)}
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
