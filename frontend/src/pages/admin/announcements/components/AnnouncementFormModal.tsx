import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "./RichTextEditor";
import { AudiencePicker } from "./AudiencePicker";
import { AttachmentUploader, AttachmentItem } from "./AttachmentUploader";
import * as announcementsService from "@/services/admin/announcements.service";
import { getApiErrorMessage } from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import { AttachmentFileType, AudienceType, NewAttachmentInput } from "@/types/announcement.types";

interface PendingNewAttachment extends NewAttachmentInput {
  key: string;
}

interface ExistingAttachmentRef {
  id: string;
  file_name: string;
  file_type: AttachmentFileType;
  file_size: number | null;
}

interface AnnouncementFormModalProps {
  isOpen: boolean;
  announcementId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function AnnouncementFormModal({ isOpen, announcementId, onClose, onSaved }: AnnouncementFormModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditMode = !!announcementId;

  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [ecStaffIds, setEcStaffIds] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachmentRef[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [newAttachments, setNewAttachments] = useState<PendingNewAttachment[]>([]);
  const [isUploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const effectiveId = announcementId ?? draftId;

  const detailQuery = useQuery({
    queryKey: ["admin", "announcements", "detail", announcementId],
    queryFn: () => announcementsService.fetchAnnouncement(announcementId!),
    enabled: isOpen && isEditMode,
  });

  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode) {
      const a = detailQuery.data;
      if (!a) return;
      setTitle(a.title);
      setBody(a.body);
      setAudienceType(a.audience_type);
      setClassIds(a.classes.map((c) => c.id));
      setTeacherIds(a.teachers.map((t) => t.id));
      setEcStaffIds(a.ecStaff.map((s) => s.id));
      const isFuture = new Date(a.publish_at) > new Date();
      setScheduleMode(isFuture ? "later" : "now");
      setScheduledAt(isFuture ? toLocalDateTimeInput(a.publish_at) : "");
      setExistingAttachments(a.attachments.map((att) => ({ id: att.id, file_name: att.file_name, file_type: att.file_type, file_size: att.file_size })));
      setRemovedAttachmentIds([]);
      setNewAttachments([]);
    } else {
      setDraftId(crypto.randomUUID());
      setTitle("");
      setBody("");
      setAudienceType("all");
      setClassIds([]);
      setTeacherIds([]);
      setEcStaffIds([]);
      setScheduleMode("now");
      setScheduledAt("");
      setExistingAttachments([]);
      setRemovedAttachmentIds([]);
      setNewAttachments([]);
    }
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditMode, detailQuery.data]);

  const createMutation = useMutation({
    mutationFn: announcementsService.createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
      onSaved();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof announcementsService.updateAnnouncement>[1]) =>
      announcementsService.updateAnnouncement(announcementId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
      onSaved();
    },
  });

  async function handleFilesSelected(files: FileList) {
    if (!user?.school_id) return;
    setUploading(true);
    setFormError(null);
    try {
      const uploaded: PendingNewAttachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          setFormError(`${file.name} is larger than 15MB and was skipped.`);
          continue;
        }
        const meta = await announcementsService.uploadAttachment(user.school_id, effectiveId, file);
        uploaded.push({ ...meta, key: meta.storage_path });
      }
      setNewAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Failed to upload file."));
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveAttachment(key: string) {
    const existing = existingAttachments.find((a) => a.id === key);
    if (existing) {
      setRemovedAttachmentIds((prev) => [...prev, key]);
      return;
    }
    const pending = newAttachments.find((a) => a.key === key);
    if (pending) {
      void announcementsService.removeUploadedAttachment(pending.storage_path);
      setNewAttachments((prev) => prev.filter((a) => a.key !== key));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) return setFormError("Title is required.");
    if (!body.trim() || body === "<p></p>") return setFormError("Announcement body is required.");
    if (audienceType === "classes" && classIds.length === 0) return setFormError("Select at least one class.");
    if (audienceType === "specific_teachers" && teacherIds.length === 0) return setFormError("Select at least one teacher.");
    if (audienceType === "specific_extracurricular_staff" && ecStaffIds.length === 0) return setFormError("Select at least one staff member.");
    if (scheduleMode === "later" && !scheduledAt) return setFormError("Pick a date and time to schedule.");

    const publishAt = scheduleMode === "later" ? new Date(scheduledAt).toISOString() : undefined;

    if (isEditMode) {
      updateMutation.mutate({
        title,
        body,
        audience_type: audienceType,
        class_ids: audienceType === "classes" ? classIds : undefined,
        teacher_ids: audienceType === "specific_teachers" ? teacherIds : undefined,
        ec_staff_ids: audienceType === "specific_extracurricular_staff" ? ecStaffIds : undefined,
        publish_at: publishAt,
        new_attachments: newAttachments.map(({ key: _key, ...rest }) => rest),
        remove_attachment_ids: removedAttachmentIds.length > 0 ? removedAttachmentIds : undefined,
      });
    } else {
      createMutation.mutate({
        id: draftId,
        title,
        body,
        audience_type: audienceType,
        class_ids: audienceType === "classes" ? classIds : undefined,
        teacher_ids: audienceType === "specific_teachers" ? teacherIds : undefined,
        ec_staff_ids: audienceType === "specific_extracurricular_staff" ? ecStaffIds : undefined,
        publish_at: publishAt,
        attachments: newAttachments.map(({ key: _key, ...rest }) => rest),
      });
    }
  }

  const attachmentItems: AttachmentItem[] = [
    ...existingAttachments
      .filter((a) => !removedAttachmentIds.includes(a.id))
      .map((a) => ({ key: a.id, file_name: a.file_name, file_type: a.file_type, file_size: a.file_size })),
    ...newAttachments.map((a) => ({ key: a.key, file_name: a.file_name, file_type: a.file_type, file_size: a.file_size })),
  ];

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Announcement" : "New Announcement"} size="xl">
      {isEditMode && detailQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading announcement…</p>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <Input
            label="Title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Annual Sports Day"
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Announcement</label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>

          <AudiencePicker
            value={audienceType}
            onChange={setAudienceType}
            classIds={classIds}
            onClassIdsChange={setClassIds}
            teacherIds={teacherIds}
            onTeacherIdsChange={setTeacherIds}
            ecStaffIds={ecStaffIds}
            onEcStaffIdsChange={setEcStaffIds}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">When</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScheduleMode("now")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  scheduleMode === "now"
                    ? "border-accent-600 bg-accent-50 text-accent-700 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-300"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                Publish now
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode("later")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  scheduleMode === "later"
                    ? "border-accent-600 bg-accent-50 text-accent-700 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-300"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                Schedule for later
              </button>
            </div>
            {scheduleMode === "later" && (
              <Input
                label="Publish date & time"
                name="publish_at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            )}
          </div>

          <AttachmentUploader items={attachmentItems} onFilesSelected={handleFilesSelected} onRemove={handleRemoveAttachment} isUploading={isUploading} />

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {mutationError && <p className="text-sm text-red-600">{getApiErrorMessage(mutationError, "Failed to save announcement.")}</p>}

          <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={isUploading}>
            {isEditMode ? "Save changes" : scheduleMode === "later" ? "Schedule announcement" : "Publish announcement"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
