export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/**
 * Renders a titled table into a downloaded PDF — used by every report page's
 * "Export PDF" action. jspdf/jspdf-autotable (plus jspdf's html2canvas
 * dependency) are ~1MB combined, so they're dynamically imported here rather
 * than at module scope — a user who never exports never downloads them.
 */
export async function exportToPdf<T>(title: string, columns: ExportColumn<T>[], rows: T[], filename: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.accessor(row)))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  doc.save(`${filename}.pdf`);
}

/** Writes the same tabular data to a downloaded .xlsx workbook — xlsx is dynamically imported for the same reason as jspdf above. */
export async function exportToExcel<T>(sheetName: string, columns: ExportColumn<T>[], rows: T[], filename: string) {
  const XLSX = await import("xlsx");

  const data = rows.map((row) => {
    const record: Record<string, string | number> = {};
    columns.forEach((c) => {
      record[c.header] = c.accessor(row);
    });
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
