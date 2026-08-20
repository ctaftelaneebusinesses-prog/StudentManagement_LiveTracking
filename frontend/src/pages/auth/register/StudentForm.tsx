import { useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import { digitsOnly, PHONE_PATTERN } from "@/utils/formHelpers";
import { generateDefaultPassword } from "@/utils/password";
import { resolveClassId } from "@/utils/classPicker";
import { ClassSectionValue, ClassSectionSelects } from "@/pages/admin/teachers/components/ClassSectionSelects";
import { RegistrationMeta, RegistrationResult, submitRegistration } from "@/services/registration.service";
import { GENDER_OPTIONS, FormSectionHeading, FormGrid } from "./formShared";

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  gender: string;
  father_name: string;
  roll_no: string;
}

export function StudentForm({ meta, onSuccess }: { meta: RegistrationMeta; onSuccess: (r: RegistrationResult) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [classSection, setClassSection] = useState<ClassSectionValue>({ academicYearId: "", className: "", section: "" });
  const [classError, setClassError] = useState<string | null>(null);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setClassError(null);

    const class_id = resolveClassId(meta.classes, classSection.academicYearId, classSection.className, classSection.section);
    if (!class_id) {
      setClassError("Select your Academic Year, Class, and Section.");
      return;
    }

    try {
      const result = await submitRegistration("student", {
        school_code: meta.school.code,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: password || undefined,
        class_id,
        gender: values.gender,
        father_name: values.father_name,
        father_phone: values.phone,
        roll_no: values.roll_no,
      });
      onSuccess(result);
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Couldn't submit your registration."));
    }
  }

  return (
    <form className="space-y-1" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Student registration</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sent to your Class Teacher for approval (or your School Admin, if one isn't assigned yet). You can fill in the rest of your profile after logging in.
      </p>

      <FormSectionHeading>Student &amp; parent details</FormSectionHeading>
      <FormGrid>
        <Input label="Student name" error={errors.full_name?.message} {...register("full_name", { required: "Student name is required" })} />
        <Input label="Parent name" error={errors.father_name?.message} {...register("father_name", { required: "Parent name is required" })} />
        <Input label="Roll number" error={errors.roll_no?.message} {...register("roll_no", { required: "Roll number is required" })} />
        <Input
          label="Mobile number"
          inputMode="numeric"
          error={errors.phone?.message}
          {...digitsOnly(register("phone", { required: "Mobile number is required", pattern: PHONE_PATTERN }), 10)}
        />
        <Input label="Email" type="email" error={errors.email?.message} {...register("email", { required: "Email is required" })} />
        <Select
          label="Gender"
          options={GENDER_OPTIONS}
          placeholder="Select gender"
          error={errors.gender?.message}
          {...register("gender", { required: "Gender is required" })}
        />
      </FormGrid>

      <FormSectionHeading>Class &amp; section</FormSectionHeading>
      <FormGrid>
        <ClassSectionSelects classes={meta.classes} value={classSection} onChange={setClassSection} />
      </FormGrid>
      {classError && <p className="mt-2 text-sm text-red-600">{classError}</p>}

      <div className="mt-4">
        <PasswordField
          value={password}
          onChange={setPassword}
          onGenerate={() => setPassword(generateDefaultPassword(watch("father_name"), watch("roll_no")))}
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
