import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import * as studentsService from "@/services/admin/students.service";
import * as classesService from "@/services/admin/classes.service";
import { Student } from "@/types/admin.types";

export function StudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [studentPendingDeactivation, setStudentPendingDeactivation] = useState<Student | null>(null);
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "students", { search }],
    queryFn: () => studentsService.fetchStudents({ search: search || undefined, page: 1, pageSize: 50 }),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      email: "",
      full_name: "",
      phone: "",
      admission_no: "",
      roll_no: "",
      class_id: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: studentsService.createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      reset();
      setCreateOpen(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: studentsService.deactivateStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setStudentPendingDeactivation(null);
    },
  });

  const assignClassMutation = useMutation({
    mutationFn: ({ id, classId }: { id: string; classId: string }) =>
      studentsService.assignClass(id, classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setAssigningStudent(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Students</h1>
        <Button onClick={() => setCreateOpen(true)}>Add student</Button>
      </div>

      <Input
        label="Search"
        placeholder="Search by admission number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataTable<Student>
        isLoading={isLoading}
        rows={data?.items ?? []}
        rowKey={(s) => s.id}
        emptyMessage="No students found."
        columns={[
          { header: "Admission No", cell: (s) => s.admission_no },
          {
            header: "Name",
            cell: (s) => (
              <Link to={`/dashboard/admin/students/${s.id}`} className="text-brand-600 hover:underline">
                {s.users.full_name}
              </Link>
            ),
          },
          { header: "Email", cell: (s) => s.users.email },
          {
            header: "Class",
            cell: (s) => (s.classes ? `${s.classes.name} - ${s.classes.section}` : "Unassigned"),
          },
          {
            header: "",
            cell: (s) => (
              <div className="flex gap-2">
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setAssigningStudent(s)}>
                  Assign class
                </Button>
                {s.users.is_active && (
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 text-xs text-red-600"
                    onClick={() => setStudentPendingDeactivation(s)}
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="Add student">
        <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <Input
            label="Full name"
            error={errors.full_name?.message}
            {...register("full_name", { required: "Full name is required" })}
          />
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register("email", { required: "Email is required" })}
          />
          <Input label="Phone (optional)" {...register("phone")} />
          <Input
            label="Admission number"
            error={errors.admission_no?.message}
            {...register("admission_no", { required: "Admission number is required" })}
          />
          <Input label="Roll number (optional)" {...register("roll_no")} />
          <Select label="Class (optional)" placeholder="Unassigned" options={classOptions} {...register("class_id")} />
          {createMutation.isError && (
            <p className="text-sm text-red-600">
              Failed to create student. The email or admission number may already be in use.
            </p>
          )}
          <p className="text-xs text-slate-500">
            The student (or their guardian) will receive an email invite to set a password.
          </p>
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create student
          </Button>
        </form>
      </Modal>

      <Modal isOpen={!!assigningStudent} onClose={() => setAssigningStudent(null)} title="Assign class">
        <div className="space-y-4">
          <Select
            label="Class"
            placeholder="Select a class"
            options={classOptions}
            onChange={(e) => {
              if (assigningStudent && e.target.value) {
                assignClassMutation.mutate({ id: assigningStudent.id, classId: e.target.value });
              }
            }}
            defaultValue={assigningStudent?.class_id ?? ""}
          />
          {assignClassMutation.isPending && <p className="text-sm text-slate-500">Saving...</p>}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!studentPendingDeactivation}
        title="Deactivate student"
        message={`Are you sure you want to deactivate ${studentPendingDeactivation?.users.full_name}?`}
        confirmLabel="Deactivate"
        isLoading={deactivateMutation.isPending}
        onConfirm={() =>
          studentPendingDeactivation && deactivateMutation.mutate(studentPendingDeactivation.id)
        }
        onCancel={() => setStudentPendingDeactivation(null)}
      />
    </div>
  );
}
