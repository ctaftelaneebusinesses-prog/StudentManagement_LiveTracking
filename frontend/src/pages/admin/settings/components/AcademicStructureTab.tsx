import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, GraduationCap, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SettingsCard } from "./SettingsCard";
import { AcademicYearFormModal } from "@/pages/admin/classes/components/AcademicYearFormModal";
import * as schoolService from "@/services/admin/school.service";
import * as classesService from "@/services/admin/classes.service";
import * as teachersService from "@/services/admin/teachers.service";
import { AcademicYear, Branch, Department } from "@/types/admin.types";

function AcademicYearsSection() {
  const { data: years = [], isLoading } = useQuery({ queryKey: ["admin", "academic-years"], queryFn: schoolService.fetchAcademicYears });
  const [modal, setModal] = useState<"add" | AcademicYear | null>(null);

  return (
    <SettingsCard
      title="Academic Years"
      subtitle={`${years.length} year${years.length === 1 ? "" : "s"}`}
      action={
        <Button onClick={() => setModal("add")}>
          <Plus size={16} strokeWidth={2} /> Add year
        </Button>
      }
    >
      <DataTable<AcademicYear>
        isLoading={isLoading}
        rows={years}
        rowKey={(y) => y.id}
        emptyMessage="No academic years yet."
        columns={[
          { header: "Academic Year", cell: (y) => y.name },
          { header: "Start", cell: (y) => y.start_date },
          { header: "End", cell: (y) => y.end_date },
          {
            header: "Status",
            cell: (y) =>
              y.is_current ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-[var(--status-good)]">Active</span>
              ) : (
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-[var(--ink-muted)] dark:bg-white/10">Inactive</span>
              ),
          },
          {
            header: "",
            cell: (y) => (
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setModal(y)}>
                Edit
              </Button>
            ),
          },
        ]}
      />

      {modal && <AcademicYearFormModal mode={modal} onClose={() => setModal(null)} />}
    </SettingsCard>
  );
}

function BranchesSection() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<"add" | Branch | null>(null);
  const { data: branches = [], isLoading } = useQuery({ queryKey: ["admin", "branches"], queryFn: schoolService.fetchBranches });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({ defaultValues: { name: "", address: "" } });
  const editing = modal !== "add" ? modal : null;

  const createMutation = useMutation({
    mutationFn: schoolService.createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "branches"] });
      reset();
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<Branch> }) => schoolService.updateBranch(vars.id, vars.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "branches"] });
      setModal(null);
    },
  });

  return (
    <SettingsCard
      title="Branches"
      subtitle={`${branches.length} branch${branches.length === 1 ? "" : "es"}`}
      action={
        <Button onClick={() => setModal("add")}>
          <Plus size={16} strokeWidth={2} /> Add branch
        </Button>
      }
    >
      <DataTable<Branch>
        isLoading={isLoading}
        rows={branches}
        rowKey={(b) => b.id}
        emptyMessage="No branches yet."
        columns={[
          { header: "Name", cell: (b) => b.name },
          { header: "Address", cell: (b) => b.address ?? "—" },
          { header: "Main", cell: (b) => (b.is_main ? "Yes" : "No") },
          {
            header: "Status",
            cell: (b) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.is_active ? "bg-emerald-500/10 text-[var(--status-good)]" : "bg-black/5 text-[var(--ink-muted)] dark:bg-white/10"}`}>
                {b.is_active ? "Active" : "Inactive"}
              </span>
            ),
          },
          {
            header: "",
            cell: (b) => (
              <div className="flex gap-2">
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setModal(b)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 text-xs"
                  isLoading={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ id: b.id, patch: { is_active: !b.is_active } })}
                >
                  {b.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal isOpen={modal === "add"} onClose={() => setModal(null)} title="Add branch">
        <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <Input label="Branch name" {...register("name", { required: true })} />
          <Input label="Address" {...register("address")} />
          {createMutation.isError && <p className="text-sm text-[var(--delta-bad)]">Failed to create branch.</p>}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create
          </Button>
        </form>
      </Modal>

      {editing && (
        <EditBranchModal
          branch={editing}
          onClose={() => setModal(null)}
          onSave={(patch) => updateMutation.mutate({ id: editing.id, patch })}
          isSaving={updateMutation.isPending}
        />
      )}
    </SettingsCard>
  );
}

function EditBranchModal({
  branch,
  onClose,
  onSave,
  isSaving,
}: {
  branch: Branch;
  onClose: () => void;
  onSave: (patch: Partial<Branch>) => void;
  isSaving: boolean;
}) {
  const { register, handleSubmit } = useForm({ defaultValues: { name: branch.name, address: branch.address ?? "" } });
  return (
    <Modal isOpen onClose={onClose} title="Edit branch">
      <form className="space-y-4" onSubmit={handleSubmit((values) => onSave(values))}>
        <Input label="Branch name" {...register("name", { required: true })} />
        <Input label="Address" {...register("address")} />
        <Button type="submit" className="w-full" isLoading={isSaving}>
          Save changes
        </Button>
      </form>
    </Modal>
  );
}

function DepartmentsSection() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<"add" | Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const { data: departments = [], isLoading } = useQuery({ queryKey: ["admin", "departments"], queryFn: schoolService.fetchDepartments });
  const { data: teachersResult } = useQuery({ queryKey: ["admin", "teachers", "all"], queryFn: () => teachersService.fetchTeachers({ pageSize: 200 }) });
  const teacherOptions = (teachersResult?.items ?? []).map((t) => ({ value: t.id, label: t.users.full_name }));

  const editing = modal !== "add" ? modal : null;

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { name: "", description: "", head_teacher_id: "" },
  });

  const createMutation = useMutation({
    mutationFn: schoolService.createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      reset();
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<Department> }) => schoolService.updateDepartment(vars.id, vars.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      setModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: schoolService.deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      setDeleteTarget(null);
    },
  });

  return (
    <SettingsCard
      title="Departments"
      subtitle={`${departments.length} department${departments.length === 1 ? "" : "s"}`}
      action={
        <Button onClick={() => setModal("add")}>
          <Plus size={16} strokeWidth={2} /> Add department
        </Button>
      }
    >
      <DataTable<Department>
        isLoading={isLoading}
        rows={departments}
        rowKey={(d) => d.id}
        emptyMessage="No departments yet."
        columns={[
          { header: "Name", cell: (d) => d.name },
          { header: "Description", cell: (d) => d.description ?? "—" },
          { header: "Head Teacher", cell: (d) => d.teachers?.users.full_name ?? "—" },
          {
            header: "",
            cell: (d) => (
              <div className="flex gap-2">
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setModal(d)}>
                  Edit
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs text-[var(--delta-bad)]" onClick={() => setDeleteTarget(d)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal isOpen={modal === "add"} onClose={() => setModal(null)} title="Add department">
        <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate({ ...values, head_teacher_id: values.head_teacher_id || undefined }))}>
          <Input label="Department name" {...register("name", { required: true })} />
          <Input label="Description" {...register("description")} />
          <Select label="Head teacher" placeholder="None" options={teacherOptions} {...register("head_teacher_id")} />
          {createMutation.isError && <p className="text-sm text-[var(--delta-bad)]">Failed to create department.</p>}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create
          </Button>
        </form>
      </Modal>

      {editing && (
        <EditDepartmentModal
          department={editing}
          teacherOptions={teacherOptions}
          onClose={() => setModal(null)}
          onSave={(patch) => updateMutation.mutate({ id: editing.id, patch })}
          isSaving={updateMutation.isPending}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete department"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </SettingsCard>
  );
}

function EditDepartmentModal({
  department,
  teacherOptions,
  onClose,
  onSave,
  isSaving,
}: {
  department: Department;
  teacherOptions: { value: string; label: string }[];
  onClose: () => void;
  onSave: (patch: Partial<Department>) => void;
  isSaving: boolean;
}) {
  const { register, handleSubmit } = useForm({
    defaultValues: { name: department.name, description: department.description ?? "", head_teacher_id: department.head_teacher_id ?? "" },
  });
  return (
    <Modal isOpen onClose={onClose} title="Edit department">
      <form className="space-y-4" onSubmit={handleSubmit((values) => onSave({ ...values, head_teacher_id: values.head_teacher_id || null }))}>
        <Input label="Department name" {...register("name", { required: true })} />
        <Input label="Description" {...register("description")} />
        <Select label="Head teacher" placeholder="None" options={teacherOptions} {...register("head_teacher_id")} />
        <Button type="submit" className="w-full" isLoading={isSaving}>
          Save changes
        </Button>
      </form>
    </Modal>
  );
}

function StructureSummaryCards() {
  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const { data: subjects = [] } = useQuery({ queryKey: ["admin", "subjects"], queryFn: classesService.fetchSubjects });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Link
        to="/dashboard/admin/classes"
        className="group flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.08] dark:bg-[#17171a]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-900/40 dark:text-accent-300">
            <BookOpen size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--ink-primary)]">Classes</p>
            <p className="text-xs text-[var(--ink-muted)]">{classes.length} classes — manage in Classes & Sections →</p>
          </div>
        </div>
      </Link>
      <Link
        to="/dashboard/admin/classes"
        className="group flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.08] dark:bg-[#17171a]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-900/40 dark:text-accent-300">
            <GraduationCap size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--ink-primary)]">Subjects</p>
            <p className="text-xs text-[var(--ink-muted)]">{subjects.length} subjects — manage in Classes & Sections →</p>
          </div>
        </div>
      </Link>
    </div>
  );
}

export function AcademicStructureTab() {
  return (
    <div className="animate-fade-in space-y-6">
      <StructureSummaryCards />
      <AcademicYearsSection />
      <BranchesSection />
      <DepartmentsSection />
    </div>
  );
}
