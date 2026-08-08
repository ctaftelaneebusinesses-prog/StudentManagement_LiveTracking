import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import * as portalService from "@/services/teacher/portal.service";
import * as assessmentsService from "@/services/teacher/assessments.service";
import { getApiErrorMessage } from "@/lib/axios";
import { TeacherAssessment } from "@/types/teacher.types";

interface AssessmentFormValues {
  class_id: string;
  subject_id: string;
  name: string;
  exam_date: string;
  max_marks: string;
  instructions: string;
}

export function TeacherAssessmentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setModalOpen] = useState(false);

  const dashboardQuery = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: portalService.fetchDashboard });
  const classOptions = (dashboardQuery.data?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const assessmentsQuery = useQuery({ queryKey: ["teacher", "assessments"], queryFn: assessmentsService.fetchMyAssessments });

  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<AssessmentFormValues>({
    defaultValues: { class_id: "", subject_id: "", name: "", exam_date: "", max_marks: "100", instructions: "" },
  });

  const selectedClass = dashboardQuery.data?.classes.find((c) => c.id === watch("class_id"));
  const subjectOptions = (selectedClass?.subjects ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));

  const createMutation = useMutation({
    mutationFn: (values: AssessmentFormValues) =>
      assessmentsService.createAssessment({
        class_id: values.class_id,
        subject_id: values.subject_id,
        name: values.name,
        exam_date: values.exam_date,
        max_marks: values.max_marks ? Number(values.max_marks) : undefined,
        instructions: values.instructions || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "assessments"] });
      reset();
      setModalOpen(false);
      toast.success("Assessment created");
    },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Assessments</h1>
          <p className="text-sm text-[var(--ink-muted)]">Create and track assessments for the classes and subjects you teach.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Create assessment</Button>
      </div>

      <Card>
        <DataTable<TeacherAssessment>
          isLoading={assessmentsQuery.isLoading}
          rows={assessmentsQuery.data ?? []}
          rowKey={(a) => a.id}
          emptyMessage="No assessments created yet."
          columns={[
            {
              header: "Assessment",
              cell: (a) => (
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--ink-primary)]">
                  <GraduationCap size={14} strokeWidth={1.75} className="text-[var(--ink-muted)]" />
                  {a.name}
                </span>
              ),
            },
            { header: "Class", cell: (a) => (a.classes ? `${a.classes.name} - ${a.classes.section}` : "—") },
            { header: "Subject", cell: (a) => a.subjects?.name ?? "—" },
            { header: "Date", cell: (a) => (a.exam_date ? new Date(a.exam_date).toLocaleDateString() : "—") },
            { header: "Max marks", cell: (a) => a.max_marks ?? "—" },
          ]}
        />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Create assessment">
        <form className="space-y-4" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
          <Select label="Class" placeholder="Select class" options={classOptions} {...register("class_id", { required: true })} />
          <Select label="Subject" placeholder="Select subject" options={subjectOptions} {...register("subject_id", { required: true })} />
          <Input label="Assessment title" placeholder="e.g. Unit Test 1" {...register("name", { required: true })} />
          <Input label="Assessment date" type="date" {...register("exam_date", { required: true })} />
          <Input label="Maximum marks" type="number" min={1} {...register("max_marks")} />
          <Textarea label="Instructions (optional)" rows={4} placeholder="e.g. Bring your own calculator. Covers chapters 1-4." {...register("instructions")} />
          {createMutation.isError && (
            <p className="text-sm text-red-600">{getApiErrorMessage(createMutation.error, "Failed to create assessment.")}</p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create assessment
          </Button>
        </form>
      </Modal>
    </div>
  );
}
