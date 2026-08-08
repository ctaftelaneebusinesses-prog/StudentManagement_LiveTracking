import { ReportCard } from "@/types/portal.types";

/**
 * Renders a student's report card (attendance + every published exam's
 * subject-wise marks) as a downloadable PDF. jsPDF is dynamically imported,
 * same lazy-load convention as utils/feeReceipt.ts and utils/export.ts.
 */
export async function downloadReportCardPdf(report: ReportCard, schoolName: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 60;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(schoolName || "School", margin, y);
  y += 22;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Student Report Card", margin, y);
  doc.text(`Generated: ${new Date(report.generated_at).toLocaleDateString("en-IN")}`, pageWidth - margin, y, { align: "right" });
  y += 14;

  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  doc.setTextColor(20);
  doc.setFontSize(11);
  const studentName = report.student.users?.full_name ?? "Student";
  const className = report.student.classes ? `${report.student.classes.name} ${report.student.classes.section}` : "—";
  doc.setFont("helvetica", "bold");
  doc.text("Student", margin, y);
  doc.text("Admission No.", margin + 200, y);
  doc.text("Class", margin + 360, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.text(studentName, margin, y);
  doc.text(report.student.admission_no, margin + 200, y);
  doc.text(className, margin + 360, y);
  y += 30;

  doc.setDrawColor(180);
  doc.setFillColor(245, 247, 255);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Attendance", margin + 16, y + 25);
  doc.setFontSize(14);
  doc.text(
    report.attendance.percentage !== null ? `${report.attendance.percentage}%` : "—",
    pageWidth - margin - 16,
    y + 26,
    { align: "right" }
  );
  y += 60;

  if (report.marks.exams.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("No exam results published yet.", margin, y);
  }

  for (const exam of report.marks.exams) {
    if (y > 720) {
      doc.addPage();
      y = 60;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(exam.examName, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `${exam.examDate ?? ""}${exam.percentage !== null ? ` · ${exam.percentage}%` : ""}`,
      pageWidth - margin,
      y,
      { align: "right" }
    );
    y += 16;

    doc.setDrawColor(210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text("Subject", margin, y);
    doc.text("Marks", margin + 280, y);
    doc.text("Grade", margin + 380, y);
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    for (const subject of exam.subjects) {
      if (y > 750) {
        doc.addPage();
        y = 60;
      }
      doc.text(subject.subjectName, margin, y);
      doc.text(`${subject.marksObtained} / ${subject.maxMarks}`, margin + 280, y);
      doc.text(subject.grade ?? "—", margin + 380, y);
      y += 16;
    }
    y += 20;
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("This is a computer-generated report card.", margin, 800);

  doc.save(`${report.student.admission_no}-report-card.pdf`);
}
