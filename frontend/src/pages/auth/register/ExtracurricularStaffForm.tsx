import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Textarea } from "@/components/ui/Textarea";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import { digitsOnly, PHONE_PATTERN } from "@/utils/formHelpers";
import { generateDefaultPassword } from "@/utils/password";
import { RegistrationMeta, RegistrationResult, submitRegistration } from "@/services/registration.service";
import { GENDER_OPTIONS } from "./formShared";

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  staff_type_activity_id: string;
  qualification: string;
  experience_years: string;
  date_of_birth: string;
  gender: string;
  address: string;
}

export function ExtracurricularStaffForm({ meta, onSuccess }: { meta: RegistrationMeta; onSuccess: (r: RegistrationResult) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const {
    register,
    control,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const staffTypeOptions = meta.activities.map((a) => ({ value: a.id, label: a.staff_title }));

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const result = await submitRegistration("extracurricular_staff", {
        school_code: meta.school.code,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone || undefined,
        password: password || undefined,
        staff_type_activity_id: values.staff_type_activity_id,
        qualification: values.qualification || undefined,
        experience_years: values.experience_years ? Number(values.experience_years) : undefined,
        date_of_birth: values.date_of_birth || undefined,
        gender: values.gender || undefined,
        address: values.address || undefined,
      });
      onSuccess(result);
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Couldn't submit your registration."));
    }
  }

  return (
    <form className="space-y-1" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Extracurricular Staff registration</h2>
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
        <Controller
          name="staff_type_activity_id"
          control={control}
          rules={{ required: "Staff type is required" }}
          render={({ field }) => (
            <SearchableSelect
              label="Staff type"
              placeholder="e.g. Dance Teacher, Yoga Instructor"
              options={staffTypeOptions}
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors.staff_type_activity_id?.message}
            />
          )}
        />
        <Select label="Gender (optional)" options={GENDER_OPTIONS} placeholder="Select gender" {...register("gender")} />
        <Controller
          name="date_of_birth"
          control={control}
          render={({ field }) => <DatePicker label="Date of birth (optional)" value={field.value ?? ""} onChange={field.onChange} />}
        />
        <Input label="Qualification (optional)" {...register("qualification")} />
        <Input label="Experience (years, optional)" type="number" min={0} max={80} {...register("experience_years")} />
      </div>
      <div className="mt-4">
        <Textarea label="Address (optional)" rows={2} {...register("address")} />
      </div>

      <div className="mt-4">
        <PasswordField value={password} onChange={setPassword} onGenerate={() => setPassword(generateDefaultPassword(getValues("full_name")))} />
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
