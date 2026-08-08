import { useState } from "react";
import { LayoutGrid, Receipt, Users, Wallet, ClipboardList } from "lucide-react";
import { OverviewTab } from "./components/OverviewTab";
import { FeeStructuresTab } from "./components/FeeStructuresTab";
import { StudentFeeDetailsTab } from "./components/StudentFeeDetailsTab";
import { PaymentHistoryTab } from "./components/PaymentHistoryTab";
import { ReceiptsTab } from "./components/ReceiptsTab";

type TabKey = "overview" | "structures" | "students" | "payments" | "receipts";

const TABS: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "structures", label: "Fee Structures", icon: ClipboardList },
  { key: "students", label: "Student Fee Details", icon: Users },
  { key: "payments", label: "Payment History", icon: Wallet },
  { key: "receipts", label: "Receipts", icon: Receipt },
];

export function FeesPage() {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Fees</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Track collections, manage student balances, and issue receipts.</p>
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

      {tab === "overview" && <OverviewTab />}
      {tab === "structures" && <FeeStructuresTab />}
      {tab === "students" && <StudentFeeDetailsTab />}
      {tab === "payments" && <PaymentHistoryTab />}
      {tab === "receipts" && <ReceiptsTab />}
    </div>
  );
}
