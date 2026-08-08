import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { QuestionRow, QuizRole } from "@/types/websiteKnowledge.types";
import { ROLE_LABELS } from "../utils";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
const OPTION_KEYS = ["a", "b", "c", "d"];

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: {
    role_name: QuizRole;
    question_text: string;
    options: { key: string; text: string }[];
    correct_option: string;
    explanation?: string;
    category?: string;
  }) => Promise<void>;
  initial?: QuestionRow | null;
  defaultRole: QuizRole;
}

export function QuestionFormModal({ isOpen, onClose, onSave, initial, defaultRole }: QuestionFormModalProps) {
  const [role, setRole] = useState<QuizRole>(defaultRole);
  const [text, setText] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [category, setCategory] = useState("");
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initial) {
      setRole(initial.role_name);
      setText(initial.question_text);
      const ordered = OPTION_KEYS.map((k) => initial.options.find((o) => o.key === k)?.text ?? "");
      setOptions(ordered);
      setCorrectIndex(Math.max(0, OPTION_KEYS.indexOf(initial.correct_option)));
      setCategory(initial.category ?? "");
      setExplanation(initial.explanation ?? "");
    } else {
      setRole(defaultRole);
      setText("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      setCategory("");
      setExplanation("");
    }
  }, [isOpen, initial, defaultRole]);

  async function handleSubmit() {
    if (!text.trim() || options.some((o) => !o.trim())) return;
    setSaving(true);
    try {
      await onSave({
        role_name: role,
        question_text: text.trim(),
        options: options.map((t, i) => ({ key: OPTION_KEYS[i], text: t.trim() })),
        correct_option: OPTION_KEYS[correctIndex],
        explanation: explanation.trim() || undefined,
        category: category.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit Question" : "New Question"} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as QuizRole)} options={ROLE_OPTIONS} disabled={!!initial} />
          <Input label="Category" placeholder="e.g. Attendance" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <Textarea label="Question" value={text} onChange={(e) => setText(e.target.value)} rows={2} />
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Options — select the correct one</span>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct_option"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                className="h-4 w-4 accent-accent-600"
                aria-label={`Option ${OPTION_KEYS[i].toUpperCase()} is correct`}
              />
              <input
                value={opt}
                onChange={(e) => setOptions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder={`Option ${OPTION_KEYS[i].toUpperCase()}`}
                className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/20 dark:bg-white/10 dark:text-white"
              />
            </div>
          ))}
        </div>
        <Textarea label="Explanation (optional)" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={saving} onClick={handleSubmit}>
            Save Question
          </Button>
        </div>
      </div>
    </Modal>
  );
}
