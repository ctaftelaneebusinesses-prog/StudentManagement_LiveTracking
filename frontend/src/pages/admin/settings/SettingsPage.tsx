import { useState } from "react";
import { Bell, Building2, CalendarDays, DatabaseBackup, ShieldCheck, UserCircle } from "lucide-react";
import { GraduationCap } from "lucide-react";
import { SchoolProfileTab } from "./components/SchoolProfileTab";
import { AcademicStructureTab } from "./components/AcademicStructureTab";
import { CalendarTab } from "./components/CalendarTab";
import { NotificationsTab } from "./components/NotificationsTab";
import { BackupTab } from "./components/BackupTab";
import { AdminAccountTab } from "./components/AdminAccountTab";
import { SecurityLogsTab } from "./components/SecurityLogsTab";

type TabKey = "profile" | "academic" | "calendar" | "notifications" | "backup" | "account" | "security";

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: "profile", label: "School Profile", icon: Building2 },
  { key: "academic", label: "Academic Structure", icon: GraduationCap },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "backup", label: "Backup", icon: DatabaseBackup },
  { key: "account", label: "Admin Account", icon: UserCircle },
  { key: "security", label: "Security Logs", icon: ShieldCheck },
];

export function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("profile");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          School profile, academic structure, calendar, notifications, backups, your account, and security logs.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-black/[0.06] bg-white p-1 dark:border-white/[0.08] dark:bg-[#17171a]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-accent-600 text-white shadow-sm"
                : "text-[var(--ink-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && <SchoolProfileTab />}
      {tab === "academic" && <AcademicStructureTab />}
      {tab === "calendar" && <CalendarTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "backup" && <BackupTab />}
      {tab === "account" && <AdminAccountTab />}
      {tab === "security" && <SecurityLogsTab />}
    </div>
  );
}
