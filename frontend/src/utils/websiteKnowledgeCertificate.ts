import { Certificate } from "@/types/websiteKnowledge.types";
import { ROLE_LABELS } from "@/pages/websiteKnowledge/utils";

/**
 * Renders the Website Knowledge "Certificate of Proficiency" as a downloadable
 * landscape PDF. jsPDF dynamically imported, same lazy-load convention as
 * utils/reportCard.ts / utils/feeReceipt.ts — no backend PDF dependency.
 */
export async function downloadWebsiteKnowledgeCertificate(certificate: Certificate, userName: string, schoolName: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  // Decorative border
  doc.setDrawColor(99, 91, 255);
  doc.setLineWidth(3);
  doc.roundedRect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2, 12, 12, "S");
  doc.setDrawColor(200, 196, 255);
  doc.setLineWidth(1);
  doc.roundedRect(margin + 10, margin + 10, pageWidth - (margin + 10) * 2, pageHeight - (margin + 10) * 2, 8, 8, "S");

  let y = margin + 70;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(120, 113, 255);
  doc.text(schoolName.toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 34;

  doc.setFontSize(30);
  doc.setTextColor(30, 27, 60);
  doc.text("CERTIFICATE OF WEBSITE PROFICIENCY", pageWidth / 2, y, { align: "center" });
  y += 40;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(90, 85, 110);
  doc.text("This certificate is proudly presented to", pageWidth / 2, y, { align: "center" });
  y += 42;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(30, 27, 60);
  doc.text(userName, pageWidth / 2, y, { align: "center" });
  y += 36;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(90, 85, 110);
  doc.text("for successfully completing the", pageWidth / 2, y, { align: "center" });
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(60, 55, 100);
  doc.text("School ERP Website Knowledge Assessment", pageWidth / 2, y, { align: "center" });
  y += 46;

  const colWidth = (pageWidth - margin * 2 - 80) / 3;
  const colY = y;
  const cols: [string, string][] = [
    ["Score", `${certificate.percentage}%`],
    ["Role", ROLE_LABELS[certificate.role_name]],
    ["Date", new Date(certificate.issued_at).toLocaleDateString(undefined, { dateStyle: "long" })],
  ];
  cols.forEach(([label, value], i) => {
    const x = margin + 40 + colWidth * i + colWidth / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(140, 135, 155);
    doc.text(label.toUpperCase(), x, colY, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 27, 60);
    doc.text(value, x, colY + 20, { align: "center" });
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150, 145, 165);
  doc.text(`Certificate ID: ${certificate.certificate_number}`, pageWidth / 2, pageHeight - margin - 34, { align: "center" });

  doc.setDrawColor(150);
  doc.line(pageWidth - margin - 200, pageHeight - margin - 60, pageWidth - margin - 60, pageHeight - margin - 60);
  doc.setFontSize(9);
  doc.text("Authorized Signature", pageWidth - margin - 130, pageHeight - margin - 46, { align: "center" });

  doc.save(`website-knowledge-certificate-${certificate.certificate_number}.pdf`);
}
