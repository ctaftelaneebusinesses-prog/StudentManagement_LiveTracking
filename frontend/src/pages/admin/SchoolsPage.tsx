import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Pencil,
  Plus,
  School as SchoolIcon,
  Search,
  Trash2,
  Users2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApiErrorMessage } from "@/lib/axios";
import { ExportColumn } from "@/utils/export";
import * as schoolService from "@/services/admin/school.service";
import { School } from "@/types/admin.types";
import { deriveAcademicYearLabel } from "@/utils/academicYear";
import { INDIAN_STATE_OPTIONS, getDistrictOptionsForState } from "@/utils/indianRegions";
import { digitsOnly, PHONE_PATTERN } from "@/utils/formHelpers";

const PAGE_SIZE = 8;

type SortKey = "name" | "code" | "city";

interface SchoolFormValues {
  name: string;
  code: string;
  branch_name: string;
  principal_name: string;
  email: string;
  phone: string;
  alternate_phone: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pin_code: string;
  country: string;
  status: "active" | "inactive";
  create_academic_year: boolean;
  academic_year_start: string;
  academic_year_end: string;
}

const EMPTY_FORM: SchoolFormValues = {
  name: "",
  code: "",
  branch_name: "",
  principal_name: "",
  email: "",
  phone: "",
  alternate_phone: "",
  address: "",
  city: "",
  district: "",
  state: "",
  pin_code: "",
  country: "",
  status: "active",
  create_academic_year: false,
  academic_year_start: "",
  academic_year_end: "",
};

function SummaryPill({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Building2 }) {
  return (
    <div className="flex-1 rounded-2xl border border-black/[0.06] bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
        <Icon size={13} />
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold text-[var(--ink-primary)]">{value}</p>
    </div>
  );
}

function SchoolLogo({ school }: { school: School }) {
  if (school.logo_url) {
    return <img src={school.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />;
  }
  const initials = school.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-50 text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
      {initials || "S"}
    </span>
  );
}

/** Independently fetches + renders one school's student/teacher count for the list table, so the main list query stays a single cheap `listSchools()` call. */
function SchoolCountCell({ schoolId, field }: { schoolId: string; field: "totalStudents" | "totalTeachers" }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "schools", schoolId, "stats"],
    queryFn: () => schoolService.fetchSchoolProfileStats(schoolId),
  });
  if (isLoading) return <span className="text-[var(--ink-muted)]">…</span>;
  return <span className="font-medium">{data ? data[field] : 0}</span>;
}

export function SchoolsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<School | null>(null);
  const [deleteConflict, setDeleteConflict] = useState<{ activeStudents: number; activeTeachers: number } | null>(null);

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["admin", "schools", "all"],
    queryFn: schoolService.listSchools,
  });
  const { data: platformStats } = useQuery({
    queryKey: ["admin", "schools", "platform-stats"],
    queryFn: schoolService.fetchPlatformStats,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "schools"] });
  }

  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<SchoolFormValues>({
    defaultValues: EMPTY_FORM,
  });
  const createAcademicYear = watch("create_academic_year");
  const yearStart = watch("academic_year_start");
  const yearEnd = watch("academic_year_end");
  const yearLabel = deriveAcademicYearLabel(yearStart, yearEnd);
  const [districtOptions, setDistrictOptions] = useState<{ value: string; label: string }[]>([]);

  async function handleStateChange(stateName: string) {
    setValue("state", stateName);
    setValue("district", "");
    setDistrictOptions(await getDistrictOptionsForState(stateName));
  }

  function openAddModal() {
    setEditingSchool(null);
    setLogoFile(null);
    setFormError(null);
    setDistrictOptions([]);
    reset(EMPTY_FORM);
    setModalMode("add");
  }

  function openEditModal(school: School) {
    setEditingSchool(school);
    setLogoFile(null);
    setFormError(null);
    reset({
      name: school.name,
      code: school.code,
      branch_name: school.branch_name ?? "",
      principal_name: school.principal_name ?? "",
      email: school.email ?? "",
      phone: school.phone ?? "",
      alternate_phone: school.alternate_phone ?? "",
      address: school.address ?? "",
      city: school.city ?? "",
      district: school.district ?? "",
      state: school.state ?? "",
      pin_code: school.pin_code ?? "",
      country: school.country ?? "",
      status: school.is_active ? "active" : "inactive",
      create_academic_year: false,
      academic_year_start: "",
      academic_year_end: "",
    });
    setDistrictOptions([]);
    if (school.state) getDistrictOptionsForState(school.state).then(setDistrictOptions);
    setModalMode("edit");
  }

  // Deep-link from the School Profile page's "Edit school" quick action.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || schools.length === 0) return;
    const target = schools.find((s) => s.id === editId);
    if (target) openEditModal(target);
    setSearchParams({}, { replace: true });
  }, [searchParams, schools]);

  const saveMutation = useMutation({
    mutationFn: async (values: SchoolFormValues) => {
      // Trim (not just `|| undefined`) so stray whitespace — e.g. left over
      // from typing then clearing a field — can't slip through as a
      // non-empty value and trip server-side min-length validation (the
      // school code requires 2+ characters when provided at all).
      const clean = (v: string) => v.trim() || undefined;
      const payload = {
        name: values.name.trim(),
        code: clean(values.code),
        branch_name: clean(values.branch_name),
        principal_name: clean(values.principal_name),
        email: clean(values.email),
        phone: clean(values.phone),
        alternate_phone: clean(values.alternate_phone),
        address: clean(values.address),
        city: clean(values.city),
        district: clean(values.district),
        state: clean(values.state),
        pin_code: clean(values.pin_code),
        country: clean(values.country),
        is_active: values.status === "active",
      };

      if (modalMode === "edit" && editingSchool) {
        let logo_url = editingSchool.logo_url ?? undefined;
        if (logoFile) logo_url = await schoolService.uploadSchoolLogoFor(editingSchool.id, logoFile);
        return schoolService.updateSchoolById(editingSchool.id, { ...payload, logo_url });
      }

      const academic_year =
        values.create_academic_year && values.academic_year_start && values.academic_year_end
          ? { name: yearLabel, start_date: values.academic_year_start, end_date: values.academic_year_end }
          : undefined;
      const created = await schoolService.createSchool({ ...payload, academic_year });
      if (logoFile) {
        const logo_url = await schoolService.uploadSchoolLogoFor(created.id, logoFile);
        return schoolService.updateSchoolById(created.id, { logo_url });
      }
      return created;
    },
    onSuccess: () => {
      invalidate();
      toast.success(modalMode === "edit" ? "School updated." : "School added.");
      setModalMode(null);
    },
    onError: (err) => setFormError(getApiErrorMessage(err, "Failed to save school.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string; force: boolean }) => schoolService.deleteSchoolById(vars.id, vars.force),
    onSuccess: (result) => {
      invalidate();
      toast.success(result.action === "deleted" ? "School deleted." : "School deactivated.");
      setPendingDelete(null);
      setDeleteConflict(null);
    },
    onError: (err) => {
      const details = (err as { response?: { data?: { details?: { activeStudents: number; activeTeachers: number } } } })
        ?.response?.data?.details;
      if (details) {
        setDeleteConflict(details);
      } else {
        toast.error(getApiErrorMessage(err, "Failed to delete school."));
        setPendingDelete(null);
      }
    },
  });

  const filteredRows = useMemo(() => {
    let rows = schools;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.principal_name ?? "").toLowerCase().includes(q) ||
          (s.city ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      rows = rows.filter((s) => (statusFilter === "active" ? s.is_active : !s.is_active));
    }
    return [...rows].sort((a, b) => {
      const cmp =
        sortKey === "name"
          ? a.name.localeCompare(b.name)
          : sortKey === "code"
            ? a.code.localeCompare(b.code)
            : (a.city ?? "").localeCompare(b.city ?? "");
      return sortAsc ? cmp : -cmp;
    });
  }, [schools, search, statusFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportColumns: ExportColumn<School>[] = [
    { header: "Name", accessor: (s) => s.name },
    { header: "Code", accessor: (s) => s.code },
    { header: "Principal", accessor: (s) => s.principal_name ?? "" },
    { header: "City", accessor: (s) => s.city ?? "" },
    { header: "Phone", accessor: (s) => s.phone ?? "" },
    { header: "Email", accessor: (s) => s.email ?? "" },
    { header: "Status", accessor: (s) => (s.is_active ? "Active" : "Inactive") },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">School Management</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Add and manage the schools in your organization, and switch between them from the selector in the top bar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryPill label="Total Schools" value={platformStats?.totalSchools ?? 0} icon={Building2} />
        <SummaryPill label="Active Schools" value={platformStats?.activeSchools ?? 0} icon={CheckCircle2} />
        <SummaryPill label="Inactive Schools" value={platformStats?.inactiveSchools ?? 0} icon={XCircle} />
        <SummaryPill label="Total Students" value={platformStats?.totalStudents ?? 0} icon={GraduationCap} />
        <SummaryPill label="Total Teachers" value={platformStats?.totalTeachers ?? 0} icon={Users2} />
      </div>

      <ChartCard
        title="Schools"
        subtitle={`${schools.length} school${schools.length === 1 ? "" : "s"}`}
        legend={
          <div className="flex flex-wrap gap-2">
            <ExportButtons title="Schools" columns={exportColumns} rows={filteredRows} filename="schools" />
            <Button onClick={openAddModal} className="!px-3 !py-1.5 text-xs">
              <Plus size={14} className="mr-1" />
              Add School
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, code, principal, or city…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setPage(1);
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
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              <option value="name">Sort: Name</option>
              <option value="code">Sort: Code</option>
              <option value="city">Sort: City</option>
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

        {!isLoading && schools.length === 0 ? (
          <EmptyState icon={SchoolIcon} title="No schools yet" description="Add your first school to get started." />
        ) : (
          <>
            <DataTable<School>
              isLoading={isLoading}
              rows={pageRows}
              rowKey={(s) => s.id}
              emptyMessage="No schools match your filters."
              columns={[
                { header: "", cell: (s) => <SchoolLogo school={s} /> },
                {
                  header: "School Name",
                  cell: (s) => (
                    <button
                      type="button"
                      className="font-medium text-[var(--ink-primary)] hover:underline"
                      onClick={() => navigate(`/dashboard/admin/schools/${s.id}`)}
                    >
                      {s.name}
                    </button>
                  ),
                },
                { header: "Code", cell: (s) => s.code },
                { header: "Principal", cell: (s) => s.principal_name ?? "—" },
                { header: "City", cell: (s) => s.city ?? "—" },
                { header: "Students", cell: (s) => <SchoolCountCell schoolId={s.id} field="totalStudents" /> },
                { header: "Teachers", cell: (s) => <SchoolCountCell schoolId={s.id} field="totalTeachers" /> },
                {
                  header: "Status",
                  cell: (s) => <Badge variant={s.is_active ? "success" : "neutral"}>{s.is_active ? "Active" : "Inactive"}</Badge>,
                },
                {
                  header: "",
                  cell: (s) => (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="!p-1.5" title="View" onClick={() => navigate(`/dashboard/admin/schools/${s.id}`)}>
                        <Eye size={15} />
                      </Button>
                      <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => openEditModal(s)}>
                        <Pencil size={15} />
                      </Button>
                      <Button variant="ghost" className="!p-1.5 text-red-600" title="Delete" onClick={() => setPendingDelete(s)}>
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
      </ChartCard>

      <Modal isOpen={modalMode !== null} onClose={() => setModalMode(null)} title={modalMode === "edit" ? "Edit school" : "Add school"} size="xl">
        <form className="space-y-4" onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="School Name" error={errors.name?.message} {...register("name", { required: "School name is required" })} />
            <Input
              label="School Code (optional)"
              placeholder="Leave blank to auto-generate"
              error={errors.code?.message}
              {...register("code", {
                validate: (v) => !v || !v.trim() || v.trim().length >= 2 || "Code must be at least 2 characters",
              })}
            />
            <Input label="Branch Name (optional)" {...register("branch_name")} />
            <Input label="Principal Name" {...register("principal_name")} />
            <Input label="School Email" type="email" {...register("email")} />
            <Input
              label="School Phone Number"
              inputMode="numeric"
              error={errors.phone?.message}
              {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
            />
            <Input
              label="Alternate Phone (optional)"
              inputMode="numeric"
              error={errors.alternate_phone?.message}
              {...digitsOnly(register("alternate_phone", { pattern: PHONE_PATTERN }), 10)}
            />
            <Select
              label="Status"
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              {...register("status")}
            />
          </div>

          <Input label="Address" {...register("address")} />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SearchableSelect
              label="State"
              placeholder="Select state"
              options={INDIAN_STATE_OPTIONS}
              value={watch("state") ?? ""}
              onChange={handleStateChange}
            />
            <SearchableSelect
              label="District"
              placeholder={watch("state") ? "Select district" : "Select a state first"}
              options={districtOptions}
              value={watch("district") ?? ""}
              onChange={(v) => setValue("district", v)}
              disabled={!watch("state")}
            />
            <Input label="City / Town" placeholder="Not listed? Type it here" {...register("city")} />
            <Input label="PIN Code" {...register("pin_code")} />
          </div>
          <Input label="Country" {...register("country")} />

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">School Logo (optional)</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--ink-secondary)] file:mr-3 file:rounded-md file:border-0 file:bg-accent-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-accent-700 hover:file:bg-accent-100 dark:file:bg-accent-500/15 dark:file:text-accent-300"
            />
          </div>

          {modalMode === "add" && (
            <div className="rounded-lg border border-black/[0.08] p-3.5 dark:border-white/[0.1]">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <input type="checkbox" {...register("create_academic_year")} />
                Set up this school's first academic year now
              </label>
              {createAcademicYear && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <DatePicker label="Start date" value={yearStart} onChange={(iso) => setValue("academic_year_start", iso, { shouldValidate: true })} />
                    <DatePicker
                      label="End date"
                      value={yearEnd}
                      onChange={(iso) => setValue("academic_year_end", iso, { shouldValidate: true })}
                      minDate={yearStart}
                    />
                  </div>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Academic Year: <span className="font-medium text-[var(--ink-primary)]">{yearLabel || "Select both dates"}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <Button type="submit" className="w-full" isLoading={isSubmitting || saveMutation.isPending}>
            {modalMode === "edit" ? "Save changes" : "Create school"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDelete && !deleteConflict}
        title="Delete school"
        message={`Delete "${pendingDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate({ id: pendingDelete.id, force: false })}
        onCancel={() => setPendingDelete(null)}
      />

      <Modal isOpen={!!deleteConflict} onClose={() => setDeleteConflict(null)} title="This school still has people in it">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            "{pendingDelete?.name}" still has <strong>{deleteConflict?.activeStudents ?? 0}</strong> active student
            {deleteConflict?.activeStudents === 1 ? "" : "s"} and <strong>{deleteConflict?.activeTeachers ?? 0}</strong> active teacher
            {deleteConflict?.activeTeachers === 1 ? "" : "s"}. It can't be permanently deleted while they're active — you can deactivate
            it instead, which hides it from normal use without erasing any records.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConflict(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate({ id: pendingDelete.id, force: true })}
            >
              Deactivate instead
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
