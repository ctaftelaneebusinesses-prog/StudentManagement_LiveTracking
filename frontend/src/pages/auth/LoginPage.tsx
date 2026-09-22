import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_HOME_ROUTE } from "@/utils/roles";
import { AuthSplitLayout, AuthGlassCard } from "./components/AuthSplitLayout";
import { AuthInput } from "./components/AuthInput";
import { AuthButton } from "./components/AuthButton";

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
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/25 to-accent-400/25 ring-1 ring-white/15">
              <ShieldCheck className="h-6 w-6 text-accent-300" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-300">Sign in to your account to continue</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-4">
              <AuthInput
                label="Email"
                type="email"
                autoComplete="email"
                icon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register("email")}
              />
              <div className="relative">
                <AuthInput
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  icon={<Lock className="h-4 w-4" />}
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

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm font-medium text-brand-300 hover:text-brand-200 hover:underline">
                  Forgot password?
                </Link>
              </div>

              {serverError && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {serverError}
                </p>
              )}
            </div>

            <AuthButton type="submit" isLoading={isSubmitting}>
              Sign in
            </AuthButton>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-brand-300 hover:text-brand-200 hover:underline">
              Register here
            </Link>
          </p>
        </AuthGlassCard>
      </div>
    </AuthSplitLayout>
  );
}
