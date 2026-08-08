import { Certificate } from "@/types/websiteKnowledge.types";

/**
 * Renders the Website Knowledge certificate as a downloadable PDF by
 * rasterizing the ACTUAL <CertificateDocument> DOM node (via html2canvas)
 * and dropping that image into a same-aspect-ratio jsPDF page — so the
 * downloaded file is pixel-for-pixel what the on-screen preview shows,
 * rather than a second, independently-drawn rendering that could drift out
 * of sync with it. `node` should be the `.wk-certificate` element itself
 * (see CertificateDocument.tsx), captured off-screen at a fixed width for a
 * consistent, high-resolution result regardless of viewport size.
 */
export async function downloadWebsiteKnowledgeCertificate(node: HTMLElement, certificate: Certificate) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#f5f6f2",
    useCORS: true,
  });

  const imageData = canvas.toDataURL("image/png");
  const doc = new jsPDF({
    unit: "px",
    format: [canvas.width, canvas.height],
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
  });
  doc.addImage(imageData, "PNG", 0, 0, canvas.width, canvas.height);
  doc.save(`website-knowledge-certificate-${certificate.certificate_number}.pdf`);
}
