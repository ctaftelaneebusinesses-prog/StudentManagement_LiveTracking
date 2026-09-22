import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, School, ChevronRight } from "lucide-react";
import { AuthSplitLayout, AuthGlassCard } from "./components/AuthSplitLayout";
import { AuthInput } from "./components/AuthInput";
import { AuthButton } from "./components/AuthButton";
import { getApiErrorMessage } from "@/lib/axios";
import { fetchRegistrationMeta, RegistrationMeta, RegistrationRole } from "@/services/registration.service";
import { REGISTRATION_ROLE_CARDS } from "./register/roleConfig";
import { StudentForm } from "./register/StudentForm";
import { TeacherForm } from "./register/TeacherForm";
import { PrincipalForm } from "./register/PrincipalForm";
import { AccountantForm } from "./register/AccountantForm";
import { DriverForm } from "./register/DriverForm";
import { ExtracurricularStaffForm } from "./register/ExtracurricularStaffForm";

type Step = "school" | "role" | "form" | "success";

const REVIEWER_COPY: Record<RegistrationRole, string> = {
  principal: "your School Admin",
  accountant: "your Principal",
  driver: "your Principal",
  extracurricular_staff: "your Principal",
  teacher: "your Principal",
  student: "your Class Teacher (or your School Admin, if one isn't assigned yet)",
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("school");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolCodeError, setSchoolCodeError] = useState<string | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [meta, setMeta] = useState<RegistrationMeta | null>(null);
  const [selectedRole, setSelectedRole] = useState<RegistrationRole | null>(null);

  async function handleSchoolCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolCode.trim()) return;
    setSchoolCodeError(null);
    setIsLoadingMeta(true);
    try {
      const data = await fetchRegistrationMeta(schoolCode.trim().toUpperCase());
      setMeta(data);
      setStep("role");
    } catch (err) {
      setSchoolCodeError(getApiErrorMessage(err, "We couldn't find a school with that code."));
    } finally {
      setIsLoadingMeta(false);
    }
  }

  function handleSuccess() {
    setStep("success");
  }

  return (
    <AuthSplitLayout compact={step === "form"}>
      <div className={`mx-auto ${step === "form" ? "max-w-2xl" : "max-w-md"}`}>
        {step !== "school" && step !== "success" && (
          <button
            type="button"
            onClick={() => setStep(step === "form" ? "role" : "school")}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {step === "school" && (
          <AuthGlassCard>
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/25 to-accent-400/25 ring-1 ring-white/15">
                <School className="h-6 w-6 text-accent-300" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-white">Create your account</h1>
              <p className="mt-1 text-sm text-slate-300">Enter your school's code to get started.</p>
            </div>
            <form className="space-y-1.5" onSubmit={handleSchoolCodeSubmit} noValidate>
              <AuthInput
                label="School code"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                error={schoolCodeError ?? undefined}
                autoFocus
              />
              <p className="px-0.5 text-xs text-slate-400">
                Ask your school administrator for this code — it's shown on their School Settings page.
              </p>
              <AuthButton type="submit" className="!mt-4" isLoading={isLoadingMeta}>
                Continue
              </AuthButton>
            </form>
            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-brand-300 hover:text-brand-200 hover:underline">
                Sign in
              </Link>
            </p>
          </AuthGlassCard>
        )}

        {step === "role" && meta && (
          <AuthGlassCard>
            <h1 className="text-xl font-semibold tracking-tight text-white">Register with {meta.school.name}</h1>
            <p className="mt-1 text-sm text-slate-300">Choose the role you're registering for.</p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {REGISTRATION_ROLE_CARDS.map(({ role, label, description, icon: Icon }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setSelectedRole(role);
                    setStep("form");
                  }}
                  className="group relative flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent-400/40 hover:bg-white/10 hover:shadow-[0_12px_30px_-12px_rgba(14,165,160,0.4)]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400/25 to-accent-400/25 text-accent-300 ring-1 ring-white/10 transition-colors group-hover:from-brand-400/35 group-hover:to-accent-400/35">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <span className="text-xs text-slate-400">{description}</span>
                  <ChevronRight className="absolute right-3.5 top-4 h-4 w-4 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </AuthGlassCard>
        )}

        {step === "form" && meta && selectedRole && (
          <AuthGlassCard variant="light" className="text-slate-900 dark:text-white">
            {selectedRole === "student" && <StudentForm meta={meta} onSuccess={handleSuccess} />}
            {selectedRole === "teacher" && <TeacherForm meta={meta} onSuccess={handleSuccess} />}
            {selectedRole === "principal" && <PrincipalForm meta={meta} onSuccess={handleSuccess} />}
            {selectedRole === "accountant" && <AccountantForm meta={meta} onSuccess={handleSuccess} />}
            {selectedRole === "driver" && <DriverForm meta={meta} onSuccess={handleSuccess} />}
            {selectedRole === "extracurricular_staff" && <ExtracurricularStaffForm meta={meta} onSuccess={handleSuccess} />}
          </AuthGlassCard>
        )}

        {step === "success" && selectedRole && (
          <AuthGlassCard className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-white">Registration submitted</h1>
            <p className="mt-2 text-sm text-slate-300">
              Your request has been sent to {REVIEWER_COPY[selectedRole]} for approval. You'll be able to log in
              once it's approved — we recommend checking back soon.
            </p>
            <AuthButton className="mt-6" onClick={() => navigate("/login")}>
              Back to sign in
            </AuthButton>
          </AuthGlassCard>
        )}
      </div>
    </AuthSplitLayout>
  );
}
