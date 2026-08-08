import { ReactNode } from "react";
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { PoweredByCraftLanee } from "@/components/branding/PoweredByCraftLanee";

interface AuthSplitLayoutProps {
  children: ReactNode;
  /** Narrower brand panel copy for the register flow (more form real-estate needed). */
  compact?: boolean;
}

const HIGHLIGHTS = [
  { icon: GraduationCap, text: "One platform for every role — Admin, Teacher, Student, and more" },
  { icon: ShieldCheck, text: "Every account is reviewed before it can sign in" },
  { icon: Sparkles, text: "Built for the way schools actually run, day to day" },
];

/**
 * Split-screen shell shared by Login and Register: a decorative gradient
 * brand panel on the left (hidden below lg), scrollable content on the
 * right. Deliberately its own visual system — glassmorphism, gradient mesh —
 * kept out of the shared `components/ui` kit so the rest of the dashboard
 * (flat, utilitarian) stays exactly as it was.
 */
export function AuthSplitLayout({ children, compact }: AuthSplitLayoutProps) {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-slate-950">
      {/* Ambient gradient mesh background, shared across the full viewport. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-20 flex items-center gap-3 lg:right-8 lg:top-8">
        <PoweredByCraftLanee className="hidden text-slate-400 sm:inline" />
        <LanguageSwitcher />
      </div>

      {/* Brand panel — fixed height (matches the h-screen parent), never scrolls; only the form panel beside it does. */}
      <div className={`relative z-10 hidden h-full shrink-0 flex-col justify-between overflow-y-auto p-10 lg:flex ${compact ? "lg:w-[38%]" : "lg:w-1/2"} xl:p-14`}>
        <div className="flex items-center gap-2.5 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Smart School Management</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white xl:text-4xl">
            Everything your school needs, in one place.
          </h1>
          <p className="mt-4 text-sm text-slate-300 xl:text-base">
            Attendance, homework, fees, transport, and communication — for Admins, Teachers, Students, and every
            role in between.
          </p>

          <div className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm text-slate-200">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Smart School Management System</p>
      </div>

      {/* Form panel — the only region that scrolls when a form is taller than the viewport.
          `items-start` (not `items-center`) is deliberate: centering a flex
          item inside an `overflow-y-auto` container clips the item's own top
          edge out of scroll range once it's taller than the container (a
          well-known flexbox/overflow interaction) — `py-10` below does the
          vertical balancing instead, safely. */}
      <div className="relative z-10 flex h-full flex-1 items-start justify-center overflow-y-auto px-4 py-10 sm:px-8">
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}

interface AuthGlassCardProps {
  children: ReactNode;
  className?: string;
  /**
   * "dark" (default): translucent glass over the gradient backdrop — used by
   * Login, the school-code step, the role picker, and the success screen,
   * all of which only hold AuthInput/plain text (styled for a dark surface).
   * "light": a near-solid frosted-white panel — used by the multi-field
   * registration forms, which embed the dashboard's light-themed Input/
   * Select/DatePicker kit and need a light surface to read correctly.
   * A plain `className` override for background color doesn't work here:
   * Tailwind's generated stylesheet order (not the className string's DOM
   * order) decides which same-property utility wins, so appending
   * `bg-white/95` on top of this component's own `bg-white/[0.07]` is not
   * guaranteed to override it — hence a real variant instead.
   */
  variant?: "dark" | "light";
}

const VARIANT_CLASSES: Record<NonNullable<AuthGlassCardProps["variant"]>, string> = {
  dark: "border-white/10 bg-white/[0.07] backdrop-blur-xl",
  light: "border-black/5 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[#17171a]",
};

/** Glassmorphism card used inside AuthSplitLayout's form panel — see AuthGlassCardProps for the dark/light variants. */
export function AuthGlassCard({ children, className = "", variant = "dark" }: AuthGlassCardProps) {
  return (
    <div className={`rounded-2xl border p-6 shadow-2xl sm:p-8 ${VARIANT_CLASSES[variant]} ${className}`}>{children}</div>
  );
}
