import { useQuery } from "@tanstack/react-query";
import { Eye, Download, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import * as syllabusService from "@/services/syllabus.service";

export function PortalSyllabusPage() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["syllabus", "my-class"],
    queryFn: syllabusService.listMyClassSyllabus,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Syllabus</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Syllabus published for your class.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="No syllabus published yet" description="Check back once your teacher publishes it." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{entry.subjects?.name}</p>
              {entry.description && <p className="text-xs text-slate-500 dark:text-slate-400">{entry.description}</p>}
              <div className="mt-2 flex gap-2">
                {entry.url && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </a>
                )}
                {entry.url && (
                  <a
                    href={entry.url}
                    download={entry.file_name}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
