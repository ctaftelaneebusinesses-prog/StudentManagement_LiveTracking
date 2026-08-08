import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, ArrowUpDown, UserPlus, Pencil, Camera } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import * as portalService from "@/services/teacher/portal.service";
import * as studentsService from "@/services/admin/students.service";
import { getApiErrorMessage } from "@/lib/axios";
import { TeacherStudentListItem } from "@/types/teacher.types";

const PAGE_SIZE = 15;
type SortKey = "name" | "roll_no" | "attendance";

const FEE_STATUS_STYLES: Record<string, string> = {
  paid: "bg-[var(--status-good)]/10 text-[var(--status-good)]",
  partial: "bg-[var(--status-warning)]/10 text-[var(--status-warning)]",
  unpaid: "bg-[var(--status-serious)]/10 text-[var(--status-serious)]",
};

interface StudentFormValues {
  full_name: string;
  email: string;
  phone?: string;
  admission_no: string;
  roll_no?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other";
}

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export function TeacherStudentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("roll_no");
  const [page, setPage] = useState(1);
  const [editingStudent, setEditingStudent] = useState<TeacherStudentListItem | "new" | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);

  const dashboardQuery = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: portalService.fetchDashboard });
  const classes = dashboardQuery.data?.classes ?? [];
  const selectedClass = classes.find((c) => c.id === classId);
  const isHomeroom = !!selectedClass?.isHomeroom;

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}${c.isHomeroom ? " (Homeroom)" : ""}` }));
  const subjectOptions = (selectedClass?.subjects ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));

  // A class-teacher can see the whole roster with just classId; a
  // subject-teacher must also pick which subject they teach in that class —
  // mirrors the ownership check the backend enforces (assertTeacherOwnsClass
  // vs assertTeacherOwnsClassSubject).
  const canQuery = !!classId && (isHomeroom || !!subjectId);

  const studentsQuery = useQuery({
    queryKey: ["teacher", "my-students", classId, isHomeroom ? undefined : subjectId],
    queryFn: () => portalService.fetchMyStudents({ classId, subjectId: isHomeroom ? undefined : subjectId }),
    enabled: canQuery,
  });

  function invalidateRoster() {
    queryClient.invalidateQueries({ queryKey: ["teacher", "my-students"] });
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>();

  const createMutation = useMutation({
    mutationFn: (values: StudentFormValues) => studentsService.createStudent({ ...values, class_id: classId }),
    onSuccess: () => {
      invalidateRoster();
      setEditingStudent(null);
      toast.success("Student added.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to add student.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<StudentFormValues> }) => studentsService.updateStudent(id, values),
    onSuccess: () => {
      invalidateRoster();
      setEditingStudent(null);
      toast.success("Student updated.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update student.")),
  });

  const photoMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => studentsService.uploadStudentPhoto(id, file),
    onSuccess: () => {
      invalidateRoster();
      toast.success("Photo updated.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to upload photo.")),
    onSettled: () => setPhotoBusyId(null),
  });

  function openAddStudent() {
    reset({ full_name: "", email: "", phone: "", admission_no: "", roll_no: "", date_of_birth: "", gender: undefined });
    setEditingStudent("new");
  }

  function openEditStudent(student: TeacherStudentListItem) {
    reset({
      full_name: student.users.full_name,
      email: student.users.email,
      phone: student.users.phone ?? "",
      admission_no: student.admission_no,
      roll_no: student.roll_no ?? "",
    });
    setEditingStudent(student);
  }

  function submitStudentForm(values: StudentFormValues) {
    if (editingStudent === "new") {
      createMutation.mutate(values);
    } else if (editingStudent) {
      const { email: _email, admission_no: _admissionNo, ...editable } = values;
      updateMutation.mutate({ id: editingStudent.id, values: editable });
    }
  }

  function triggerPhotoUpload(studentId: string) {
    setPhotoBusyId(studentId);
    photoInputRef.current?.click();
    photoInputRef.current?.setAttribute("data-student-id", studentId);
  }

  function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const studentId = photoInputRef.current?.getAttribute("data-student-id");
    if (file && studentId) {
      photoMutation.mutate({ id: studentId, file });
    } else {
      setPhotoBusyId(null);
    }
    event.target.value = "";
  }

  function handleClassChange(value: string) {
    setClassId(value);
    setSubjectId("");
    setPage(1);
  }

  const filtered = useMemo(() => {
    const rows = studentsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    const matched = q
      ? rows.filter((s) => s.users.full_name.toLowerCase().includes(q) || s.admission_no.toLowerCase().includes(q))
      : rows;

    return [...matched].sort((a, b) => {
      if (sortKey === "name") return a.users.full_name.localeCompare(b.users.full_name);
      if (sortKey === "attendance") return (b.attendancePercentage ?? -1) - (a.attendancePercentage ?? -1);
      return (a.roll_no ?? "").localeCompare(b.roll_no ?? "", undefined, { numeric: true });
    });
  }, [studentsQuery.data, search, sortKey]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function cycleSortBy(key: SortKey) {
    setSortKey(key);
    setPage(1);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Students</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            Browse your homeroom class in full, or select a class and subject you teach to see just those students.
          </p>
        </div>
        {canQuery && (
          <Button onClick={openAddStudent}>
            <UserPlus size={16} className="mr-1.5 inline" strokeWidth={1.75} />
            Add student
          </Button>
        )}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Select label="Class" placeholder="Select a class" options={classOptions} value={classId} onChange={(e) => handleClassChange(e.target.value)} />
          {classId && !isHomeroom && (
            <Select
              label="Subject"
              placeholder="Select a subject"
              options={subjectOptions}
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setPage(1);
              }}
            />
          )}
          {canQuery && (
            <Input
              label="Search"
              placeholder="Search by name or admission no."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          )}
        </div>

        {!classId ? (
          <EmptyState title="Select a class to get started" description="Choose one of your assigned classes above." />
        ) : !isHomeroom && !subjectId ? (
          <EmptyState title="Select a subject" description="Choose the subject you teach in this class to see its students." />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(["roll_no", "name", "attendance"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => cycleSortBy(key)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    sortKey === key
                      ? "bg-accent-600 text-white"
                      : "bg-black/[0.04] text-[var(--ink-secondary)] hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                  }`}
                >
                  <ArrowUpDown size={12} />
                  Sort by {key === "roll_no" ? "roll no." : key}
                </button>
              ))}
            </div>

            <DataTable<TeacherStudentListItem>
              isLoading={studentsQuery.isLoading}
              rows={pageRows}
              rowKey={(s) => s.id}
              emptyMessage="No students found."
              columns={[
                {
                  header: "",
                  className: "w-10",
                  cell: (s) => (
                    <button
                      type="button"
                      title="Change photo"
                      onClick={() => triggerPhotoUpload(s.id)}
                      className="group relative block h-8 w-8 shrink-0 rounded-full"
                    >
                      <img
                        src={s.users.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(s.users.full_name)}`}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        {photoBusyId === s.id ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Camera size={13} className="text-white" strokeWidth={2} />
                        )}
                      </span>
                    </button>
                  ),
                },
                { header: "Roll No", cell: (s) => s.roll_no ?? "—" },
                {
                  header: "Name",
                  cell: (s) => <span className="font-medium text-[var(--ink-primary)]">{s.users.full_name}</span>,
                },
                {
                  header: "Attendance",
                  cell: (s) =>
                    s.attendancePercentage != null ? (
                      <span
                        className={
                          s.attendancePercentage >= 75
                            ? "font-medium text-[var(--status-good)]"
                            : "font-medium text-[var(--status-serious)]"
                        }
                      >
                        {s.attendancePercentage}%
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  header: "Fee Status",
                  cell: (s) =>
                    s.fee ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${FEE_STATUS_STYLES[s.fee.status] ?? ""}`}>
                        {s.fee.status}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  header: "Parent Contact",
                  cell: (s) => (
                    <div className="text-xs">
                      <p>{s.father_phone ?? s.mother_phone ?? "—"}</p>
                      <p className="text-[var(--ink-muted)]">{s.father_name ?? s.mother_name ?? ""}</p>
                    </div>
                  ),
                },
                {
                  header: "",
                  className: "text-right",
                  cell: (s) => (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="!p-1.5" title="Edit student" onClick={() => openEditStudent(s)}>
                        <Pencil size={15} strokeWidth={1.75} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="!p-1.5"
                        title="View profile"
                        onClick={() => navigate(`/dashboard/teacher/students/${s.id}`)}
                      >
                        <Eye size={15} strokeWidth={1.75} />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />

            {total > 0 && (
              <div className="flex items-center justify-between text-sm text-[var(--ink-muted)]">
                <p>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="self-center">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />

      <Modal
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={editingStudent === "new" ? "Add student" : "Edit student"}
      >
        <form className="space-y-4" onSubmit={handleSubmit(submitStudentForm)} noValidate>
          <Input label="Full name" error={errors.full_name?.message} {...register("full_name", { required: "Required" })} />
          {editingStudent === "new" && (
            <Input
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register("email", { required: "Required" })}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" {...register("phone")} />
            <Input label="Date of birth" type="date" {...register("date_of_birth")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {editingStudent === "new" && (
              <Input
                label="Admission no."
                error={errors.admission_no?.message}
                {...register("admission_no", { required: "Required" })}
              />
            )}
            <Input label="Roll no." {...register("roll_no")} />
          </div>
          {editingStudent === "new" && <Select label="Gender" options={GENDER_OPTIONS} {...register("gender")} />}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}>
            {editingStudent === "new" ? "Add student" : "Save changes"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
