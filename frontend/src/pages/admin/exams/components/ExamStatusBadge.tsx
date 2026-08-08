import { Badge } from "@/components/ui/Badge";

export function ExamStatusBadge({ isPublished }: { isPublished?: boolean }) {
  return isPublished ? <Badge variant="success">Published</Badge> : <Badge variant="neutral">Draft</Badge>;
}
