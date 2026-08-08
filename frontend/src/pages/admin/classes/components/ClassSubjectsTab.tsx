import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownAZ, ArrowUpAZ, ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { getApiErrorMessage } from "@/lib/axios";
import * as classesService from "@/services/admin/classes.service";
import * as teachersService from "@/services/admin/teachers.service";
import { ClassSubject } from "@/types/admin.types";

const PAGE_SIZE = 8;

type SortKey = "name" | "teacher" | "status";

/** Deterministic-enough short code from a subject name so the "Add subject" flow here doesn't force admins to invent one — the full catalog (Classes & Sections > Subjects) still lets them set an explicit code. */
function generateSubjectCode(name: string): string {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "SUBJ";
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base}${suffix}`.slice(0, 20);
}

interface SubjectFormValues {
  subjectMode: "existing" | "new";
  subject_id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  teacher_id: string;
}

export function ClassSubjectsTab({ classId }: { classId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<"add" | ClassSubject | null>(null);
  const [viewing, setViewing] = useState<ClassSubject | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClassSubject | null>(null);

  const { data: classSubjects = [], isLoading } = useQuery({
    queryKey: ["admin", "class", classId, "subjects"],
    queryFn: () => classesService.fetchClassSubjects(classId),
    enabled: !!classId,
  });
  const { data: subjectCatalog = [] } = useQuery({
    queryKey: ["admin", "subjects"],
    queryFn: classesService.fetchSubjects,
  });
  const { data: teacherPage } = useQuery({
    queryKey: ["admin", "teachers", "all"],
    queryFn: () => teachersService.fetchTeachers({ pageSize: 1000 }),
  });
  const teacherOptions = (teacherPage?.items ?? []).map((t) => ({ value: t.id, label: t.users.full_name }));

  const assignedSubjectIds = new Set(classSubjects.map((cs) => cs.subject_id));
  const unassignedCatalog = subjectCatalog.filter((s) => !assignedSubjectIds.has(s.id));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "class", classId, "subjects"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "subjects"] });
    // Teacher assignment here is mirrored onto timetable_periods server-side — keep the Timetable tab in sync.
    queryClient.invalidateQueries({ queryKey: ["admin", "timetable", classId] });
  }

  const filteredRows = useMemo(() => {
    let rows = classSubjects;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.subjects.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      rows = rows.filter((r) => (r.subjects.status ?? "active") === statusFilter);
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.subjects.name.localeCompare(b.subjects.name);
      else if (sortKey === "teacher") cmp = (a.users?.full_name ?? "").localeCompare(b.users?.full_name ?? "");
      else cmp = (a.subjects.status ?? "active").localeCompare(b.subjects.status ?? "active");
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [classSubjects, search, statusFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetToFirstPage() {
    setPage(1);
  }

  const { register, handleSubmit, watch, reset, formState: { isSubmitting } } = useForm<SubjectFormValues>({
    defaultValues: { subjectMode: "existing", subject_id: "", name: "", description: "", status: "active", teacher_id: "" },
  });
  const subjectMode = watch("subjectMode");
  const [addError, setAddError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: async (values: SubjectFormValues) => {
      let subjectId = values.subject_id;
      if (values.subjectMode === "new") {
        const created = await classesService.createSubject({
          name: values.name,
          code: generateSubjectCode(values.name),
          description: values.description || undefined,
          status: values.status,
        });
        subjectId = created.id;
      }
      return classesService.assignSubjectToClass(classId, {
        subject_id: subjectId,
        teacher_id: values.teacher_id || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      reset();
      setModal(null);
      setAddError(null);
    },
    onError: (err) => setAddError(getApiErrorMessage(err, "Failed to add subject.")),
  });

  function openAddModal() {
    reset({ subjectMode: "existing", subject_id: "", name: "", description: "", status: "active", teacher_id: "" });
    setAddError(null);
    setModal("add");
  }

  const deleteMutation = useMutation({
    mutationFn: (cs: ClassSubject) => classesService.removeSubjectFromClass(classId, cs.subject_id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
    },
  });

  const editing = modal !== "add" ? modal : null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <ChartCard
      title="Subjects"
      subtitle={`${classSubjects.length} subject${classSubjects.length === 1 ? "" : "s"} assigned to this class`}
      legend={
        <Button onClick={openAddModal} className="!px-3 !py-1.5 text-xs">
          <Plus size={14} className="mr-1" />
          Add subject
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetToFirstPage();
            }}
            placeholder="Search subjects…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            resetToFirstPage();
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="flex items-center gap-1.5">
          <select
            value={sortKey}
            onChange={(e) => toggleSort(e.target.value as SortKey)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
          >
            <option value="name">Sort: Name</option>
            <option value="teacher">Sort: Teacher</option>
            <option value="status">Sort: Status</option>
          </select>
          <button
            type="button"
            onClick={() => setSortAsc((a) => !a)}
            title={sortAsc ? "Ascending" : "Descending"}
            className="rounded-md border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 dark:border-white/20 dark:text-slate-400 dark:hover:bg-white/10"
          >
            {sortAsc ? <ArrowDownAZ size={16} /> : <ArrowUpAZ size={16} />}
          </button>
        </div>
      </div>

      {!isLoading && classSubjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="Add the subjects taught in this class to get started." />
      ) : (
        <>
          <DataTable<ClassSubject>
            isLoading={isLoading}
            rows={pageRows}
            rowKey={(cs) => cs.id}
            emptyMessage="No subjects match your filters."
            columns={[
              { header: "Subject Name", cell: (cs) => <span className="font-medium text-[var(--ink-primary)]">{cs.subjects.name}</span> },
              { header: "Assigned Teacher", cell: (cs) => cs.users?.full_name ?? <span className="text-[var(--ink-muted)]">Unassigned</span> },
              {
                header: "Status",
                cell: (cs) => (
                  <Badge variant={(cs.subjects.status ?? "active") === "active" ? "success" : "neutral"}>
                    {(cs.subjects.status ?? "active") === "active" ? "Active" : "Inactive"}
                  </Badge>
                ),
              },
              {
                header: "",
                cell: (cs) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" className="!p-1.5" title="View" onClick={() => setViewing(cs)}>
                      <Eye size={15} />
                    </Button>
                    <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => setModal(cs)}>
                      <Pencil size={15} />
                    </Button>
                    <Button variant="ghost" className="!p-1.5 text-red-600" title="Delete" onClick={() => setPendingDelete(cs)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ),
                className: "text-right",
              },
            ]}
          />

          {filteredRows.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--ink-muted)]">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" className="!px-2.5 !py-1.5" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant="secondary"
                  className="!px-2.5 !py-1.5"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={modal === "add"} onClose={() => setModal(null)} title="Add subject">
        <form className="space-y-4" onSubmit={handleSubmit((values) => addMutation.mutate(values))}>
          <Select
            label="Subject"
            options={[
              { value: "existing", label: "Choose from existing subjects" },
              { value: "new", label: "Create a new subject" },
            ]}
            {...register("subjectMode")}
          />

          {subjectMode === "existing" ? (
            <Select
              label="Subject name"
              placeholder="Select a subject"
              options={unassignedCatalog.map((s) => ({ value: s.id, label: s.name }))}
              {...register("subject_id", { required: subjectMode === "existing" })}
            />
          ) : (
            <>
              <Input label="Subject name" {...register("name", { required: subjectMode === "new" })} />
              <Input label="Description (optional)" {...register("description")} />
              <Select
                label="Status"
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
                {...register("status")}
              />
            </>
          )}

          <Select label="Assigned teacher (optional)" placeholder="Unassigned" options={teacherOptions} {...register("teacher_id")} />

          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <Button type="submit" className="w-full" isLoading={isSubmitting || addMutation.isPending}>
            Save
          </Button>
        </form>
      </Modal>

      {editing && (
        <EditSubjectModal
          classId={classId}
          classSubject={editing}
          teacherOptions={teacherOptions}
          onClose={() => setModal(null)}
          onSaved={invalidate}
        />
      )}

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Subject details" size="md">
        {viewing && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-[var(--ink-muted)]">Subject Name</p>
              <p className="mt-0.5 font-medium text-[var(--ink-primary)]">{viewing.subjects.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--ink-muted)]">Assigned Teacher</p>
              <p className="mt-0.5 text-[var(--ink-primary)]">{viewing.users?.full_name ?? "Unassigned"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--ink-muted)]">Description</p>
              <p className="mt-0.5 text-[var(--ink-primary)]">{viewing.subjects.description || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--ink-muted)]">Status</p>
              <Badge variant={(viewing.subjects.status ?? "active") === "active" ? "success" : "neutral"} className="mt-1">
                {(viewing.subjects.status ?? "active") === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Remove subject"
        message={`Remove "${pendingDelete?.subjects.name}" from this class? This won't delete the subject from the catalog.`}
        confirmLabel="Remove"
        isLoading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </ChartCard>
  );
}

function EditSubjectModal({
  classId,
  classSubject,
  teacherOptions,
  onClose,
  onSaved,
}: {
  classId: string;
  classSubject: ClassSubject;
  teacherOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: classSubject.subjects.name,
      description: classSubject.subjects.description ?? "",
      status: (classSubject.subjects.status ?? "active") as "active" | "inactive",
      teacher_id: classSubject.teacher_id ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: { name: string; description: string; status: "active" | "inactive"; teacher_id: string }) => {
      await classesService.updateSubject(classSubject.subject_id, {
        name: values.name,
        description: values.description || null,
        status: values.status,
      });
      await classesService.assignSubjectToClass(classId, {
        subject_id: classSubject.subject_id,
        teacher_id: values.teacher_id || undefined,
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => setError(getApiErrorMessage(err, "Failed to update subject.")),
  });

  return (
    <Modal isOpen onClose={onClose} title="Edit subject">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Input label="Subject name" {...register("name", { required: true })} />
        <Input label="Description (optional)" {...register("description")} />
        <Select label="Assigned teacher" placeholder="Unassigned" options={teacherOptions} {...register("teacher_id")} />
        <Select
          label="Status"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          {...register("status")}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" isLoading={isSubmitting || mutation.isPending}>
          Save changes
        </Button>
      </form>
    </Modal>
  );
}
