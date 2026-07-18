import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requestPasswordReset } from "@/services/auth.service";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordValues) {
    setServerError(null);
    try {
      await requestPasswordReset(values.email);
      // Always show the same confirmation regardless of whether the email
      // exists — avoids leaking which addresses are registered.
      setSubmitted(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Forgot password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your account email and we'll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-700">
              If that email is registered, a password reset link has been sent.
            </p>
            <Link to="/login" className="text-sm font-medium text-brand-600 hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            {serverError && (
              <p role="alert" className="text-sm text-red-600">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Send reset link
            </Button>
            <Link
              to="/login"
              className="block text-center text-sm font-medium text-brand-600 hover:underline"
            >
              Back to login
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}
