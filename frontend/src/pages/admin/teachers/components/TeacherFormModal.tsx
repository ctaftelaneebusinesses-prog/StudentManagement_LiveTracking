import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import * as teachersService from "@/services/admin/teachers.service";
import * as classesService from "@/services/admin/classes.service";
import { Teacher } from "@/types/admin.types";
import { getApiErrorMessage } from "@/lib/axios";
import { generateDefaultPassword } from "@/utils/password";
import { resolveClassId } from "@/utils/classPicker";
import { digitsOnly, PHONE_PATTERN } from "@/utils/formHelpers";
import { ClassSectionSelects, ClassSectionValue } from "./ClassSectionSelects";

interface TeacherFormValues {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  employee_id: string;
  qualification: string;
  joining_date: string;
  experience_years: string;
}

const EMPTY_FORM: TeacherFormValues = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  employee_id: "",
  qualification: "",
  joining_date: "",
  experience_years: "",
};

const EMPTY_CLASS_SECTION: ClassSectionValue = { academicYearId: "", className: "", section: "" };

interface SubjectRow extends ClassSectionValue {
  key: string;
  subjectId: string;
}

function newSubjectRow(): SubjectRow {
  return { key: Math.random().toString(36).slice(2), ...EMPTY_CLASS_SECTION, subjectId: "" };
}

interface TeacherFormModalProps {
  isOpen: boolean;
  mode: "add" | "edit";
  teacher: Teacher | null;
  distinctQualifications: string[];
  onClose: () => void;
}

/**
 * Add/Edit teacher form: personal details (unchanged from the original
 * inline modal) plus the new Class Teacher toggle and, for new teachers, a
 * required Subject Assignment repeater. Personal-field create/update calls
 * are unchanged; homeroom + subject assignment are separate follow-up calls
 * (no cross-table DB transaction available), so a failure after the teacher
 * record is created keeps the modal open against that same teacher instead
 * of losing the form.
 */
export function TeacherFormModal({ isOpen, mode, teacher, distinctQualifications, onClose }: TeacherFormModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const { data: subjects = [] } = useQuery({ queryKey: ["admin", "subjects"], queryFn: classesService.fetchSubjects });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<TeacherFormValues>({ defaultValues: EMPTY_FORM });

  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [homeroom, setHomeroom] = useState<ClassSectionValue>(EMPTY_CLASS_SECTION);
  const [homeroomConflict, setHomeroomConflict] = useState<string | null>(null);
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([newSubjectRow()]);
  const [subjectRowsError, setSubjectRowsError] = useState<string | null>(null);
  const [savedTeacherId, setSavedTeacherId] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Re-seed all local state whenever the modal opens for a given teacher.
  useEffect(() => {
    if (!isOpen) return;
    if (teacher) {
      reset({
        full_name: teacher.users.full_name,
        email: teacher.users.email,
        phone: teacher.users.phone ?? "",
        employee_id: teacher.employee_id,
        qualification: teacher.qualification ?? "",
        joining_date: teacher.joining_date?.slice(0, 10) ?? "",
        experience_years: teacher.experience_years != null ? String(teacher.experience_years) : "",
      });
      if (teacher.homeroom) {
        setIsClassTeacher(true);
        setHomeroom({
          academicYearId: teacher.homeroom.academic_year_id,
          className: teacher.homeroom.name,
          section: teacher.homeroom.section,
        });
      } else {
        setIsClassTeacher(false);
        setHomeroom(EMPTY_CLASS_SECTION);
      }
      setSavedTeacherId(teacher.id);
    } else {
      reset(EMPTY_FORM);
      setIsClassTeacher(false);
      setHomeroom(EMPTY_CLASS_SECTION);
      setSavedTeacherId(null);
    }
    setSubjectRows([newSubjectRow()]);
    setSubjectRowsError(null);
    setHomeroomConflict(null);
    setSaveError(null);
  }, [isOpen, teacher, reset]);

  function invalidateTeachers() {
    queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
  }

  function updateSubjectRow(key: string, patch: Partial<SubjectRow>) {
    setSubjectRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeSubjectRow(key: string) {
    setSubjectRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  async function saveHomeroom(teacherId: string, force: boolean): Promise<boolean> {
    setHomeroomConflict(null);
    if (!isClassTeacher) {
      if (teacher?.homeroom) await teachersService.clearHomeroomTeacher(teacherId);
      return true;
    }
    const classId = resolveClassId(classes, homeroom.academicYearId, homeroom.className, homeroom.section);
    if (!classId) {
      setSaveError("Select an academic year, class, and section for the class teacher assignment.");
      return false;
    }
    try {
      await teachersService.setHomeroomTeacher(teacherId, classId, force);
      return true;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setHomeroomConflict(getApiErrorMessage(err, "This class already has a class teacher."));
        return false;
      }
      throw err;
    }
  }

  async function saveSubjects(teacherId: string): Promise<boolean> {
    if (mode !== "add") return true;

    const resolved = subjectRows.map((row) => ({
      row,
      classId: resolveClassId(classes, row.academicYearId, row.className, row.section),
    }));
    if (resolved.some((r) => !r.classId || !r.row.subjectId)) {
      setSubjectRowsError("Complete every subject row (academic year, class, section, and subject) before saving.");
      return false;
    }
    const keys = resolved.map((r) => `${r.classId}:${r.row.subjectId}`);
    if (new Set(keys).size !== keys.length) {
      setSubjectRowsError(
        "Remove the duplicate subject assignment rows — each class + subject combination can only appear once."
      );
      return false;
    }

    try {
      await teachersService.bulkAssignSubjects(
        teacherId,
        resolved.map((r) => ({ class_id: r.classId!, subject_id: r.row.subjectId }))
      );
      return true;
    } catch (err) {
      setSubjectRowsError(getApiErrorMessage(err, "Failed to save subject assignments."));
      return false;
    }
  }

  async function onSubmit(values: TeacherFormValues, forceHomeroom = false) {
    setSaveError(null);
    setSubjectRowsError(null);
    if (mode === "add" && subjectRows.every((r) => !r.subjectId)) {
      setSubjectRowsError("Add at least one subject assignment.");
      return;
    }

    setSaving(true);
    try {
      let teacherId = savedTeacherId;
      if (!teacherId) {
        const created = await teachersService.createTeacher({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone || undefined,
          password: values.password || undefined,
          employee_id: values.employee_id,
          qualification: values.qualification || undefined,
          joining_date: values.joining_date || undefined,
          experience_years: values.experience_years ? Number(values.experience_years) : undefined,
        });
        teacherId = created.id;
        setSavedTeacherId(teacherId);
      } else {
        await teachersService.updateTeacher(teacherId, {
          full_name: values.full_name,
          phone: values.phone || undefined,
          qualification: values.qualification || undefined,
          experience_years: values.experience_years ? Number(values.experience_years) : undefined,
        });
      }

      const homeroomOk = await saveHomeroom(teacherId, forceHomeroom);
      if (!homeroomOk) return;

      const subjectsOk = await saveSubjects(teacherId);
      if (!subjectsOk) return;

      invalidateTeachers();
      toast.success(mode === "add" ? "Teacher added successfully." : "Teacher updated successfully.");
      onClose();
    } catch (err) {
      setSaveError(getApiErrorMessage(err, mode === "edit" ? "Failed to update teacher." : "Failed to create teacher."));
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "edit" ? "Edit teacher" : "Add teacher";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <form className="space-y-6" onSubmit={handleSubmit((values) => onSubmit(values))}>
        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Personal details
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              error={errors.full_name?.message}
              {...register("full_name", { required: "Full name is required" })}
            />
            <Input
              label="Email"
              type="email"
              disabled={mode === "edit"}
              error={errors.email?.message}
              {...register("email", { required: mode !== "edit" && "Email is required" })}
            />
            <Input
              label="Phone (optional)"
              inputMode="numeric"
              error={errors.phone?.message}
              {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
            />
            <Input
              label="Employee ID"
              disabled={mode === "edit"}
              error={errors.employee_id?.message}
              {...register("employee_id", { required: mode !== "edit" && "Employee ID is required" })}
            />
            <div>
              <Input label="Qualification (optional)" list="existing-qualifications" {...register("qualification")} />
              <datalist id="existing-qualifications">
                {distinctQualifications.map((q) => (
                  <option key={q} value={q} />
                ))}
              </datalist>
            </div>
            <Input label="Experience (years, optional)" type="number" min={0} max={80} {...register("experience_years")} />
            {mode !== "edit" && <Input label="Joining date (optional)" type="date" {...register("joining_date")} />}
          </div>
          {mode !== "edit" && (
            <PasswordField
              value={watch("password")}
              onChange={(v) => setValue("password", v)}
              onGenerate={() =>
                setValue("password", generateDefaultPassword(getValues("full_name"), getValues("employee_id")))
              }
            />
          )}
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Is class teacher?
            </h3>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs font-medium dark:border-white/20">
              <button
                type="button"
                onClick={() => setIsClassTeacher(true)}
                className={`px-3 py-1.5 transition-colors ${
                  isClassTeacher ? "bg-brand-600 text-white" : "bg-white text-slate-600 dark:bg-white/5 dark:text-slate-300"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIsClassTeacher(false)}
                className={`px-3 py-1.5 transition-colors ${
                  !isClassTeacher ? "bg-brand-600 text-white" : "bg-white text-slate-600 dark:bg-white/5 dark:text-slate-300"
                }`}
              >
                No
              </button>
            </div>
          </div>

          {isClassTeacher && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-4 dark:bg-white/[0.03]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ClassSectionSelects classes={classes} value={homeroom} onChange={setHomeroom} />
              </div>
              {homeroomConflict && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-300">
                  <span>{homeroomConflict}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!px-2 !py-1 text-xs shrink-0"
                    onClick={handleSubmit((values) => onSubmit(values, true))}
                  >
                    Reassign anyway
                  </Button>
                </div>
              )}
            </div>
          )}

          {mode === "edit" && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Subjects Assigned are managed from this teacher's profile page.
            </p>
          )}
        </section>

        {mode === "add" && (
          <section className="space-y-3 border-t border-slate-100 pt-5 dark:border-white/10">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Subjects Assigned
            </h3>
            <div className="space-y-3">
              {subjectRows.map((row, i) => (
                <div key={row.key} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Assignment {i + 1}</span>
                    {subjectRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSubjectRow(row.key)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Remove assignment"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <ClassSectionSelects
                      classes={classes}
                      value={row}
                      onChange={(next) => updateSubjectRow(row.key, next)}
                    />
                    <SearchableSelect
                      label="Subject"
                      placeholder="Select subject"
                      options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                      value={row.subjectId}
                      onChange={(subjectId) => updateSubjectRow(row.key, { subjectId })}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => setSubjectRows((rows) => [...rows, newSubjectRow()])}
            >
              <Plus size={14} className="mr-1" />
              Add another subject
            </Button>
            {subjectRowsError && <p className="text-sm text-red-600">{subjectRowsError}</p>}
          </section>
        )}

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <Button type="submit" className="w-full" isLoading={isSaving}>
          {mode === "edit" ? "Save changes" : "Create"}
        </Button>
      </form>
    </Modal>
  );
}
