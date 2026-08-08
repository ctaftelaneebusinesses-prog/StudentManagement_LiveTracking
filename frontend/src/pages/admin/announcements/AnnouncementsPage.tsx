import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import * as announcementsService from "@/services/admin/announcements.service";
import { AnnouncementFormModal } from "./components/AnnouncementFormModal";
import { AnnouncementStatusBadge } from "./components/AnnouncementStatusBadge";
import { AUDIENCE_LABEL, AnnouncementListItem } from "@/types/announcement.types";

const PAGE_SIZE = 20;

export function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<AnnouncementListItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "announcements", "list", { search, page }],
    queryFn: () => announcementsService.fetchAnnouncements({ search: search || undefined, page, pageSize: PAGE_SIZE }),
  });

  const deleteMutation = useMutation({
    mutationFn: announcementsService.deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
      setDeletingItem(null);
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.items ?? [];

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Announcements</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create, schedule, and broadcast announcements to teachers, students, or specific classes.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} strokeWidth={2} />
          New Announcement
        </Button>
      </div>

      <Card className="space-y-4">
        <Input
          label="Search"
          placeholder="Search by title"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        {isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Failed to load announcements."}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <DataTable<AnnouncementListItem>
              isLoading={isLoading}
              rows={rows}
              rowKey={(a) => a.id}
              emptyMessage="No announcements yet. Create your first one to get started."
              columns={[
                {
                  header: "Title",
                  cell: (a) => <span className="font-medium text-slate-800 dark:text-slate-100">{a.title}</span>,
                },
                {
                  header: "Audience",
                  cell: (a) => (a.audience_type === "classes" ? a.audienceSummary : AUDIENCE_LABEL[a.audience_type]),
                },
                { header: "Status", cell: (a) => <AnnouncementStatusBadge status={a.status} /> },
                { header: "Publish date", cell: (a) => new Date(a.publish_at).toLocaleString() },
                {
                  header: "Attachments",
                  cell: (a) =>
                    a.attachmentCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Paperclip size={13} /> {a.attachmentCount}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  header: "",
                  cell: (a) => (
                    <div className="flex gap-2">
                      <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openEdit(a.id)}>
                        Edit
                      </Button>
                      <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-600" onClick={() => setDeletingItem(a)}>
                        Delete
                      </Button>
                    </div>
                  ),
                },
              ]}
            />

            {total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                <p>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="self-center">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <AnnouncementFormModal
        isOpen={isFormOpen}
        announcementId={editingId}
        onClose={() => setFormOpen(false)}
        onSaved={() => setFormOpen(false)}
      />

      <ConfirmDialog
        isOpen={!!deletingItem}
        title="Delete announcement"
        message={`Are you sure you want to delete "${deletingItem?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingItem && deleteMutation.mutate(deletingItem.id)}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
}
