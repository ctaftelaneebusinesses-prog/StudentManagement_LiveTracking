import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { FeeCollectionBarChart } from "@/pages/admin/fees/components/charts/FeeCollectionBarChart";
import { FeeStatusBadge } from "@/pages/admin/fees/components/FeeStatusBadge";
import { useStudentFeeDetails } from "@/pages/admin/fees/hooks/useStudentFeeDetails";
import { useCollectionReport } from "./hooks/useCollectionReport";
import { useClassWiseCollection } from "./hooks/useClassWiseCollection";
import { ReportPeriod, StudentFeeDetail } from "@/types/fees.types";
import { ClassWiseCollectionRow } from "@/types/fees.types";

type ReportType = "collection" | "pending" | "paid" | "class-wise" | "student-wise";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "collection", label: "Collection Report (Daily / Weekly / Monthly / Yearly)" },
  { value: "pending", label: "Pending Fee Report" },
  { value: "paid", label: "Paid Fee Report" },
  { value: "class-wise", label: "Class-wise Collection" },
  { value: "student-wise", label: "Student-wise Collection" },
];

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function currency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function CollectionReportSection() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useCollectionReport({ period, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Select label="Period" options={PERIOD_OPTIONS} value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)} />
          <Input label="From (optional)" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="To (optional)" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <ExportButtons
          title={`${period[0].toUpperCase()}${period.slice(1)} Collection Report`}
          filename={`${period}-collection-report`}
          rows={rows}
          columns={[
            { header: "Period", accessor: (r) => r.label },
            { header: "Collected (₹)", accessor: (r) => r.value.toFixed(2) },
          ]}
        />
      </div>

      {isLoading ? (
        <Spinner label="Loading report..." />
      ) : rows.length === 0 ? (
        <EmptyState title="No collections in this range" description="Try a different period or date range." />
      ) : (
        <>
          <ChartCard title="Collection over time">
            <FeeCollectionBarChart data={rows} />
          </ChartCard>
          <Card>
            <DataTable
              rows={rows}
              rowKey={(r) => r.label}
              columns={[
                { header: "Period", cell: (r) => r.label },
                { header: "Collected", cell: (r) => currency(r.value) },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function StudentFeeReportSection({ status }: { status: "paid" | "unpaid" | "all" }) {
  const { data, isLoading } = useStudentFeeDetails({ status, page: 1, pageSize: 500 });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          title={status === "paid" ? "Paid Fee Report" : status === "unpaid" ? "Pending Fee Report" : "Student-wise Collection"}
          filename={status === "paid" ? "paid-fee-report" : status === "unpaid" ? "pending-fee-report" : "student-wise-collection"}
          rows={rows}
          columns={[
            { header: "Admission No", accessor: (s: StudentFeeDetail) => s.admissionNo },
            { header: "Name", accessor: (s: StudentFeeDetail) => s.name },
            { header: "Class", accessor: (s: StudentFeeDetail) => s.className },
            { header: "Due (₹)", accessor: (s: StudentFeeDetail) => s.due.toFixed(2) },
            { header: "Paid (₹)", accessor: (s: StudentFeeDetail) => s.paid.toFixed(2) },
            { header: "Balance (₹)", accessor: (s: StudentFeeDetail) => s.balance.toFixed(2) },
            { header: "Status", accessor: (s: StudentFeeDetail) => s.status },
          ]}
        />
      </div>

      {isLoading ? (
        <Spinner label="Loading report..." />
      ) : rows.length === 0 ? (
        <EmptyState title="No matching students" description="No students match this report yet." />
      ) : (
        <Card>
          <DataTable<StudentFeeDetail>
            rows={rows}
            rowKey={(s) => s.id}
            columns={[
              { header: "Admission No", cell: (s) => s.admissionNo },
              { header: "Name", cell: (s) => s.name },
              { header: "Class", cell: (s) => s.className },
              { header: "Due", cell: (s) => currency(s.due) },
              { header: "Paid", cell: (s) => currency(s.paid) },
              { header: "Balance", cell: (s) => currency(s.balance) },
              { header: "Status", cell: (s) => <FeeStatusBadge status={s.status} /> },
            ]}
          />
        </Card>
      )}
    </div>
  );
}

function ClassWiseReportSection() {
  const { data, isLoading } = useClassWiseCollection();
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          title="Class-wise Collection"
          filename="class-wise-collection"
          rows={rows}
          columns={[
            { header: "Class", accessor: (r: ClassWiseCollectionRow) => r.className },
            { header: "Due (₹)", accessor: (r: ClassWiseCollectionRow) => r.due.toFixed(2) },
            { header: "Paid (₹)", accessor: (r: ClassWiseCollectionRow) => r.paid.toFixed(2) },
            { header: "Balance (₹)", accessor: (r: ClassWiseCollectionRow) => r.balance.toFixed(2) },
          ]}
        />
      </div>

      {isLoading ? (
        <Spinner label="Loading report..." />
      ) : rows.length === 0 ? (
        <EmptyState title="No classes yet" description="Class-wise totals will show up here once fees are assigned." />
      ) : (
        <Card>
          <DataTable<ClassWiseCollectionRow>
            rows={rows}
            rowKey={(r) => r.classId}
            columns={[
              { header: "Class", cell: (r) => r.className },
              { header: "Due", cell: (r) => currency(r.due) },
              { header: "Paid", cell: (r) => currency(r.paid) },
              {
                header: "Balance",
                cell: (r) => (
                  <span className={r.balance > 0 ? "font-semibold text-[var(--status-serious)]" : "font-semibold text-[var(--status-good)]"}>
                    {currency(r.balance)}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}

export function AccountantReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("collection");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Reports</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Generate and export collection and balance reports.</p>
      </div>

      <Card>
        <Select label="Report type" options={REPORT_OPTIONS} value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} />
      </Card>

      {reportType === "collection" && <CollectionReportSection />}
      {reportType === "pending" && <StudentFeeReportSection status="unpaid" />}
      {reportType === "paid" && <StudentFeeReportSection status="paid" />}
      {reportType === "class-wise" && <ClassWiseReportSection />}
      {reportType === "student-wise" && <StudentFeeReportSection status="all" />}
    </div>
  );
}
