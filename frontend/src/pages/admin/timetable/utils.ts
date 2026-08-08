import { TimetablePeriodEntry } from "@/types/timetable.types";

/** Renders the weekly grid as a landscape PDF — a day×period table, not the flat row/column shape `utils/export.ts` builds. */
export async function exportTimetableToPdf(
  title: string,
  days: { dayOfWeek: number; label: string }[],
  periodNumbers: number[],
  getCell: (periodNo: number, dayOfWeek: number) => TimetablePeriodEntry | undefined
) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  const head = [["Period", ...days.map((d) => d.label)]];
  const body = periodNumbers.map((periodNo) => [
    `Period ${periodNo}`,
    ...days.map((d) => {
      const cell = getCell(periodNo, d.dayOfWeek);
      if (!cell) return "—";
      const lines = [cell.subjects?.name ?? "—"];
      if (cell.users?.full_name) lines.push(cell.users.full_name);
      if (cell.room_number) lines.push(`Room ${cell.room_number}`);
      return lines.join("\n");
    }),
  ]);

  autoTable(doc, {
    startY: 28,
    head,
    body,
    styles: { fontSize: 8, valign: "middle", halign: "center" },
    headStyles: { fillColor: [74, 58, 167] },
  });

  doc.save(`${title.replace(/\s+/g, "-")}.pdf`);
}
