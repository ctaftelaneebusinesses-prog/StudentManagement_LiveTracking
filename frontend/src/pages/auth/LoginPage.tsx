import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { ROLE_HOME_ROUTE } from "@/utils/roles";
import { AuthSplitLayout, AuthGlassCard } from "./components/AuthSplitLayout";
import { AuthInput } from "./components/AuthInput";

const loginFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    <AuthSplitLayout>
      <div className="mx-auto max-w-md">
        <AuthGlassCard>
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-300">Sign in to your account</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-4">
              <AuthInput
                label="Email"
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register("email")}
              />
              <div className="relative">
                <AuthInput
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  error={errors.password?.message}
                  className="pr-11"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-3 rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {serverError && (
                <p role="alert" className="text-sm text-red-300">
                  {serverError}
                </p>
              )}
            </div>

            <div className="space-y-4 text-center">
              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Sign in
              </Button>
              <Link to="/forgot-password" className="block text-sm font-medium text-brand-300 hover:underline">
                Forgot password?
              </Link>
            </div>
          </form>

          <p className="mt-10 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-brand-300 hover:underline">
              Register here
            </Link>
          </p>
        </AuthGlassCard>
      </div>
    </AuthSplitLayout>
  );
}
