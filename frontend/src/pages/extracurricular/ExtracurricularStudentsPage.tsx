import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import * as portalService from "@/services/extracurricularPortal.service";
import { PortalBatchStudent } from "@/types/extracurricularPortal.types";
import { BatchClassPicker, EMPTY_BATCH_PICKER } from "./components/BatchClassPicker";
import { resolveBatch } from "./batchPicker";

export function ExtracurricularStudentsPage() {
  const [picker, setPicker] = useState(EMPTY_BATCH_PICKER);

  const batchesQuery = useQuery({
    queryKey: ["extracurricular", "batches"],
    queryFn: portalService.fetchMyBatches,
  });
  const batches = batchesQuery.data ?? [];
  const selectedBatch = resolveBatch(batches, picker.academicYear, picker.className, picker.section, picker.activityId);
  const batchId = selectedBatch?.id ?? "";

  const studentsQuery = useQuery({
    queryKey: ["extracurricular", "batch-students", batchId],
    queryFn: () => portalService.fetchBatchStudents(batchId),
    enabled: !!batchId,
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Students</h1>
        <p className="text-sm text-[var(--ink-muted)]">Pick an academic year, class, and section to see its student roster.</p>
      </div>

      <Card className="space-y-4">
        <BatchClassPicker batches={batches} value={picker} onChange={setPicker} />
        {selectedBatch && (
          <p className="text-xs text-[var(--ink-muted)]">
            {selectedBatch.studentCount ?? selectedBatch.student_count ?? "—"} student(s) in this class
          </p>
        )}

        {!batchesQuery.isLoading && batches.length === 0 ? (
          <EmptyState title="No classes assigned yet" description="Once the admin assigns you a class, it will appear here." />
        ) : !batchId ? (
          <EmptyState title="Select a class to get started" description="Choose an academic year, class, and section above." />
        ) : (
          <DataTable<PortalBatchStudent>
            isLoading={studentsQuery.isLoading}
            rows={studentsQuery.data ?? []}
            rowKey={(s) => s.id}
            emptyMessage="No students in this batch yet."
            columns={[
              { header: "Admission No", cell: (s) => s.admission_no },
              { header: "Roll No", cell: (s) => s.roll_no ?? "—" },
              { header: "Name", cell: (s) => <span className="font-medium text-[var(--ink-primary)]">{s.users.full_name}</span> },
              { header: "Email", cell: (s) => s.users.email },
              { header: "Phone", cell: (s) => s.users.phone ?? "—" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
