import { useMemo, useState } from "react";
import { Award, BadgeCheck, Database, ListChecks, Settings2, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { TakeAssessmentTab } from "./components/TakeAssessmentTab";
import { MyAttemptsTab } from "./components/MyAttemptsTab";
import { TeamProgressTab } from "./components/TeamProgressTab";
import { QuestionBankTab } from "./components/QuestionBankTab";
import { AssessmentSettingsTab } from "./components/AssessmentSettingsTab";

type TabKey = "take" | "attempts" | "team" | "questions" | "settings";

const QUIZ_ROLES = ["student", "teacher", "principal", "school_admin", "accountant", "driver", "extracurricular_staff"] as const;
const TEAM_VIEW_ROLES = ["teacher", "principal", "school_admin", "super_admin"] as const;

export function WebsiteKnowledgePage() {
  const { hasRole } = useAuth();

  const takesQuiz = QUIZ_ROLES.some((r) => hasRole(r));
  const canViewTeam = TEAM_VIEW_ROLES.some((r) => hasRole(r));
  const isSuperAdmin = hasRole("super_admin");

  const tabs: TabItem<TabKey>[] = useMemo(() => {
    const list: TabItem<TabKey>[] = [];
    if (takesQuiz) {
      list.push({ key: "take", label: "Take Assessment", icon: BadgeCheck });
      list.push({ key: "attempts", label: "My Attempts", icon: ListChecks });
    }
    if (canViewTeam) list.push({ key: "team", label: "Team Progress", icon: Users });
    if (isSuperAdmin) {
      list.push({ key: "questions", label: "Question Bank", icon: Database });
      list.push({ key: "settings", label: "Settings", icon: Settings2 });
    }
    return list;
  }, [takesQuiz, canViewTeam, isSuperAdmin]);

  const [tab, setTab] = useState<TabKey>(tabs[0]?.key ?? "team");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Award size={22} className="text-accent-600 dark:text-accent-400" />
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Website Knowledge</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Learn and prove how well you know your way around the School ERP.
        </p>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "take" && takesQuiz && <TakeAssessmentTab onCertificateEarned={() => setTab("attempts")} />}
      {tab === "attempts" && takesQuiz && <MyAttemptsTab />}
      {tab === "team" && canViewTeam && <TeamProgressTab />}
      {tab === "questions" && isSuperAdmin && <QuestionBankTab />}
      {tab === "settings" && isSuperAdmin && <AssessmentSettingsTab />}
    </motion.div>
  );
}
