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
  password: string;
}

export function PrincipalForm({ meta, onSuccess }: { meta: RegistrationMeta; onSuccess: (r: RegistrationResult) => void }) {
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
      const result = await submitRegistration("principal", {
        school_code: meta.school.code,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone || undefined,
        password: password || undefined,
      });
      onSuccess(result);
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Couldn't submit your registration."));
    }
  }

  return (
    <form className="space-y-1" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Principal registration</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Sent to your School Admin for approval.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Full name" error={errors.full_name?.message} {...register("full_name", { required: "Full name is required" })} />
        <Input label="Email" type="email" error={errors.email?.message} {...register("email", { required: "Email is required" })} />
        <Input
          label="Mobile number (optional)"
          inputMode="numeric"
          error={errors.phone?.message}
          {...digitsOnly(register("phone", { pattern: PHONE_PATTERN }), 10)}
        />
      </div>

      <div className="mt-4">
        <PasswordField
          value={password}
          onChange={setPassword}
          onGenerate={() => setPassword(generateDefaultPassword(getValues("full_name"), getValues("phone")))}
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
