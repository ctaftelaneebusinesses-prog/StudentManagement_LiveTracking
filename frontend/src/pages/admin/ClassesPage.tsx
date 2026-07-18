import { ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import * as classesService from "@/services/admin/classes.service";
import * as schoolService from "@/services/admin/school.service";
import { ClassRoom, Subject } from "@/types/admin.types";

function SubjectsSection() {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const [subjectPendingDelete, setSubjectPendingDelete] = useState<Subject | null>(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["admin", "subjects"],
    queryFn: classesService.fetchSubjects,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { name: "", code: "" },
  });

  const createMutation = useMutation({
    mutationFn: classesService.createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "subjects"] });
      reset();
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: classesService.deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "subjects"] });
      setSubjectPendingDelete(null);
    },
  });

  return (
    <Card title="Subjects" onAdd={() => setModalOpen(true)} addLabel="Add subject">
      <DataTable<Subject>
        isLoading={isLoading}
        rows={subjects}
        rowKey={(s) => s.id}
        emptyMessage="No subjects yet."
        columns={[
          { header: "Name", cell: (s) => s.name },
          { header: "Code", cell: (s) => s.code },
          {
            header: "",
            cell: (s) => (
              <Button
                variant="ghost"
                className="!px-2 !py-1 text-xs text-red-600"
                onClick={() => setSubjectPendingDelete(s)}
              >
                Delete
              </Button>
            ),
          },
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Add subject">
        <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <Input label="Subject name" {...register("name", { required: true })} />
          <Input label="Code" {...register("code", { required: true })} />
          {createMutation.isError && <p className="text-sm text-red-600">Failed to create subject.</p>}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!subjectPendingDelete}
        title="Delete subject"
        message={`Delete "${subjectPendingDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => subjectPendingDelete && deleteMutation.mutate(subjectPendingDelete.id)}
        onCancel={() => setSubjectPendingDelete(null)}
      />
    </Card>
  );
}

function ClassesSection() {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const [classPendingDelete, setClassPendingDelete] = useState<ClassRoom | null>(null);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });
  const { data: academicYears = [] } = useQuery({
    queryKey: ["admin", "academic-years"],
    queryFn: schoolService.fetchAcademicYears,
  });
  const { data: branches = [] } = useQuery({
    queryKey: ["admin", "branches"],
    queryFn: schoolService.fetchBranches,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: "", section: "", academic_year_id: "", branch_id: "" },
  });

  const createMutation = useMutation({
    mutationFn: classesService.createClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      reset();
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: classesService.deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      setClassPendingDelete(null);
    },
  });

  return (
    <Card title="Classes & Sections" onAdd={() => setModalOpen(true)} addLabel="Add class">
      <DataTable<ClassRoom>
        isLoading={isLoading}
        rows={classes}
        rowKey={(c) => c.id}
        emptyMessage="No classes yet."
        columns={[
          { header: "Class", cell: (c) => c.name },
          { header: "Section", cell: (c) => c.section },
          { header: "Academic Year", cell: (c) => c.academic_years?.name ?? "—" },
          { header: "Branch", cell: (c) => c.branches?.name ?? "—" },
          {
            header: "",
            cell: (c) => (
              <Button
                variant="ghost"
                className="!px-2 !py-1 text-xs text-red-600"
                onClick={() => setClassPendingDelete(c)}
              >
                Delete
              </Button>
            ),
          },
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Add class">
        <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <Input
            label="Class name (e.g. Grade 8)"
            error={errors.name?.message}
            {...register("name", { required: "Class name is required" })}
          />
          <Input
            label="Section (e.g. A)"
            error={errors.section?.message}
            {...register("section", { required: "Section is required" })}
          />
          <Select
            label="Academic year"
            placeholder="Select academic year"
            options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
            error={errors.academic_year_id?.message}
            {...register("academic_year_id", { required: "Academic year is required" })}
          />
          <Select
            label="Branch (optional)"
            placeholder="No specific branch"
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            {...register("branch_id")}
          />
          {createMutation.isError && (
            <p className="text-sm text-red-600">
              Failed to create class. This class/section may already exist for the academic year.
            </p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!classPendingDelete}
        title="Delete class"
        message={`Delete "${classPendingDelete?.name} - ${classPendingDelete?.section}"? Students in this class will become unassigned.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => classPendingDelete && deleteMutation.mutate(classPendingDelete.id)}
        onCancel={() => setClassPendingDelete(null)}
      />
    </Card>
  );
}

function Card({
  title,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  onAdd: () => void;
  addLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <Button onClick={onAdd}>{addLabel}</Button>
      </div>
      {children}
    </div>
  );
}

export function ClassesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Classes & Subjects</h1>
      <ClassesSection />
      <SubjectsSection />
    </div>
  );
}
