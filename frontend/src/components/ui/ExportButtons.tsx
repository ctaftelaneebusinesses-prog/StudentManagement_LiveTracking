import { Button } from "./Button";
import { exportToPdf, exportToExcel, ExportColumn } from "@/utils/export";

interface ExportButtonsProps<T> {
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  filename: string;
}

export function ExportButtons<T>({ title, columns, rows, filename }: ExportButtonsProps<T>) {
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        className="!px-3 !py-1.5 text-xs"
        disabled={rows.length === 0}
        onClick={() => exportToPdf(title, columns, rows, filename)}
      >
        Export PDF
      </Button>
      <Button
        variant="secondary"
        className="!px-3 !py-1.5 text-xs"
        disabled={rows.length === 0}
        onClick={() => exportToExcel(title, columns, rows, filename)}
      >
        Export Excel
      </Button>
    </div>
  );
}
