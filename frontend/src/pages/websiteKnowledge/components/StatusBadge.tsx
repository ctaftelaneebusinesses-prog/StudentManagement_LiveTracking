import { Badge } from "@/components/ui/Badge";
import { AssessmentStatus } from "@/types/websiteKnowledge.types";
import { STATUS_LABELS, STATUS_VARIANTS } from "../utils";

export function StatusBadge({ status }: { status: AssessmentStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}
