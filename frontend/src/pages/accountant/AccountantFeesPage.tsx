import { useState } from "react";
import { ClipboardList, Layers, Receipt, Wallet } from "lucide-react";
import { FeeStructuresTab } from "@/pages/admin/fees/components/FeeStructuresTab";
import { PaymentHistoryTab } from "@/pages/admin/fees/components/PaymentHistoryTab";
import { ReceiptsTab } from "@/pages/admin/fees/components/ReceiptsTab";
import { BulkFeeManagementTab } from "./components/BulkFeeManagementTab";

type TabKey = "structures" | "bulk" | "payments" | "receipts";

const TABS: { key: TabKey; label: string; icon: typeof ClipboardList }[] = [
  { key: "structures", label: "Fee Structures", icon: ClipboardList },
  { key: "bulk", label: "Bulk Management", icon: Layers },
  { key: "payments", label: "Payment History", icon: Wallet },
  { key: "receipts", label: "Receipts", icon: Receipt },
];

export function AccountantFeesPage() {
  const [tab, setTab] = useState<TabKey>("structures");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Fee Management</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Add, update, and remove fees — individually or in bulk.</p>
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

      {tab === "structures" && <FeeStructuresTab />}
      {tab === "bulk" && <BulkFeeManagementTab />}
      {tab === "payments" && <PaymentHistoryTab />}
      {tab === "receipts" && <ReceiptsTab />}
    </div>
  );
}
