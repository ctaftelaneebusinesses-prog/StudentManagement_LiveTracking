import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Pencil, Trash2, Download, Eye, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/axios";
import * as classesService from "@/services/admin/classes.service";
import * as syllabusService from "@/services/syllabus.service";
import { SyllabusEntry } from "@/services/syllabus.service";
import { ClassSectionValue, ClassSectionSelects } from "@/pages/admin/teachers/components/ClassSectionSelects";
import { resolveClassId } from "@/utils/classPicker";

interface FormValues {
  title: string;
  description: string;
  subject_id: string;
  is_published: boolean;
}

export function SyllabusPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SyllabusEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SyllabusEntry | null>(null);
  const [uploadClassSection, setUploadClassSection] = useState<ClassSectionValue>({ academicYearId: "", className: "", section: "" });
  const [classSectionErrors, setClassSectionErrors] = useState<{ academicYearId?: string; className?: string; section?: string }>({});
  const [file, setFile] = useState<File | null>(null);

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: classesService.fetchClasses });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: classesService.fetchSubjects });
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["syllabus", search],
    queryFn: () => syllabusService.listSyllabus({ search: search || undefined }),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { is_published: false } });

  const editForm = useForm<{ title: string; description: string; is_published: boolean }>();

  async function onUpload(values: FormValues) {
    if (!user?.school_id) return;
    const fieldErrors: typeof classSectionErrors = {};
    if (!uploadClassSection.academicYearId) fieldErrors.academicYearId = "Required";
    if (!uploadClassSection.className) fieldErrors.className = "Required";
    if (!uploadClassSection.section) fieldErrors.section = "Required";
    if (Object.keys(fieldErrors).length > 0) {
      setClassSectionErrors(fieldErrors);
      toast.error("Select an Academic Year, Class, and Section.");
      return;
    }
    setClassSectionErrors({});
    const class_id = resolveClassId(classes, uploadClassSection.academicYearId, uploadClassSection.className, uploadClassSection.section);
    if (!class_id) {
      toast.error("That class/section combination doesn't exist.");
      return;
    }
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    const academicYear = classes.find((c) => c.id === class_id)?.academic_years?.name ?? "";
    try {
      await syllabusService.createSyllabus(user.school_id, {
        academic_year: academicYear,
        class_id,
        subject_id: values.subject_id,
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
      setUploadClassSection({ academicYearId: "", className: "", section: "" });
      setClassSectionErrors({});
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => syllabusService.deleteSyllabus(id),
    onSuccess: () => {
      toast.success("Syllabus deleted.");
      queryClient.invalidateQueries({ queryKey: ["syllabus"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't delete syllabus.")),
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
          <button title="Delete" onClick={() => setDeleteTarget(e)} className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Syllabus</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload and manage syllabus documents for every class.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" /> Upload syllabus
        </Button>
      </div>

      <div className="max-w-xs">
        <Input label="Search" placeholder="Search by title..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="p-0">
        <DataTable columns={columns} rows={entries} rowKey={(e) => e.id} isLoading={isLoading} emptyMessage="No syllabus uploaded yet." />
      </Card>

      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setClassSectionErrors({});
        }}
        title="Upload Syllabus"
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleSubmit(onUpload)} noValidate>
          <Input label="Title" error={errors.title?.message} {...register("title", { required: "Title is required" })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ClassSectionSelects
              classes={classes}
              value={uploadClassSection}
              onChange={(next) => {
                setUploadClassSection(next);
                setClassSectionErrors({});
              }}
              errors={classSectionErrors}
            />
          </div>
          <Controller
            name="subject_id"
            control={control}
            rules={{ required: "Subject is required" }}
            render={({ field }) => (
              <Select
                label="Subject"
                placeholder="Select subject"
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.subject_id?.message}
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setUploadOpen(false);
                setClassSectionErrors({});
              }}
            >
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

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete syllabus"
        message={`Delete "${deleteTarget?.title}"? This can't be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
