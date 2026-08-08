import { useRef, useState, type DragEvent } from "react";
import { File as FileIcon, FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { AttachmentFileType } from "@/types/announcement.types";

export interface AttachmentItem {
  key: string;
  file_name: string;
  file_type: AttachmentFileType;
  file_size?: number | null;
}

interface AttachmentUploaderProps {
  items: AttachmentItem[];
  onFilesSelected: (files: FileList) => void;
  onRemove: (key: string) => void;
  isUploading?: boolean;
}

const TYPE_ICON: Record<AttachmentFileType, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  document: FileIcon,
};

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Drop-zone + file list for PDF/image/document attachments — client-side type detection and size display only (no server-side enforcement, matching student_documents' precedent). */
export function AttachmentUploader({ items, onFilesSelected, onRemove, isUploading }: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) onFilesSelected(e.dataTransfer.files);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Attachments</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragging
            ? "border-accent-500 bg-accent-50 dark:bg-accent-500/10"
            : "border-slate-300 hover:border-slate-400 dark:border-white/15"
        }`}
      >
        <Upload size={18} className="text-slate-400" strokeWidth={1.75} />
        <p className="text-sm text-slate-500 dark:text-slate-400">{isUploading ? "Uploading…" : "Drop files here, or click to browse"}</p>
        <p className="text-xs text-slate-400">PDF, images, or documents — up to 15MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.file_type];
            return (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon size={16} className="shrink-0 text-slate-400" />
                  <span className="truncate text-slate-700 dark:text-slate-200">{item.file_name}</span>
                  {item.file_size ? <span className="shrink-0 text-xs text-slate-400">{formatSize(item.file_size)}</span> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.key)}
                  className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  aria-label={`Remove ${item.file_name}`}
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
