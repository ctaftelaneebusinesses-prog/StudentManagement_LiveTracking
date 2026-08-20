import { useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/axios";
import { digitsOnly, PHONE_PATTERN } from "@/utils/formHelpers";
import { generateDefaultPassword } from "@/utils/password";
import { RegistrationMeta, RegistrationResult, submitRegistration } from "@/services/registration.service";

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  employee_id: string;
}

/**
 * Simplified self-registration — subject assignments and the "is class
 * teacher?" homeroom pick (still in the admin's own "Add teacher" form,
 * TeacherFormModal.tsx) are assigned afterward by the Admin/Principal from
 * Teachers management, not collected up front here.
 */
export function TeacherForm({ meta, onSuccess }: { meta: RegistrationMeta; onSuccess: (r: RegistrationResult) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  async function onSubmit(values: FormValues) {
    setServerError(null);

    try {
      const result = await submitRegistration("teacher", {
        school_code: meta.school.code,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: password || undefined,
        employee_id: values.employee_id,
      });
      onSuccess(result);
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Couldn't submit your registration."));
    }
  }

  return (
    <form className="space-y-1" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Teacher registration</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sent to your Principal for approval. Your subjects and homeroom class are assigned by your Admin/Principal afterward; you can fill in the rest of your profile from My Profile after logging in.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Full name" error={errors.full_name?.message} {...register("full_name", { required: "Full name is required" })} />
        <Input label="Email" type="email" error={errors.email?.message} {...register("email", { required: "Email is required" })} />
        <Input
          label="Mobile number"
          inputMode="numeric"
          error={errors.phone?.message}
          {...digitsOnly(register("phone", { required: "Mobile number is required", pattern: PHONE_PATTERN }), 10)}
        />
        <Input label="Employee ID" error={errors.employee_id?.message} {...register("employee_id", { required: "Employee ID is required" })} />
      </div>

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
