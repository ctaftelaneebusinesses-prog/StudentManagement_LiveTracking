import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, GraduationCap, Ban, CheckCircle2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import * as studentsService from "@/services/admin/students.service";
import * as classesService from "@/services/admin/classes.service";
import * as feesService from "@/services/admin/fees.service";
import * as schoolService from "@/services/admin/school.service";
import * as transportService from "@/services/transport.service";
import { getApiErrorMessage } from "@/lib/axios";
import { generateDefaultPassword } from "@/utils/password";
import { digitsOnly, PHONE_PATTERN, AADHAAR_PATTERN } from "@/utils/formHelpers";
import { Student } from "@/types/admin.types";
import { StudentFeeDetail } from "@/types/fees.types";
import {
  INDIAN_STATE_OPTIONS,
  NATIONALITY_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  RELIGION_OPTIONS,
  CATEGORY_OPTIONS,
  getDistrictOptionsForState,
} from "@/utils/indianRegions";
import { BulkImportModal } from "./classes/components/BulkImportModal";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const PAGE_SIZE = 20;

export function StudentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isBulkImportOpen, setBulkImportOpen] = useState(false);
  const [studentPendingDeactivation, setStudentPendingDeactivation] = useState<Student | null>(null);
  const [studentPendingDelete, setStudentPendingDelete] = useState<Student | null>(null);
  const [isBulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [districtOptions, setDistrictOptions] = useState<{ value: string; label: string }[]>([]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "students", { search, classFilter, page }],
    queryFn: () =>
      studentsService.fetchStudents({
        search: search || undefined,
        classId: classFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  // Fee summary per row, reusing the same paginated/filtered query the Fees
  // module already exposes rather than adding a new endpoint. Some roles
  // that can view students don't have fees.view — fail soft (dashes shown)
  // rather than breaking the whole list.
  const { data: feeDetails } = useQuery({
    queryKey: ["admin", "students", "fee-details", { search, classFilter, page }],
    queryFn: () =>
      feesService.fetchStudentFeeDetails({
        search: search || undefined,
        classId: classFilter || undefined,
        status: "all",
        page,
        pageSize: PAGE_SIZE,
      }),
    retry: false,
  });
  const feeByStudentId = new Map<string, StudentFeeDetail>((feeDetails?.items ?? []).map((f) => [f.id, f]));

  const { data: classes = [] } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ["admin", "academic-years"],
    queryFn: schoolService.fetchAcademicYears,
  });
  const currentAcademicYear = academicYears.find((y) => y.is_current);

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));
  // Admission/assignment should default to classes in the current academic
  // year — falls back to the full list if no year is marked current yet so
  // the dropdown is never empty.
  const currentYearClasses = currentAcademicYear
    ? classes.filter((c) => c.academic_year_id === currentAcademicYear.id)
    : classes;
  const currentYearClassOptions = currentYearClasses.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.items ?? [];
  const allOnPageSelected = rows.length > 0 && rows.every((s) => selectedIds.has(s.id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        rows.forEach((s) => next.delete(s.id));
      } else {
        rows.forEach((s) => next.add(s.id));
      }
      return next;
    });
  }

  const { register, handleSubmit, reset, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      email: "",
      full_name: "",
      phone: "",
      password: "",
      admission_no: "",
      roll_no: "",
      class_id: "",
      date_of_birth: "",
      gender: "",
      blood_group: "",
      aadhaar_number: "",
      place_of_birth: "",
      nationality: "Indian",
      nationality_other: "",
      religion: "",
      religion_other: "",
      category: "",
      address: "",
      city: "",
      district: "",
      state: "",
      pin_code: "",
      father_name: "",
      father_phone: "",
      father_email: "",
      father_occupation: "",
      mother_name: "",
      mother_phone: "",
      mother_email: "",
      mother_occupation: "",
      route_id: "",
      pickup_point_id: "",
    },
  });

  const { data: transportRoutes = [] } = useQuery({ queryKey: ["transport", "routes"], queryFn: transportService.fetchRoutes });
  const selectedRouteId = watch("route_id");
  const selectedRoute = transportRoutes.find((r) => r.id === selectedRouteId);
  const routeOptions = transportRoutes.map((r) => ({ value: r.id, label: r.name }));
  const routeStopOptions = [...(selectedRoute?.pickup_points ?? [])].sort((a, b) => a.stop_order - b.stop_order).map((p) => ({ value: p.id, label: p.name }));

  const transportAssignMutation = useMutation({
    mutationFn: ({ studentId, pickup_point_id }: { studentId: string; pickup_point_id: string }) =>
      transportService.assignStudentTransport(studentId, { pickup_point_id }),
  });

  const [parentContactError, setParentContactError] = useState<string | null>(null);

  async function handleStateChange(stateName: string) {
    setValue("state", stateName);
    setValue("district", "");
    setDistrictOptions(await getDistrictOptionsForState(stateName));
  }

  const createMutation = useMutation({
    mutationFn: studentsService.createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      reset();
      setDistrictOptions([]);
      setCreateOpen(false);
      toast.success("Student created successfully");
    },
  });

  function onCreateSubmit(values: Record<string, string>) {
    const hasFather = !!values.father_name && !!values.father_phone;
    const hasMother = !!values.mother_name && !!values.mother_phone;
    if (!hasFather && !hasMother) {
      setParentContactError("Provide at least one parent's name and mobile number (father or mother)");
      return;
    }
    setParentContactError(null);
    const { nationality_other, religion_other, route_id, pickup_point_id, ...rest } = values;
    const payload = {
      ...rest,
      nationality: rest.nationality === "Other" ? nationality_other : rest.nationality,
      religion: rest.religion === "Other" ? religion_other : rest.religion,
    };
    createMutation.mutate(payload as unknown as studentsService.CreateStudentInput, {
      onSuccess: (student) => {
        if (pickup_point_id) {
          transportAssignMutation.mutate({ studentId: student.id, pickup_point_id });
        }
      },
    });
  }

  const deactivateMutation = useMutation({
    mutationFn: studentsService.deactivateStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setStudentPendingDeactivation(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: studentsService.activateStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      toast.success("Student activated");
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: studentsService.permanentlyDeleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setStudentPendingDelete(null);
      toast.success("Student permanently deleted");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => studentsService.bulkDeleteStudents(Array.from(selectedIds)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
      toast.success(`${result.deletedCount} student${result.deletedCount === 1 ? "" : "s"} permanently deleted`);
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

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm({
    defaultValues: { full_name: "", phone: "", roll_no: "", date_of_birth: "", gender: "" },
  });

  const editMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => studentsService.updateStudent(editingStudent!.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setEditingStudent(null);
      toast.success("Student updated");
    },
  });

  function openEdit(student: Student) {
    setEditingStudent(student);
    resetEdit({
      full_name: student.users.full_name,
      phone: student.users.phone ?? "",
      roll_no: student.roll_no ?? "",
      date_of_birth: student.date_of_birth ?? "",
      gender: student.gender ?? "",
    });
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Students</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setBulkImportOpen(true)}>
            <Upload size={16} className="mr-1.5 inline" strokeWidth={1.75} />
            Bulk import
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Add student</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Input
          label="Search"
          placeholder="Search by name, email, or admission number"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Class"
          placeholder="All classes"
          options={classOptions}
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isError ? (
        <ErrorState message={getApiErrorMessage(error, "Failed to load students. Your session may have expired — try refreshing the page.")} onRetry={() => refetch()} />
      ) : (
        <ChartCard
          title="Students"
          subtitle={`${total} student${total === 1 ? "" : "s"}`}
          legend={
            selectedIds.size > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--ink-secondary)]">{selectedIds.size} selected</span>
                <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
                <Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => setBulkDeleteConfirmOpen(true)}>
                  Delete selected
                </Button>
              </div>
            ) : undefined
          }
        >
          <DataTable<Student>
            isLoading={isLoading}
            rows={rows}
            rowKey={(s) => s.id}
            emptyMessage="No students found."
            columns={[
              {
                header: "",
                className: "w-8",
                cell: (s) => (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelected(s.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500 dark:border-white/20"
                  />
                ),
              },
              { header: "Admission No", cell: (s) => s.admission_no },
              {
                header: "Name",
                cell: (s) => (
                  <Link to={`/dashboard/admin/students/${s.id}`} className="flex items-center gap-2 hover:underline">
                    <img
                      src={s.users.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(s.users.full_name)}`}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <span className="text-[var(--ink-primary)]">{s.users.full_name}</span>
                  </Link>
                ),
              },
              { header: "Email", cell: (s) => s.users.email },
              {
                header: "Class",
                cell: (s) => (s.classes ? `${s.classes.name} - ${s.classes.section}` : "Unassigned"),
              },
              {
                header: "Status",
                cell: (s) => (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.users.is_active
                        ? "bg-[var(--status-good)]/10 text-[var(--status-good)]"
                        : "bg-black/[0.04] text-[var(--ink-muted)] dark:bg-white/[0.06]"
                    }`}
                  >
                    {s.users.is_active ? "Active" : "Inactive"}
                  </span>
                ),
              },
              {
                header: "Fee due",
                cell: (s) => {
                  const fee = feeByStudentId.get(s.id);
                  if (!fee) return "—";
                  return (
                    <div className="text-xs">
                      <p className="text-[var(--ink-muted)]">
                        ₹{fee.paid.toFixed(0)} / ₹{fee.due.toFixed(0)}
                      </p>
                      <p className={fee.balance > 0 ? "font-medium text-[var(--status-serious)]" : "font-medium text-[var(--status-good)]"}>
                        {fee.balance > 0 ? `₹${fee.balance.toFixed(0)} due` : fee.balance < 0 ? `₹${Math.abs(fee.balance).toFixed(0)} credit` : "Paid up"}
                      </p>
                    </div>
                  );
                },
              },
              {
                header: "",
                cell: (s) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      className="!p-1.5"
                      title="View profile"
                      onClick={() => navigate(`/dashboard/admin/students/${s.id}`)}
                    >
                      <Eye size={15} strokeWidth={1.75} />
                    </Button>
                    <Button variant="ghost" className="!p-1.5" title="Edit" onClick={() => openEdit(s)}>
                      <Pencil size={15} strokeWidth={1.75} />
                    </Button>
                    <Button variant="ghost" className="!p-1.5" title="Assign class" onClick={() => setAssigningStudent(s)}>
                      <GraduationCap size={15} strokeWidth={1.75} />
                    </Button>
                    {s.users.is_active ? (
                      <Button
                        variant="ghost"
                        className="!p-1.5 text-[var(--status-warning)]"
                        title="Deactivate"
                        onClick={() => setStudentPendingDeactivation(s)}
                      >
                        <Ban size={15} strokeWidth={1.75} />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        className="!p-1.5 text-[var(--status-good)]"
                        title="Activate"
                        onClick={() => activateMutation.mutate(s.id)}
                      >
                        <CheckCircle2 size={15} strokeWidth={1.75} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="!p-1.5 text-red-600"
                      title="Delete permanently"
                      onClick={() => setStudentPendingDelete(s)}
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </Button>
                  </div>
                ),
                className: "text-right",
              },
            ]}
          />

          {rows.length > 0 && (
            <label className="mt-3 flex items-center gap-2 text-xs text-[var(--ink-muted)]">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleSelectAllOnPage}
                className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500 dark:border-white/20"
              />
              Select all on this page
            </label>
          )}

          {total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--ink-muted)]">
              <p>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="self-center">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  className="!px-3 !py-1 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </ChartCard>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setCreateOpen(false);
          setParentContactError(null);
        }}
        title="Add student"
        size="xl"
      >
        <form className="space-y-6" onSubmit={handleSubmit(onCreateSubmit)}>
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Account</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Input
                label="Phone (optional)"
                inputMode="numeric"
                error={errors.phone?.message}
                {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
              />
              <Input
                label="Admission number"
                error={errors.admission_no?.message}
                {...register("admission_no", { required: "Admission number is required" })}
              />
              <Input label="Roll number (optional)" {...register("roll_no")} />
              <Select
                label="Class (optional)"
                placeholder="Unassigned"
                options={currentYearClassOptions}
                {...register("class_id")}
              />
            </div>
            <PasswordField
              value={watch("password")}
              onChange={(v) => setValue("password", v)}
              onGenerate={() =>
                setValue("password", generateDefaultPassword(getValues("full_name"), getValues("roll_no") || getValues("admission_no")))
              }
              error={errors.password?.message}
            />
          </section>

          <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Personal information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Date of birth" type="date" {...register("date_of_birth")} />
              <Select label="Gender" placeholder="Select gender" options={GENDER_OPTIONS} {...register("gender")} />
              <Select
                label="Blood group (optional)"
                placeholder="Select blood group"
                options={BLOOD_GROUP_OPTIONS}
                {...register("blood_group")}
              />
              <Input
                label="Aadhaar number (optional)"
                inputMode="numeric"
                placeholder="12-digit Aadhaar number"
                error={errors.aadhaar_number?.message}
                {...digitsOnly(register("aadhaar_number", { pattern: AADHAAR_PATTERN }), 12)}
              />
              <Input label="Place of birth" {...register("place_of_birth")} />
              <Select label="Nationality" options={NATIONALITY_OPTIONS} {...register("nationality")} />
              {watch("nationality") === "Other" && (
                <Input label="Specify nationality" {...register("nationality_other")} />
              )}
              <SearchableSelect
                label="Religion (optional)"
                placeholder="Select religion"
                options={RELIGION_OPTIONS}
                value={watch("religion")}
                onChange={(v) => setValue("religion", v)}
              />
              {watch("religion") === "Other" && (
                <Input label="Specify religion" {...register("religion_other")} />
              )}
              <Select
                label="Category (optional)"
                placeholder="Select category"
                options={CATEGORY_OPTIONS}
                {...register("category")}
              />
              <Input label="Residential address" {...register("address")} />
              <SearchableSelect
                label="State"
                placeholder="Select state"
                options={INDIAN_STATE_OPTIONS}
                value={watch("state")}
                onChange={handleStateChange}
              />
              <SearchableSelect
                label="District"
                placeholder={watch("state") ? "Select district" : "Select a state first"}
                options={districtOptions}
                value={watch("district")}
                onChange={(v) => setValue("district", v)}
                disabled={!watch("state")}
              />
              <Input label="City / Town" placeholder="Not listed under District? Type it here" {...register("city")} />
              <Input label="PIN code" {...register("pin_code")} />
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Transport (optional)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Route"
                placeholder="No transport required"
                options={routeOptions}
                {...register("route_id", {
                  onChange: () => setValue("pickup_point_id", ""),
                })}
              />
              <Select
                label="Stop"
                placeholder="Select a stop"
                options={routeStopOptions}
                disabled={!selectedRouteId}
                {...register("pickup_point_id")}
              />
              {selectedRoute && (
                <div className="flex flex-col justify-center text-xs text-slate-500 dark:text-slate-400">
                  <span>Vehicle: {selectedRoute.vehicle ? (selectedRoute.vehicle.name || selectedRoute.vehicle.vehicle_number) : "Not yet assigned"}</span>
                  <span>Driver: {selectedRoute.primary_driver?.users.full_name ?? "Not yet assigned"}</span>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Parent information
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              At least one parent's name and mobile number is required.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Father</h4>
                <Input label="Father name" {...register("father_name")} />
                <Input
                  label="Mobile number"
                  inputMode="numeric"
                  error={errors.father_phone?.message}
                  {...digitsOnly(register("father_phone", { pattern: PHONE_PATTERN }), 10)}
                />
                <Input label="Email (optional)" type="email" {...register("father_email")} />
                <Input label="Occupation" {...register("father_occupation")} />
              </div>
              <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Mother</h4>
                <Input label="Mother name" {...register("mother_name")} />
                <Input
                  label="Mobile number"
                  inputMode="numeric"
                  error={errors.mother_phone?.message}
                  {...digitsOnly(register("mother_phone", { pattern: PHONE_PATTERN }), 10)}
                />
                <Input label="Email (optional)" type="email" {...register("mother_email")} />
                <Input label="Occupation" {...register("mother_occupation")} />
              </div>
            </div>
            {parentContactError && <p className="text-sm text-red-600">{parentContactError}</p>}
          </section>

          {createMutation.isError && (
            <p className="text-sm text-red-600">
              {getApiErrorMessage(createMutation.error, "Failed to create student. Please try again.")}
            </p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting || createMutation.isPending}>
            Create student
          </Button>
        </form>
      </Modal>

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        classes={classes}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["admin", "students"] })}
      />

      <Modal isOpen={!!assigningStudent} onClose={() => setAssigningStudent(null)} title="Assign class">
        <div className="space-y-4">
          <Select
            label="Class"
            placeholder="Select a class"
            options={currentYearClassOptions}
            onChange={(e) => {
              if (assigningStudent && e.target.value) {
                assignClassMutation.mutate({ id: assigningStudent.id, classId: e.target.value });
              }
            }}
            defaultValue={assigningStudent?.class_id ?? ""}
          />
          {assignClassMutation.isPending && <p className="text-sm text-slate-500 dark:text-slate-400">Saving...</p>}
        </div>
      </Modal>

      <Modal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} title="Edit student">
        <form className="space-y-4" onSubmit={handleSubmitEdit((values) => editMutation.mutate(values))}>
          <Input label="Full name" {...registerEdit("full_name", { required: true })} />
          <Input
            label="Phone"
            inputMode="numeric"
            error={editErrors.phone?.message}
            {...digitsOnly(registerEdit("phone", { pattern: PHONE_PATTERN }), 10)}
          />
          <Input label="Roll number" {...registerEdit("roll_no")} />
          <Input label="Date of birth" type="date" {...registerEdit("date_of_birth")} />
          <Select label="Gender" placeholder="Select gender" options={GENDER_OPTIONS} {...registerEdit("gender")} />
          {editMutation.isError && (
            <p className="text-sm text-red-600">
              {getApiErrorMessage(editMutation.error, "Failed to update student. Please try again.")}
            </p>
          )}
          <Button type="submit" className="w-full" isLoading={isEditSubmitting || editMutation.isPending}>
            Save changes
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!studentPendingDeactivation}
        title="Deactivate student"
        message={`Are you sure you want to deactivate ${studentPendingDeactivation?.users.full_name}? They can be reactivated later.`}
        confirmLabel="Deactivate"
        isLoading={deactivateMutation.isPending}
        onConfirm={() =>
          studentPendingDeactivation && deactivateMutation.mutate(studentPendingDeactivation.id)
        }
        onCancel={() => setStudentPendingDeactivation(null)}
      />

      <ConfirmDialog
        isOpen={!!studentPendingDelete}
        title="Permanently delete student"
        message={`This will permanently remove ${studentPendingDelete?.users.full_name} and all associated records (attendance, marks, fee history, documents). This cannot be undone.`}
        confirmLabel="Delete permanently"
        isLoading={permanentDeleteMutation.isPending}
        onConfirm={() => studentPendingDelete && permanentDeleteMutation.mutate(studentPendingDelete.id)}
        onCancel={() => setStudentPendingDelete(null)}
      />

      <ConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        title="Permanently delete selected students"
        message={`This will permanently remove ${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"} and all their associated records. This cannot be undone.`}
        confirmLabel="Delete permanently"
        isLoading={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate()}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
      />
    </div>
  );
}
