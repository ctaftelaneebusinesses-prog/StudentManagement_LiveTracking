import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import { digitsOnly, PHONE_PATTERN } from "@/utils/formHelpers";
import { generateDefaultPassword } from "@/utils/password";
import { resolveClassId } from "@/utils/classPicker";
import { ClassSectionValue, ClassSectionSelects } from "@/pages/admin/teachers/components/ClassSectionSelects";
import { RegistrationMeta, RegistrationResult, submitRegistration } from "@/services/registration.service";

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  employee_id: string;
  qualification: string;
  experience_years: string;
  joining_date: string;
}

const EMPTY_CLASS_SECTION: ClassSectionValue = { academicYearId: "", className: "", section: "" };

interface SubjectRow extends ClassSectionValue {
  key: string;
  subjectId: string;
}

function newSubjectRow(): SubjectRow {
  return { key: Math.random().toString(36).slice(2), ...EMPTY_CLASS_SECTION, subjectId: "" };
}

/**
 * Mirrors the admin's "Add teacher" form exactly (TeacherFormModal.tsx):
 * "Is class teacher?" is one independent Yes/No toggle (+ homeroom class
 * picker when Yes) — it does NOT restrict Subjects Assigned, which is
 * always the same free-form class+subject repeater either way, since a
 * class teacher may still teach a subject in a class other than their own
 * homeroom.
 */
export function TeacherForm({ meta, onSuccess }: { meta: RegistrationMeta; onSuccess: (r: RegistrationResult) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [homeroom, setHomeroom] = useState<ClassSectionValue>(EMPTY_CLASS_SECTION);
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([newSubjectRow()]);
  const [subjectRowsError, setSubjectRowsError] = useState<string | null>(null);

  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const subjectOptions = meta.subjects.map((s) => ({ value: s.id, label: s.name }));

  function updateSubjectRow(key: string, patch: Partial<SubjectRow>) {
    setSubjectRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeSubjectRow(key: string) {
    setSubjectRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubjectRowsError(null);

    let homeroom_class_id: string | undefined;
    if (isClassTeacher) {
      homeroom_class_id = resolveClassId(meta.classes, homeroom.academicYearId, homeroom.className, homeroom.section);
      if (!homeroom_class_id) {
        setSubjectRowsError("Select the Academic Year, Class, and Section you'll be class teacher for.");
        return;
      }
    }

    const resolved = subjectRows.map((row) => ({
      class_id: resolveClassId(meta.classes, row.academicYearId, row.className, row.section),
      subject_id: row.subjectId,
    }));
    if (resolved.some((r) => !r.class_id || !r.subject_id)) {
      setSubjectRowsError("Complete every subject row (Academic Year, Class, Section, and Subject) or remove it.");
      return;
    }
    const assignments = resolved as { class_id: string; subject_id: string }[];

    try {
      const result = await submitRegistration("teacher", {
        school_code: meta.school.code,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone || undefined,
        password: password || undefined,
        employee_id: values.employee_id,
        qualification: values.qualification || undefined,
        experience_years: values.experience_years ? Number(values.experience_years) : undefined,
        joining_date: values.joining_date || undefined,
        is_class_teacher: isClassTeacher,
        homeroom_class_id,
        assignments,
      });
      onSuccess(result);
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Couldn't submit your registration."));
    }
  }

  return (
    <form className="space-y-1" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Teacher registration</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Sent to your Principal for approval.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Full name" error={errors.full_name?.message} {...register("full_name", { required: "Full name is required" })} />
        <Input label="Email" type="email" error={errors.email?.message} {...register("email", { required: "Email is required" })} />
        <Input
          label="Mobile number (optional)"
          inputMode="numeric"
          error={errors.phone?.message}
          {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
        />
        <Input label="Employee ID" error={errors.employee_id?.message} {...register("employee_id", { required: "Employee ID is required" })} />
        <Input label="Qualification (optional)" {...register("qualification")} />
        <Input label="Experience (years, optional)" type="number" min={0} max={80} {...register("experience_years")} />
        <Input label="Joining date (optional)" type="date" {...register("joining_date")} />
      </div>

      <div className="mt-6 flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-white/10">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Is class teacher?</h3>
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
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3 dark:bg-white/[0.03]">
          <ClassSectionSelects classes={meta.classes} value={homeroom} onChange={setHomeroom} />
        </div>
      )}

      <h3 className="mt-6 border-b border-slate-200 pb-1.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
        Subjects assigned
      </h3>
      <div className="mt-3 space-y-3">
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
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <ClassSectionSelects classes={meta.classes} value={row} onChange={(next) => updateSubjectRow(row.key, next)} />
              <SearchableSelect
                label="Subject"
                placeholder="Select subject"
                options={subjectOptions}
                value={row.subjectId}
                onChange={(subjectId) => updateSubjectRow(row.key, { subjectId })}
              />
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" className="mt-3 text-xs" onClick={() => setSubjectRows((rows) => [...rows, newSubjectRow()])}>
        <Plus className="h-3.5 w-3.5" /> Add another subject
      </Button>

      {subjectRowsError && <p className="mt-2 text-sm text-red-600">{subjectRowsError}</p>}

      <div className="mt-4">
        <PasswordField
          value={password}
          onChange={setPassword}
          onGenerate={() => setPassword(generateDefaultPassword(getValues("full_name"), getValues("employee_id")))}
        />
      </div>

      {serverError && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {serverError}
        </p>
      )}

      <Button type="submit" className="mt-6 w-full" isLoading={isSubmitting}>
        Submit registration
      </Button>
    </form>
  );
}
