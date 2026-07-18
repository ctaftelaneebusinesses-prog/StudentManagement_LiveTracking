import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import * as teachersService from "@/services/admin/teachers.service";
import * as classesService from "@/services/admin/classes.service";
import { Teacher } from "@/types/admin.types";

function AssignmentModal({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: classes = [] } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["admin", "subjects"],
    queryFn: classesService.fetchSubjects,
  });
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["admin", "teachers", teacher.id, "assignments"],
    queryFn: () => teachersService.fetchTeacherAssignments(teacher.id),
  });

  const { register, handleSubmit, reset } = useForm({ defaultValues: { class_id: "", subject_id: "" } });

  const assignMutation = useMutation({
    mutationFn: ({ classId, subjectId }: { classId: string; subjectId: string }) =>
      teachersService.assignTeacherToClassSubject(teacher.id, classId, subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers", teacher.id, "assignments"] });
      reset();
    },
  });

  return (
    <Modal isOpen onClose={onClose} title={`Assignments — ${teacher.users.full_name}`}>
      <div className="space-y-4">
        <DataTable
          isLoading={isLoading}
          rows={assignments}
          rowKey={(a) => a.id}
          emptyMessage="No assignments yet."
          columns={[
            { header: "Class", cell: (a) => `${a.classes.name} - ${a.classes.section}` },
            { header: "Subject", cell: (a) => `${a.subjects.name} (${a.subjects.code})` },
          ]}
        />

        <form
          className="flex items-end gap-2"
          onSubmit={handleSubmit((values) =>
            assignMutation.mutate({ classId: values.class_id, subjectId: values.subject_id })
          )}
        >
          <Select
            label="Class"
            placeholder="Select class"
            options={classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }))}
            {...register("class_id", { required: true })}
          />
          <Select
            label="Subject"
            placeholder="Select subject"
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            {...register("subject_id", { required: true })}
          />
          <Button type="submit" isLoading={assignMutation.isPending}>
            Assign
          </Button>
        </form>
      </div>
    </Modal>
  );
}

export function TeachersPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [teacherPendingDeactivation, setTeacherPendingDeactivation] = useState<Teacher | null>(null);
  const [assignmentTeacher, setAssignmentTeacher] = useState<Teacher | null>(null);

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["admin", "teachers"],
    queryFn: teachersService.fetchTeachers,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: "", full_name: "", phone: "", employee_id: "", qualification: "" },
  });

  const createMutation = useMutation({
    mutationFn: teachersService.createTeacher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      reset();
      setCreateOpen(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: teachersService.deactivateTeacher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      setTeacherPendingDeactivation(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Teachers</h1>
        <Button onClick={() => setCreateOpen(true)}>Add teacher</Button>
      </div>

      <DataTable<Teacher>
        isLoading={isLoading}
        rows={teachers}
        rowKey={(t) => t.id}
        emptyMessage="No teachers found."
        columns={[
          { header: "Employee ID", cell: (t) => t.employee_id },
          { header: "Name", cell: (t) => t.users.full_name },
          { header: "Email", cell: (t) => t.users.email },
          { header: "Qualification", cell: (t) => t.qualification ?? "—" },
          {
            header: "",
            cell: (t) => (
              <div className="flex gap-2">
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setAssignmentTeacher(t)}>
                  Assignments
                </Button>
                {t.users.is_active && (
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1 text-xs text-red-600"
                    onClick={() => setTeacherPendingDeactivation(t)}
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} title="Add teacher">
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
            label="Employee ID"
            error={errors.employee_id?.message}
            {...register("employee_id", { required: "Employee ID is required" })}
          />
          <Input label="Qualification (optional)" {...register("qualification")} />
          {createMutation.isError && (
            <p className="text-sm text-red-600">
              Failed to create teacher. The email or employee ID may already be in use.
            </p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create teacher
          </Button>
        </form>
      </Modal>

      {assignmentTeacher && (
        <AssignmentModal teacher={assignmentTeacher} onClose={() => setAssignmentTeacher(null)} />
      )}

      <ConfirmDialog
        isOpen={!!teacherPendingDeactivation}
        title="Deactivate teacher"
        message={`Are you sure you want to deactivate ${teacherPendingDeactivation?.users.full_name}?`}
        confirmLabel="Deactivate"
        isLoading={deactivateMutation.isPending}
        onConfirm={() =>
          teacherPendingDeactivation && deactivateMutation.mutate(teacherPendingDeactivation.id)
        }
        onCancel={() => setTeacherPendingDeactivation(null)}
      />
    </div>
  );
}
