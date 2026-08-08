import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import * as wkService from "@/services/websiteKnowledge.service";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";

const QUESTION_COUNT_OPTIONS = [
  { value: "20", label: "20 questions" },
  { value: "30", label: "30 questions" },
  { value: "50", label: "50 questions" },
];

const PASSING_PERCENTAGE_OPTIONS = [70, 75, 80, 85, 90].map((v) => ({ value: String(v), label: `${v}%` }));

export function AssessmentSettingsTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["website-knowledge", "settings"], queryFn: wkService.getSettings });

  const [questionCount, setQuestionCount] = useState("20");
  const [passingPercentage, setPassingPercentage] = useState("80");

  useEffect(() => {
    if (settingsQuery.data) {
      setQuestionCount(String(settingsQuery.data.question_count));
      setPassingPercentage(String(settingsQuery.data.passing_percentage));
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => wkService.updateSettings({ question_count: Number(questionCount), passing_percentage: Number(passingPercentage) }),
    onSuccess: () => {
      toast.success("Assessment settings updated");
      queryClient.invalidateQueries({ queryKey: ["website-knowledge", "settings"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not update settings")),
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-2 text-[var(--ink-primary)]">
        <Settings2 size={18} />
        <h3 className="text-sm font-semibold">Assessment Configuration</h3>
      </div>
      <p className="text-sm text-[var(--ink-muted)]">
        These settings apply platform-wide to every school's Website Knowledge Assessment.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Select label="Questions per Attempt" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} options={QUESTION_COUNT_OPTIONS} />
        <Select label="Passing Percentage" value={passingPercentage} onChange={(e) => setPassingPercentage(e.target.value)} options={PASSING_PERCENTAGE_OPTIONS} />
      </div>

      <Button isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        Save Settings
      </Button>
    </div>
  );
}
