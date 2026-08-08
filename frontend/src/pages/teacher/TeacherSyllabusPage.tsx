import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Pencil, Download, Eye, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/axios";
import * as assignmentsService from "@/services/teacher/assignments.service";
import * as syllabusService from "@/services/syllabus.service";
import { SyllabusEntry } from "@/services/syllabus.service";

interface FormValues {
  title: string;
  description: string;
  assignment_id: string;
  is_published: boolean;
}

export function TeacherSyllabusPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SyllabusEntry | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const { data: assignments = [] } = useQuery({ queryKey: ["my-assignments"], queryFn: assignmentsService.fetchMyAssignments });
  const { data: entries = [], isLoading } = useQuery({ queryKey: ["syllabus", "teacher"], queryFn: () => syllabusService.listSyllabus() });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { is_published: false } });

  const editForm = useForm<{ title: string; description: string; is_published: boolean }>();

  const assignmentOptions = assignments.map((a) => ({
    value: a.id,
    label: `${a.classes?.name} - ${a.classes?.section} (${a.subjects?.name})`,
  }));

  async function onUpload(values: FormValues) {
    if (!user?.school_id) return;
    const assignment = assignments.find((a) => a.id === values.assignment_id);
    if (!assignment) {
      toast.error("Select the class and subject.");
      return;
    }
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    try {
      await syllabusService.createSyllabus(user.school_id, {
        academic_year: assignment.classes?.academic_years?.name ?? "",
        class_id: assignment.class_id,
        subject_id: assignment.subject_id,
        title: values.title,
        description: values.description || undefined,
        is_published: values.is_published,
        file,
      });
      toast.success("Syllabus uploaded.");
      queryClient.invalidateQueries({ queryKey: ["syllabus"] });
      setUploadOpen(false);
      reset();
      setFile(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't upload syllabus."));
    }
  }

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; patch: { title?: string; description?: string; is_published?: boolean } }) =>
      syllabusService.updateSyllabus(input.id, input.patch),
    onSuccess: () => {
      toast.success("Syllabus updated.");
      queryClient.invalidateQueries({ queryKey: ["syllabus"] });
      setEditTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't update syllabus.")),
  });

  const columns: Column<SyllabusEntry>[] = [
    { header: "Title", cell: (e) => e.title },
    { header: "Class", cell: (e) => (e.classes ? `${e.classes.name} - ${e.classes.section}` : "—") },
    { header: "Subject", cell: (e) => e.subjects?.name ?? "—" },
    { header: "Status", cell: (e) => <Badge variant={e.is_published ? "success" : "neutral"}>{e.is_published ? "Published" : "Draft"}</Badge> },
    {
      header: "Actions",
      cell: (e) => (
        <div className="flex gap-1.5">
          {e.url && (
            <a href={e.url} target="_blank" rel="noreferrer" title="Preview" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
              <Eye className="h-4 w-4" />
            </a>
          )}
          {e.url && (
            <a href={e.url} download={e.file_name} title="Download" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
              <Download className="h-4 w-4" />
            </a>
          )}
          <button
            title="Edit"
            onClick={() => {
              setEditTarget(e);
              editForm.reset({ title: e.title, description: e.description ?? "", is_published: e.is_published });
            }}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Syllabus</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload and manage syllabus for your assigned classes and subjects.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" /> Upload syllabus
        </Button>
      </div>

      <Card className="p-0">
        <DataTable columns={columns} rows={entries} rowKey={(e) => e.id} isLoading={isLoading} emptyMessage="No syllabus uploaded yet." />
      </Card>

      <Modal isOpen={isUploadOpen} onClose={() => setUploadOpen(false)} title="Upload Syllabus" size="lg">
        <form className="space-y-4" onSubmit={handleSubmit(onUpload)} noValidate>
          <Input label="Title" error={errors.title?.message} {...register("title", { required: "Title is required" })} />
          <Controller
            name="assignment_id"
            control={control}
            rules={{ required: "Select a class and subject" }}
            render={({ field }) => (
              <Select
                label="Class / Subject"
                placeholder="Select your class and subject"
                options={assignmentOptions}
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.assignment_id?.message}
              />
            )}
          />
          <Textarea label="Description (optional)" rows={2} {...register("description")} />
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload PDF / DOC / DOCX</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 dark:text-slate-300 dark:file:bg-brand-500/10 dark:file:text-brand-300"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Checkbox {...register("is_published")} /> Publish immediately
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <Plus className="h-4 w-4" /> Upload
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Syllabus" size="md">
        {editTarget && (
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editTarget.id, patch: values }))}
          >
            <Input label="Title" {...editForm.register("title", { required: true })} />
            <Textarea label="Description (optional)" rows={2} {...editForm.register("description")} />
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Checkbox {...editForm.register("is_published")} /> Published
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
