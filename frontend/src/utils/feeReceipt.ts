import { FeeReceipt } from "@/types/fees.types";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  online: "Online",
  cheque: "Cheque",
  other: "Other",
};

/**
 * Renders a single payment as a formatted, downloadable PDF receipt. jsPDF is
 * dynamically imported (same lazy-load convention as utils/export.ts) so it's
 * only downloaded when someone actually opens a receipt.
 */
export async function downloadFeeReceipt(receipt: FeeReceipt) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(receipt.schoolName || "School", margin, 50);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Fee Payment Receipt", margin, 68);

  doc.setDrawColor(220);
  doc.line(margin, 80, pageWidth - margin, 80);

  doc.setTextColor(20);
  doc.setFontSize(10);
  doc.text(`Receipt No: ${receipt.receiptNo}`, margin, 100);
  doc.text(`Date: ${new Date(receipt.paymentDate).toLocaleDateString("en-IN")}`, pageWidth - margin, 100, { align: "right" });

  const rows: [string, string][] = [
    ["Student Name", receipt.studentName || "—"],
    ["Admission No", receipt.admissionNo || "—"],
    ["Class", receipt.className || "—"],
    ["Payment Method", PAYMENT_METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod],
    ["Reference No", receipt.referenceNo || "—"],
  ];

  let y = 130;
  doc.setFontSize(10);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 130, y);
    y += 20;
  }

  y += 10;
  doc.setDrawColor(180);
  doc.setFillColor(245, 247, 255);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 46, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Amount Paid", margin + 16, y + 28);
  doc.setFontSize(16);
  doc.text(`Rs. ${receipt.amount.toFixed(2)}`, pageWidth - margin - 16, y + 30, { align: "right" });

  y += 70;
  if (receipt.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Notes: ${receipt.notes}`, margin, y);
    y += 20;
  }

  if (receipt.recordedByName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Recorded by: ${receipt.recordedByName}`, margin, y);
    y += 16;
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("This is a computer-generated receipt and does not require a signature.", margin, y + 10);

  doc.save(`${receipt.receiptNo}.pdf`);
}
