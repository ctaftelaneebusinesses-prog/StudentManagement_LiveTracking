import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2, Pencil, FolderPlus } from "lucide-react";
import * as wkService from "@/services/websiteKnowledge.service";
import { Tabs } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import { QuestionRow, QuestionSetRow, QuizRole } from "@/types/websiteKnowledge.types";
import { ROLE_LABELS } from "../utils";
import { QuestionFormModal } from "./QuestionFormModal";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export function QuestionBankTab() {
  const [subTab, setSubTab] = useState<"questions" | "sets">("questions");
  const [role, setRole] = useState<QuizRole>("student");
  const toast = useToast();
  const queryClient = useQueryClient();

  const questionsQuery = useQuery({
    queryKey: ["website-knowledge", "admin", "questions", role],
    queryFn: () => wkService.listQuestions({ role_name: role }),
  });
  const setsQuery = useQuery({
    queryKey: ["website-knowledge", "admin", "sets", role],
    queryFn: () => wkService.listQuestionSets(role),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionRow | null>(null);
  const [selectedSet, setSelectedSet] = useState<QuestionSetRow | null>(null);
  const [newSetName, setNewSetName] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["website-knowledge", "admin", "questions", role] });
    queryClient.invalidateQueries({ queryKey: ["website-knowledge", "admin", "sets", role] });
  }

  async function handleSaveQuestion(input: Parameters<typeof wkService.createQuestion>[0]) {
    try {
      if (editing) {
        await wkService.updateQuestion(editing.id, input);
        toast.success("Question updated");
      } else {
        await wkService.createQuestion(input);
        toast.success("Question created");
      }
      invalidate();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save the question"));
      throw err;
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wkService.deleteQuestion(id),
    onSuccess: () => {
      toast.success("Question deleted");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not delete the question")),
  });

  const createSetMutation = useMutation({
    mutationFn: () =>
      wkService.createQuestionSet({ role_name: role, set_number: (setsQuery.data?.length ?? 0) + 1, name: newSetName || `${ROLE_LABELS[role]} Set ${(setsQuery.data?.length ?? 0) + 1}` }),
    onSuccess: () => {
      toast.success("Question set created");
      setNewSetName("");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not create the set")),
  });

  const setItemsQuery = useQuery({
    queryKey: ["website-knowledge", "admin", "set-items", selectedSet?.id],
    queryFn: () => wkService.getQuestionSetItems(selectedSet!.id),
    enabled: !!selectedSet,
  });

  const addToSetMutation = useMutation({
    mutationFn: (questionId: string) => wkService.addQuestionToSet(selectedSet!.id, questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-knowledge", "admin", "set-items", selectedSet?.id] });
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not add this question to the set")),
  });

  const removeFromSetMutation = useMutation({
    mutationFn: (questionId: string) => wkService.removeQuestionFromSet(selectedSet!.id, questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-knowledge", "admin", "set-items", selectedSet?.id] });
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not remove this question from the set")),
  });

  const questionColumns: Column<QuestionRow>[] = [
    { header: "Question", cell: (q) => <span className="line-clamp-2 max-w-md">{q.question_text}</span> },
    { header: "Category", cell: (q) => q.category ?? "—" },
    { header: "Status", cell: (q) => (q.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>) },
    {
      header: "",
      cell: (q) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing(q);
              setFormOpen(true);
            }}
            className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-black/[0.05] hover:text-accent-600 dark:hover:bg-white/[0.08]"
            aria-label="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(q)}
            className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-red-500/10 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
      className: "text-right",
    },
  ];

  const idsInSet = new Set((setItemsQuery.data ?? []).map((i) => i.question_id));
  const availableToAdd = (questionsQuery.data ?? []).filter((q) => !idsInSet.has(q.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { key: "questions", label: "Questions", icon: Pencil },
            { key: "sets", label: "Question Sets", icon: Layers },
          ]}
          active={subTab}
          onChange={setSubTab}
        />
        <div className="w-48">
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as QuizRole)} options={ROLE_OPTIONS} />
        </div>
      </div>

      {subTab === "questions" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} className="mr-1.5" /> New Question
            </Button>
          </div>
          <DataTable columns={questionColumns} rows={questionsQuery.data ?? []} rowKey={(q) => q.id} isLoading={questionsQuery.isLoading} />
        </div>
      )}

      {subTab === "sets" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1">
              <input
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder={`New set name (e.g. "${ROLE_LABELS[role]} Set ${(setsQuery.data?.length ?? 0) + 1}")`}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
              />
            </div>
            <Button
              variant="secondary"
              isLoading={createSetMutation.isPending}
              disabled={(setsQuery.data?.length ?? 0) >= 10}
              onClick={() => createSetMutation.mutate()}
            >
              <FolderPlus size={16} className="mr-1.5" /> Add Set
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(setsQuery.data ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSet(s)}
                className="rounded-xl border border-black/[0.06] bg-white p-4 text-left transition-shadow hover:shadow-md dark:border-white/[0.08] dark:bg-[#17171a]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--ink-primary)]">{s.name}</span>
                  {s.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                </div>
                <div className="mt-1 text-xs text-[var(--ink-muted)]">{s.question_count} questions</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <QuestionFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSave={handleSaveQuestion} initial={editing} defaultRole={role} />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete question?"
        message="This question will be permanently removed from the question bank and any sets it belongs to."
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />

      <Drawer isOpen={!!selectedSet} onClose={() => setSelectedSet(null)} title={selectedSet?.name ?? ""} description={`${setItemsQuery.data?.length ?? 0} questions`} width="lg">
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-[var(--ink-primary)]">In this set</h4>
            <ul className="space-y-2">
              {(setItemsQuery.data ?? []).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.06] px-3 py-2 text-sm dark:border-white/[0.08]">
                  <span className="line-clamp-1">{item.questions.question_text}</span>
                  <button
                    type="button"
                    onClick={() => removeFromSetMutation.mutate(item.question_id)}
                    className="shrink-0 rounded-md p-1 text-[var(--ink-muted)] hover:bg-red-500/10 hover:text-red-600"
                    aria-label="Remove from set"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-[var(--ink-primary)]">Add from question bank</h4>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {availableToAdd.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-black/[0.08] px-3 py-2 text-sm dark:border-white/[0.1]">
                  <span className="line-clamp-1">{q.question_text}</span>
                  <button
                    type="button"
                    onClick={() => addToSetMutation.mutate(q.id)}
                    className="shrink-0 rounded-md p-1 text-[var(--ink-muted)] hover:bg-accent-500/10 hover:text-accent-600"
                    aria-label="Add to set"
                  >
                    <Plus size={14} />
                  </button>
                </li>
              ))}
              {availableToAdd.length === 0 && <li className="text-xs text-[var(--ink-muted)]">Every question for this role is already in the set.</li>}
            </ul>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
