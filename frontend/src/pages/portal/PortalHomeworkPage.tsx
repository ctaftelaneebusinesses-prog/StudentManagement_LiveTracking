import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { usePortalStudentId } from "@/context/PortalStudentContext";
import * as homeworkService from "@/services/student/homework.service";
import { getApiErrorMessage } from "@/lib/axios";
import { HomeworkItem } from "@/types/dashboard.types";
import { PortalGlassCard } from "./components/ui/PortalGlassCard";
import { PortalSkeleton } from "./components/ui/PortalSkeleton";
import { PortalEmptyState } from "./components/ui/PortalEmptyState";
import { PortalModal } from "./components/ui/PortalModal";
import { staggerContainer, fadeSlideUp } from "./components/ui/portalMotion";

interface SubmitFormValues {
  submission_text: string;
}

function isOverdue(dueDate: string): boolean {
  return dueDate < new Date().toISOString().slice(0, 10);
}

export function PortalHomeworkPage() {
  const studentId = usePortalStudentId();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeHomework, setActiveHomework] = useState<HomeworkItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);

  const homeworkQuery = useQuery({
    queryKey: ["portal", "homework", studentId],
    queryFn: () => homeworkService.fetchAllHomework(studentId),
    enabled: !!studentId,
  });

  const { register, handleSubmit, reset } = useForm<SubmitFormValues>({ defaultValues: { submission_text: "" } });

  const submitMutation = useMutation({
    mutationFn: ({ homeworkId, input }: { homeworkId: string; input: homeworkService.SubmitHomeworkInput }) =>
      homeworkService.submitHomework(homeworkId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "homework", studentId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "dashboard", "homework", studentId] });
      setActiveHomework(null);
      toast.success("Homework submitted.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to submit homework.")),
  });

  function openSubmit(hw: HomeworkItem) {
    setUploadError(null);
    reset({ submission_text: hw.submission?.submission_text ?? "" });
    setActiveHomework(hw);
  }

  async function handleSubmitHomework(values: SubmitFormValues) {
    if (!activeHomework) return;

    let attachmentUrl = activeHomework.submission?.attachment_url ?? undefined;
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      setUploadError(null);
      setUploading(true);
      try {
        attachmentUrl = await homeworkService.uploadSubmissionAttachment(studentId, file);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to upload attachment");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    if (!values.submission_text.trim() && !attachmentUrl) {
      setUploadError("Add a note or attach a file before submitting.");
      return;
    }

    submitMutation.mutate({
      homeworkId: activeHomework.id,
      input: { submission_text: values.submission_text.trim() || undefined, attachment_url: attachmentUrl },
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="border-l-4 pl-4" style={{ borderColor: "var(--portal-accent)" }}>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Homework</h1>
        <p className="text-sm text-[var(--ink-muted)]">View assignments from your teachers and submit your work.</p>
      </div>

      {homeworkQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <PortalSkeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !homeworkQuery.data?.length ? (
        <PortalGlassCard noHover>
          <PortalEmptyState title="No homework yet" description="Homework assigned to your class will appear here." icon={BookOpen} />
        </PortalGlassCard>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
          {homeworkQuery.data.map((hw) => {
            const submitted = !!hw.submission;
            const overdue = !submitted && isOverdue(hw.due_date);
            return (
              <motion.div key={hw.id} variants={fadeSlideUp}>
                <PortalGlassCard noHover>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-primary)]">{hw.title}</p>
                      <p className="text-xs text-[var(--ink-muted)]">{hw.subjects?.name ?? "General"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium ${overdue ? "text-[var(--status-serious)]" : "text-[var(--ink-muted)]"}`}>
                        Due {hw.due_date}
                      </p>
                      <Badge variant={submitted ? "success" : "warning"} className="mt-1">
                        {submitted ? "Submitted" : "Not submitted"}
                      </Badge>
                    </div>
                  </div>
                  {hw.description && <p className="mt-2 text-sm text-[var(--ink-secondary)]">{hw.description}</p>}
                  {hw.attachment_url && (
                    <a
                      href={hw.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm font-medium hover:underline"
                      style={{ color: "var(--portal-accent)" }}
                    >
                      View teacher's attachment
                    </a>
                  )}
                  {submitted && (
                    <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: "var(--portal-accent-soft)" }}>
                      <p className="text-xs text-[var(--ink-muted)]">Submitted {new Date(hw.submission!.submitted_at).toLocaleString()}</p>
                      {hw.submission?.submission_text && <p className="mt-1 text-[var(--ink-secondary)]">{hw.submission.submission_text}</p>}
                      {hw.submission?.attachment_url && (
                        <a
                          href={hw.submission.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block font-medium hover:underline"
                          style={{ color: "var(--portal-accent)" }}
                        >
                          View submitted file
                        </a>
                      )}
                    </div>
                  )}
                  <div className="mt-3">
                    <Button variant={submitted ? "secondary" : "primary"} className="!px-3 !py-1.5 text-xs" onClick={() => openSubmit(hw)}>
                      {submitted ? "Resubmit" : "Submit homework"}
                    </Button>
                  </div>
                </PortalGlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <PortalModal isOpen={!!activeHomework} onClose={() => setActiveHomework(null)} title={activeHomework?.title ?? "Submit homework"}>
        <form className="space-y-4" onSubmit={handleSubmit(handleSubmitHomework)}>
          <Textarea label="Notes (optional)" rows={4} {...register("submission_text")} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--ink-secondary)]">Attachment (optional)</label>
            <input ref={fileInputRef} type="file" className="text-sm text-[var(--ink-secondary)]" />
            {activeHomework?.submission?.attachment_url && (
              <p className="text-xs text-[var(--ink-muted)]">Leave blank to keep your current attachment.</p>
            )}
          </div>
          {uploadError && <p className="text-xs text-[var(--status-serious)]">{uploadError}</p>}
          <Button type="submit" className="w-full" isLoading={isUploading || submitMutation.isPending}>
            Submit
          </Button>
        </form>
      </PortalModal>
    </div>
  );
}
