import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabaseClient";
import { completePasswordReset } from "@/services/auth.service";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * Reached via the emailed reset link. supabase-js's detectSessionInUrl
 * already parses the recovery token from the URL and establishes a session
 * before this component mounts, so we just confirm a session exists.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(!!data.session);
    });
  }, []);

  async function onSubmit(values: ResetPasswordValues) {
    setServerError(null);
    try {
      await completePasswordReset(values.password);
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unable to reset password");
    }
  }

  if (hasRecoverySession === null) {
    return <Spinner label="Verifying reset link..." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Reset password</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>
        </div>

        {!hasRecoverySession && (
          <p className="text-sm text-red-600">
            This reset link is invalid or has expired. Please request a new one.
          </p>
        )}

        {hasRecoverySession && success && (
          <p className="text-sm text-green-600">Password updated. Redirecting to login...</p>
        )}

        {hasRecoverySession && !success && (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />

            {serverError && (
              <p role="alert" className="text-sm text-red-600">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Update password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
