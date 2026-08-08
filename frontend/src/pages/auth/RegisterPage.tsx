import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AuthSplitLayout, AuthGlassCard } from "./components/AuthSplitLayout";
import { AuthInput } from "./components/AuthInput";
import { Button } from "@/components/ui/Button";
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
            <h1 className="text-xl font-semibold text-white">Create your account</h1>
            <p className="mt-1 text-sm text-slate-300">Enter your school's code to get started.</p>
            <form className="mt-6 space-y-1.5" onSubmit={handleSchoolCodeSubmit} noValidate>
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
              <Button type="submit" className="w-full !mt-4" isLoading={isLoadingMeta}>
                Continue
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-brand-300 hover:underline">
                Sign in
              </Link>
            </p>
          </AuthGlassCard>
        )}

        {step === "role" && meta && (
          <AuthGlassCard>
            <h1 className="text-xl font-semibold text-white">Register with {meta.school.name}</h1>
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
                  className="group flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:border-brand-400/50 hover:bg-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300 transition-colors group-hover:bg-brand-500/30">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <span className="text-xs text-slate-400">{description}</span>
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
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-white">Registration submitted</h1>
            <p className="mt-2 text-sm text-slate-300">
              Your request has been sent to {REVIEWER_COPY[selectedRole]} for approval. You'll be able to log in
              once it's approved — we recommend checking back soon.
            </p>
            <Button className="mt-6 w-full" onClick={() => navigate("/login")}>
              Back to sign in
            </Button>
          </AuthGlassCard>
        )}
      </div>
    </AuthSplitLayout>
  );
}
