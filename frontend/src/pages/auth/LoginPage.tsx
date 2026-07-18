import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ROLE_HOME_ROUTE } from "@/utils/roles";

const loginFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema) });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const profile = await login(values.email, values.password);
      const destination = profile ? ROLE_HOME_ROUTE[profile.roles.name] : "/login";
      navigate(destination, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unable to sign in");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Smart School Management</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />

          {serverError && (
            <p role="alert" className="text-sm text-red-600">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Sign in
          </Button>
          <Link
            to="/forgot-password"
            className="block text-center text-sm font-medium text-brand-600 hover:underline"
          >
            Forgot password?
          </Link>
        </form>
      </Card>
    </div>
  );
}
