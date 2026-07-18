import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import * as portalService from "@/services/teacher/portal.service";
import * as homeworkService from "@/services/teacher/homework.service";
import { HomeworkItem } from "@/types/teacher.types";

interface HomeworkFormValues {
  subject_id: string;
  title: string;
  description: string;
  due_date: string;
}

export function TeacherHomeworkPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<HomeworkItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HomeworkItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);

  const dashboardQuery = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: portalService.fetchDashboard });
  const classOptions = (dashboardQuery.data?.classes ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} - ${c.section}`,
  }));
  const selectedClass = dashboardQuery.data?.classes.find((c) => c.id === classId);
  const subjectOptions = (selectedClass?.subjects ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));

  const homeworkQuery = useQuery({
    queryKey: ["teacher", "homework", classId],
    queryFn: () => homeworkService.fetchHomework(classId),
    enabled: !!classId,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<HomeworkFormValues>({
    defaultValues: { subject_id: "", title: "", description: "", due_date: "" },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["teacher", "homework", classId] });
  }

  const createMutation = useMutation({
    mutationFn: homeworkService.createHomework,
    onSuccess: () => {
      invalidate();
      reset();
      setModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: homeworkService.CreateHomeworkInput }) =>
      homeworkService.updateHomework(id, patch),
    onSuccess: () => {
      invalidate();
      setEditingHomework(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: homeworkService.deleteHomework,
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
    },
  });

  async function handleUploadAndSubmit(values: HomeworkFormValues) {
    let attachmentUrl: string | undefined;
    const file = fileInputRef.current?.files?.[0];
    if (file && user) {
      setUploadError(null);
      setUploading(true);
      try {
        attachmentUrl = await homeworkService.uploadHomeworkAttachment(user.school_id ?? "", user.id, file);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to upload attachment");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const payload: homeworkService.CreateHomeworkInput = {
      class_id: classId,
      subject_id: values.subject_id || undefined,
      title: values.title,
      description: values.description || undefined,
      due_date: values.due_date,
      attachment_url: attachmentUrl,
    };

    if (editingHomework) {
      updateMutation.mutate({ id: editingHomework.id, patch: payload });
    } else {
      createMutation.mutate(payload);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreate() {
    setEditingHomework(null);
    reset({ subject_id: "", title: "", description: "", due_date: "" });
    setModalOpen(true);
  }

  function openEdit(hw: HomeworkItem) {
    setEditingHomework(hw);
    reset({
      subject_id: hw.subject_id ?? "",
      title: hw.title,
      description: hw.description ?? "",
      due_date: hw.due_date,
    });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Homework</h1>
        <p className="text-sm text-slate-500">Create and manage homework for your classes.</p>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Select
            label="Class"
            name="homeworkClassId"
            placeholder="Select class"
            options={classOptions}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
          <Button disabled={!classId} onClick={openCreate}>
            Assign homework
          </Button>
        </div>

        {!classId ? (
          <p className="text-sm text-slate-500">Select a class to view its homework.</p>
        ) : (
          <DataTable<HomeworkItem>
            isLoading={homeworkQuery.isLoading}
            rows={homeworkQuery.data ?? []}
            rowKey={(h) => h.id}
            emptyMessage="No homework assigned yet."
            columns={[
              { header: "Title", cell: (h) => h.title },
              { header: "Subject", cell: (h) => h.subjects?.name ?? "—" },
              { header: "Due date", cell: (h) => h.due_date },
              {
                header: "Attachment",
                cell: (h) =>
                  h.attachment_url ? (
                    <a href={h.attachment_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      View file
                    </a>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "",
                cell: (h) => (
                  <div className="flex gap-2">
                    <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openEdit(h)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1 text-xs text-red-600"
                      onClick={() => setPendingDelete(h)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingHomework ? "Edit homework" : "Assign homework"}
      >
        <form className="space-y-4" onSubmit={handleSubmit(handleUploadAndSubmit)}>
          <Input label="Title" {...register("title", { required: true })} />
          <Select label="Subject (optional)" placeholder="No specific subject" options={subjectOptions} {...register("subject_id")} />
          <Input label="Description (optional)" {...register("description")} />
          <Input label="Due date" type="date" {...register("due_date", { required: true })} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Attachment (optional)</label>
            <input ref={fileInputRef} type="file" className="text-sm" />
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          {(createMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600">Failed to save homework.</p>
          )}
          <Button
            type="submit"
            className="w-full"
            isLoading={isSubmitting || isUploading || createMutation.isPending || updateMutation.isPending}
          >
            {editingHomework ? "Save changes" : "Assign"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Delete homework"
        message={`Delete "${pendingDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
