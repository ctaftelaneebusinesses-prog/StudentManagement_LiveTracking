import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  Briefcase,
  CalendarX,
  Eye,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { TeacherFormModal } from "@/pages/admin/teachers/components/TeacherFormModal";
import { ClassSectionSelects, ClassSectionValue } from "@/pages/admin/teachers/components/ClassSectionSelects";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import * as teachersService from "@/services/admin/teachers.service";
import * as teacherAttendanceService from "@/services/admin/teacherAttendance.service";
import * as classesService from "@/services/admin/classes.service";
import { Teacher } from "@/types/admin.types";
import { ExportColumn } from "@/utils/export";
import { getApiErrorMessage } from "@/lib/axios";
import { resolveClassId } from "@/utils/classPicker";

const PAGE_SIZE = 10;

function StatPill({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
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

export function TeachersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [classFilter, setClassFilter] = useState<ClassSectionValue>({ academicYearId: "", className: "", section: "" });
  const [subjectFilter, setSubjectFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherPendingDelete, setTeacherPendingDelete] = useState<Teacher | null>(null);
  const [viewingSubjectsFor, setViewingSubjectsFor] = useState<Teacher | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Broad, unpaginated fetch backing the dashboard stats + qualification options for the form modal —
  // separate from the paginated/filtered table query below.
  const { data: allTeachers } = useQuery({
    queryKey: ["admin", "teachers", "all"],
    queryFn: () => teachersService.fetchTeachers({ pageSize: 1000 }),
  });

  const { data: dailyAttendance } = useQuery({
    queryKey: ["admin", "teacher-attendance", "daily", "today"],
    queryFn: () => teacherAttendanceService.fetchDailyAttendance(new Date().toISOString().slice(0, 10)),
  });

  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const { data: subjects = [] } = useQuery({ queryKey: ["admin", "subjects"], queryFn: classesService.fetchSubjects });
  const classFilterId = resolveClassId(classes, classFilter.academicYearId, classFilter.className, classFilter.section);

  const { data: viewingAssignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["admin", "teachers", viewingSubjectsFor?.id, "assignments"],
    queryFn: () => teachersService.fetchTeacherAssignments(viewingSubjectsFor!.id),
    enabled: !!viewingSubjectsFor,
  });

  const { data: teacherPage, isLoading } = useQuery({
    queryKey: ["admin", "teachers", debouncedSearch, statusFilter, classFilterId, subjectFilter, page],
    queryFn: () =>
      teachersService.fetchTeachers({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        classId: classFilterId || undefined,
        subjectId: subjectFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const distinctQualifications = useMemo(
    () =>
      Array.from(
        new Set((allTeachers?.items ?? []).map((t) => t.qualification).filter((q): q is string => !!q))
      ).sort(),
    [allTeachers]
  );

  const stats = useMemo(() => {
    const items = allTeachers?.items ?? [];
    const active = items.filter((t) => t.users.is_active).length;
    const classTeachers = items.filter((t) => !!t.homeroom).length;
    const withExperience = items.filter((t) => t.experience_years != null);
    const avgExperience =
      withExperience.length > 0
        ? Math.round(
            (withExperience.reduce((sum, t) => sum + (t.experience_years ?? 0), 0) / withExperience.length) * 10
          ) / 10
        : 0;
    const onLeaveToday = (dailyAttendance ?? []).filter((r) => r.status === "leave").length;
    const presentToday = (dailyAttendance ?? []).filter((r) => r.status === "present").length;
    return { total: items.length, active, classTeachers, avgExperience, onLeaveToday, presentToday };
  }, [allTeachers, dailyAttendance]);

  function openAddModal() {
    setEditingTeacher(null);
    setModalMode("add");
  }

  function openEditModal(teacher: Teacher) {
    setEditingTeacher(teacher);
    setModalMode("edit");
  }

  const deleteMutation = useMutation({
    mutationFn: teachersService.deactivateTeacher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      toast.success(`${teacherPendingDelete?.users.full_name ?? "Teacher"} deactivated.`);
      setTeacherPendingDelete(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to deactivate teacher.")),
  });

  const totalPages = teacherPage ? Math.max(1, Math.ceil(teacherPage.total / PAGE_SIZE)) : 1;

  const exportColumns: ExportColumn<Teacher>[] = [
    { header: "Employee ID", accessor: (t) => t.employee_id },
    { header: "Name", accessor: (t) => t.users.full_name },
    { header: "Email", accessor: (t) => t.users.email },
    { header: "Qualification", accessor: (t) => t.qualification ?? "" },
    { header: "Experience (yrs)", accessor: (t) => t.experience_years ?? "" },
    { header: "Class teacher of", accessor: (t) => (t.homeroom ? `${t.homeroom.name} - ${t.homeroom.section}` : "") },
    { header: "Status", accessor: (t) => (t.users.is_active ? "Active" : "Inactive") },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Teachers</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Manage teaching staff, class teacher assignments, subjects, attendance, and leave for your school.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatPill label="Total Teachers" value={stats.total} icon={Users} />
        <StatPill label="Active" value={stats.active} icon={BadgeCheck} />
        <StatPill label="Class Teachers" value={stats.classTeachers} icon={GraduationCap} />
        <StatPill label="Present Today" value={stats.presentToday} icon={Award} />
        <StatPill label="On Leave Today" value={stats.onLeaveToday} icon={CalendarX} />
        <StatPill label="Avg. Experience (yrs)" value={stats.avgExperience} icon={Briefcase} />
      </div>

      <ChartCard
        title="Teaching Staff"
        subtitle={teacherPage ? `${teacherPage.total} total` : undefined}
        legend={
          <div className="flex flex-wrap gap-2">
            <ExportButtons title="Teachers" columns={exportColumns} rows={allTeachers?.items ?? []} filename="teachers" />
            <Button onClick={openAddModal} className="!px-3 !py-1.5 text-xs">
              <Plus size={14} className="mr-1" />
              Add teacher
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or employee ID…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "" | "active" | "inactive");
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ClassSectionSelects
            classes={classes}
            value={classFilter}
            onChange={(next) => {
              setClassFilter(next);
              setPage(1);
            }}
          />
          <SearchableSelect
            label="Subject"
            placeholder="All subjects"
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            value={subjectFilter}
            onChange={(v) => {
              setSubjectFilter(v);
              setPage(1);
            }}
          />
        </div>

        <DataTable
          isLoading={isLoading}
          rows={teacherPage?.items ?? []}
          rowKey={(t) => t.id}
          emptyMessage={debouncedSearch ? "No teachers match your search." : "No teachers yet. Add your first teacher to get started."}
          columns={[
            {
              header: "Name",
              cell: (t) => (
                <button
                  type="button"
                  className="font-medium text-[var(--ink-primary)] hover:underline"
                  onClick={() => navigate(`/dashboard/admin/teachers/${t.id}`)}
                >
                  {t.users.full_name}
                </button>
              ),
            },
            { header: "Employee ID", cell: (t) => t.employee_id },
            {
              header: "Teaching",
              cell: (t) => {
                const subjectCount = t.teaching?.subjectCount ?? 0;
                const classes = t.teaching?.classes ?? [];
                if (subjectCount === 0) return <span className="text-[var(--ink-muted)]">—</span>;
                return (
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => setViewingSubjectsFor(t)}
                  >
                    <div className="text-[var(--ink-primary)]">
                      {subjectCount} subject{subjectCount === 1 ? "" : "s"}
                    </div>
                    <div className="text-xs text-[var(--ink-muted)]">{classes.join(", ")}</div>
                  </button>
                );
              },
            },
            { header: "Experience", cell: (t) => (t.experience_years != null ? `${t.experience_years} yrs` : "—") },
            {
              header: "Class teacher of",
              cell: (t) =>
                t.homeroom ? (
                  <Badge variant="info">
                    {t.homeroom.name} - {t.homeroom.section}
                  </Badge>
                ) : (
                  <span className="text-[var(--ink-muted)]">—</span>
                ),
            },
            {
              header: "Status",
              cell: (t) => (
                <Badge variant={t.users.is_active ? "success" : "neutral"}>
                  {t.users.is_active ? "Active" : "Inactive"}
                </Badge>
              ),
            },
            {
              header: "",
              cell: (t) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    className="!p-1.5"
                    title="View profile"
                    onClick={() => navigate(`/dashboard/admin/teachers/${t.id}`)}
                  >
                    <Eye size={15} />
                  </Button>
                  <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => openEditModal(t)}>
                    <Pencil size={15} />
                  </Button>
                  {t.users.is_active && (
                    <Button
                      variant="ghost"
                      className="!p-1.5 text-red-600"
                      title="Delete"
                      onClick={() => setTeacherPendingDelete(t)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              ),
              className: "text-right",
            },
          ]}
        />

        {teacherPage && teacherPage.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--ink-muted)]">
            <span>
              Page {teacherPage.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="!px-2.5 !py-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                className="!px-2.5 !py-1.5"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </ChartCard>

      <TeacherFormModal
        isOpen={modalMode !== null}
        mode={modalMode ?? "add"}
        teacher={editingTeacher}
        distinctQualifications={distinctQualifications}
        onClose={() => setModalMode(null)}
      />

      <ConfirmDialog
        isOpen={!!teacherPendingDelete}
        title="Delete teacher"
        message={`Delete "${teacherPendingDelete?.users.full_name}"? This deactivates their account and preserves attendance/assignment history — it does not permanently erase records.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => teacherPendingDelete && deleteMutation.mutate(teacherPendingDelete.id)}
        onCancel={() => setTeacherPendingDelete(null)}
      />

      {viewingSubjectsFor && (
        <Modal
          isOpen
          onClose={() => setViewingSubjectsFor(null)}
          title={`${viewingSubjectsFor.users.full_name} — Subjects taught`}
          size="md"
        >
          {isLoadingAssignments ? (
            <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
          ) : viewingAssignments.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No subjects assigned.</p>
          ) : (
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {viewingAssignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-[var(--ink-primary)]">{a.subjects.name}</span>
                  <Badge variant="info">
                    {a.classes.name} - {a.classes.section}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
