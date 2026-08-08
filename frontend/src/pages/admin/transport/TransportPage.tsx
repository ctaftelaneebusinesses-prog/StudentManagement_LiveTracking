import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bus, ClipboardList, IndianRupee, LayoutGrid, MapPinned, Radar, Users, Wrench, type LucideIcon } from "lucide-react";
import { OverviewTab } from "./components/OverviewTab";
import { VehiclesTab } from "./components/VehiclesTab";
import { DriversTab } from "./components/DriversTab";
import { RoutesTab } from "./components/RoutesTab";
import { TripHistoryTab } from "./components/TripHistoryTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { FeesTab } from "./components/FeesTab";
import { TransportMonitoringPage } from "./TransportMonitoringPage";

type TabKey = "overview" | "vehicles" | "drivers" | "routes" | "fees" | "monitoring" | "history" | "maintenance";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "vehicles", label: "Vehicles", icon: Bus },
  { key: "drivers", label: "Drivers", icon: Users },
  { key: "routes", label: "Routes & Stops", icon: MapPinned },
  { key: "fees", label: "Fees", icon: IndianRupee },
  { key: "monitoring", label: "Monitoring", icon: Radar },
  { key: "history", label: "Trip History", icon: ClipboardList },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
];

const TAB_KEYS = TABS.map((t) => t.key);

export function TransportPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(
    initialTab && TAB_KEYS.includes(initialTab as TabKey) ? (initialTab as TabKey) : "overview"
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Transport</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Manage the fleet, drivers, routes, and student transport assignments, and track vehicles live.
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

      {tab === "overview" && <OverviewTab />}
      {tab === "vehicles" && <VehiclesTab />}
      {tab === "drivers" && <DriversTab />}
      {tab === "routes" && <RoutesTab />}
      {tab === "fees" && <FeesTab />}
      {tab === "monitoring" && <TransportMonitoringPage />}
      {tab === "history" && <TripHistoryTab />}
      {tab === "maintenance" && <MaintenanceTab />}
    </div>
  );
}
