import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { AcademicYearFormModal } from "@/pages/admin/classes/components/AcademicYearFormModal";
import { getApiErrorMessage } from "@/lib/axios";
import * as classesService from "@/services/admin/classes.service";
import * as schoolService from "@/services/admin/school.service";
import * as teachersService from "@/services/admin/teachers.service";
import { AcademicYear, ClassRoom } from "@/types/admin.types";
import { ExportColumn } from "@/utils/export";

interface ClassFormValues {
  name: string;
  section: string;
  academic_year_id: string;
  class_teacher_id: string;
  capacity: string;
  status: "active" | "inactive";
}

function SummaryPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 rounded-2xl border border-black/[0.06] bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
      <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--ink-primary)]">{value}</p>
    </div>
  );
}

function ClassesSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [classPendingDelete, setClassPendingDelete] = useState<ClassRoom | null>(null);
  const [isAddYearOpen, setAddYearOpen] = useState(false);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });
  const { data: academicYears = [] } = useQuery({
    queryKey: ["admin", "academic-years"],
    queryFn: schoolService.fetchAcademicYears,
  });
  const { data: teacherList } = useQuery({
    queryKey: ["admin", "teachers", "all"],
    queryFn: () => teachersService.fetchTeachers({ pageSize: 1000 }),
  });

  const teacherOptions = (teacherList?.items ?? []).map((t) => ({ value: t.id, label: t.users.full_name }));
  const distinctClassNames = useMemo(() => Array.from(new Set(classes.map((c) => c.name))), [classes]);
  const totalStudents = useMemo(() => classes.reduce((sum, c) => sum + (c.student_count ?? 0), 0), [classes]);

  // Decorate rows so the table can render a merged-cell look for sections sharing a class name.
  const decoratedRows = useMemo(
    () => classes.map((c, i) => ({ ...c, isGroupStart: i === 0 || classes[i - 1].name !== c.name })),
    [classes]
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    defaultValues: {
      name: "",
      section: "",
      academic_year_id: "",
      class_teacher_id: "",
      capacity: "",
      status: "active",
    },
  });

  function openAddModal() {
    setEditingClass(null);
    reset({
      name: "",
      section: "",
      academic_year_id: "",
      class_teacher_id: "",
      capacity: "",
      status: "active",
    });
    setModalMode("add");
  }

  function openEditModal(klass: ClassRoom) {
    setEditingClass(klass);
    reset({
      name: klass.name,
      section: klass.section,
      academic_year_id: klass.academic_year_id,
      class_teacher_id: klass.class_teacher_id ?? "",
      capacity: klass.capacity ? String(klass.capacity) : "",
      status: klass.status,
    });
    setModalMode("edit");
  }

  const createMutation = useMutation({
    mutationFn: (values: ClassFormValues) =>
      classesService.createClass({
        name: values.name,
        section: values.section,
        academic_year_id: values.academic_year_id,
        class_teacher_id: values.class_teacher_id || undefined,
        capacity: values.capacity ? Number(values.capacity) : undefined,
        status: values.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      setModalMode(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: ClassFormValues) =>
      classesService.updateClass(editingClass!.id, {
        name: values.name,
        section: values.section,
        class_teacher_id: values.class_teacher_id || null,
        capacity: values.capacity ? Number(values.capacity) : null,
        status: values.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      setModalMode(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: classesService.deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      setClassPendingDelete(null);
    },
  });

  const exportColumns: ExportColumn<ClassRoom>[] = [
    { header: "Class", accessor: (c) => c.name },
    { header: "Section", accessor: (c) => c.section },
    { header: "Academic Year", accessor: (c) => c.academic_years?.name ?? "" },
    { header: "Class Teacher", accessor: (c) => c.class_teacher?.full_name ?? "Unassigned" },
    { header: "Capacity", accessor: (c) => c.capacity ?? "" },
    { header: "Status", accessor: (c) => c.status },
    { header: "Students", accessor: (c) => c.student_count ?? 0 },
  ];

  const activeMutation = modalMode === "edit" ? updateMutation : createMutation;

  function onSubmit(values: ClassFormValues) {
    if (modalMode === "edit") updateMutation.mutate(values);
    else createMutation.mutate(values);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryPill label="Classes" value={distinctClassNames.length} />
        <SummaryPill label="Sections" value={classes.length} />
        <SummaryPill label="Students enrolled" value={totalStudents} />
      </div>

      <ChartCard
        title="Classes & Sections"
        subtitle={`${classes.length} section${classes.length === 1 ? "" : "s"} across ${distinctClassNames.length} class${
          distinctClassNames.length === 1 ? "" : "es"
        }`}
        legend={
          <div className="flex flex-wrap gap-2">
            <ExportButtons title="Classes" columns={exportColumns} rows={classes} filename="classes" />
            <Button onClick={openAddModal} className="!px-3 !py-1.5 text-xs">
              <Plus size={14} className="mr-1" />
              Add class / section
            </Button>
          </div>
        }
      >
        <datalist id="existing-class-names">
          {distinctClassNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <DataTable
          isLoading={isLoading}
          rows={decoratedRows}
          rowKey={(c) => c.id}
          emptyMessage="No classes yet. Add your first class to get started."
          columns={[
            {
              header: "Class",
              cell: (c) =>
                c.isGroupStart ? (
                  <span className="font-semibold text-[var(--ink-primary)]">{c.name}</span>
                ) : (
                  <span className="text-[var(--ink-muted)]">↳</span>
                ),
            },
            {
              header: "Section",
              cell: (c) => (
                <span className="inline-flex items-center rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                  {c.section}
                </span>
              ),
            },
            { header: "Academic Year", cell: (c) => c.academic_years?.name ?? "—" },
            {
              header: "Class Teacher",
              cell: (c) =>
                c.class_teacher?.full_name ?? <span className="text-[var(--ink-muted)]">Unassigned</span>,
            },
            { header: "Students", cell: (c) => <span className="font-medium">{c.student_count ?? 0}</span> },
            {
              header: "Status",
              cell: (c) => <Badge variant={c.status === "active" ? "success" : "neutral"}>{c.status === "active" ? "Active" : "Inactive"}</Badge>,
            },
            {
              header: "",
              cell: (c) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="!p-1.5"
                    title="View students & subjects"
                    onClick={() => navigate(`/dashboard/admin/classes/${c.id}`)}
                  >
                    <Eye size={15} />
                  </Button>
                  <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => openEditModal(c)}>
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="!p-1.5 text-red-600"
                    title="Delete"
                    onClick={() => setClassPendingDelete(c)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ),
              className: "text-right",
            },
          ]}
        />

        <Modal
          isOpen={modalMode !== null}
          onClose={() => setModalMode(null)}
          title={modalMode === "edit" ? "Edit class / section" : "Add class / section"}
        >
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Input
                label="Class name (e.g. Grade 8)"
                list="existing-class-names"
                error={errors.name?.message}
                {...register("name", { required: "Class name is required" })}
              />
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Pick an existing class name from the list to add a new section to it.
              </p>
            </div>
            <Input
              label="Section (e.g. A)"
              error={errors.section?.message}
              {...register("section", { required: "Section is required" })}
            />
            {modalMode === "edit" ? (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Academic year</p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {editingClass?.academic_years?.name ?? "—"} (can't be changed after creation)
                </p>
              </div>
            ) : (
              <div>
                <Select
                  label="Academic year"
                  placeholder="Select academic year"
                  options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
                  error={errors.academic_year_id?.message}
                  {...register("academic_year_id", { required: "Academic year is required" })}
                />
                <button
                  type="button"
                  onClick={() => setAddYearOpen(true)}
                  className="mt-1.5 text-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
                >
                  + Add academic year
                </button>
              </div>
            )}
            <Select
              label="Class teacher (optional)"
              placeholder="Unassigned"
              options={teacherOptions}
              {...register("class_teacher_id")}
            />
            <Input
              label="Capacity (optional)"
              type="number"
              min={1}
              placeholder="e.g. 40"
              {...register("capacity")}
            />
            <Select
              label="Status"
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              {...register("status")}
            />
            {activeMutation.isError && (
              <p className="text-sm text-red-600">
                {getApiErrorMessage(
                  activeMutation.error,
                  modalMode === "edit" ? "Failed to update class." : "Failed to create class."
                )}
              </p>
            )}
            <Button type="submit" className="w-full" isLoading={isSubmitting || activeMutation.isPending}>
              {modalMode === "edit" ? "Save changes" : "Create"}
            </Button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!classPendingDelete}
          title="Delete class / section"
          message={`Delete "${classPendingDelete?.name} - ${classPendingDelete?.section}"? Students in this section will become unassigned.`}
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
          onConfirm={() => classPendingDelete && deleteMutation.mutate(classPendingDelete.id)}
          onCancel={() => setClassPendingDelete(null)}
        />

        {isAddYearOpen && (
          <AcademicYearFormModal
            mode="add"
            onClose={() => setAddYearOpen(false)}
            onSaved={(year: AcademicYear) => setValue("academic_year_id", year.id, { shouldValidate: true })}
          />
        )}
      </ChartCard>
    </div>
  );
}

export function ClassesPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Classes &amp; Sections</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Manage classes, sections, and class teachers for your school. Open a class to manage its subjects.
        </p>
      </div>
      <ClassesSection />
    </div>
  );
}
