/**
 * Presentational, print-ready certificate plate. Pure Tailwind, no jsPDF —
 * the browser's own "Print / Save as PDF" renders this at full fidelity via
 * the scoped @page rule below, which is why it stays independent of
 * `utils/websiteKnowledgeCertificate.ts` (the jsPDF-drawn download) rather
 * than replacing it.
 *
 * The card surface is intentionally NOT theme-aware — a certificate is
 * printed on one fixed stock regardless of what theme you were browsing in,
 * so every color inside .wk-certificate is a literal, not a dark: variant.
 * Only the chrome around it (in the consuming page) should respond to theme.
 */
interface CertificateDocumentProps {
  schoolName: string;
  studentName: string;
  score: string;
  role: string;
  date: string;
  certificateId: string;
  logoSrc?: string;
  /** Platform attribution mark — omit to fall back to a plain "Powered by CraftLanee" wordmark in the footer's own type system. */
  poweredByLogoSrc?: string;
}

export function CertificateDocument({
  schoolName,
  studentName,
  score,
  role,
  date,
  certificateId,
  logoSrc,
  poweredByLogoSrc,
}: CertificateDocumentProps) {
  return (
    <div className="wk-certificate relative mx-auto aspect-[297/210] w-full max-w-[1040px] bg-[#f5f6f2] p-3 shadow-[0_30px_60px_-25px_rgba(13,24,38,0.45)] print:aspect-auto print:h-screen print:w-screen print:max-w-none print:p-0 print:shadow-none">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          body * { visibility: hidden; }
          .wk-certificate, .wk-certificate * { visibility: visible; }
          .wk-certificate { position: fixed; inset: 0; }
        }
        .wk-certificate, .wk-certificate * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* Outer rule */}
      <div className="absolute inset-3 border-[3px] border-brand-900" />
      {/* Inner double gold rule, nested inside the outer navy rule */}
      <div className="absolute inset-6 border-[5px] border-double border-[#96702f]" />

      {/* Registry corner marks, tucked just inside the gold rule */}
      <div className="absolute left-9 top-9 h-6 w-6 border-l-2 border-t-2 border-[#96702f]" />
      <div className="absolute right-9 top-9 h-6 w-6 border-r-2 border-t-2 border-[#96702f]" />
      <div className="absolute bottom-9 left-9 h-6 w-6 border-b-2 border-l-2 border-[#96702f]" />
      <div className="absolute bottom-9 right-9 h-6 w-6 border-b-2 border-r-2 border-[#96702f]" />

      <div className="relative flex h-full flex-col px-16 py-11">
        {/* Logo well */}
        <div className="absolute left-11 top-9 flex h-16 w-16 items-center justify-center border border-dashed border-slate-400 text-center text-[8px] font-medium uppercase tracking-wider text-slate-400">
          {logoSrc ? <img src={logoSrc} alt="" className="h-full w-full object-contain" /> : "Logo"}
        </div>

        {/* School eyebrow */}
        <div className="pt-1 text-center font-serif text-[13px] uppercase tracking-[0.35em] text-[#96702f]">{schoolName}</div>

        {/* Main content, vertically centered in the remaining space */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div>
            <h1 className="text-balance font-sans text-3xl font-extrabold uppercase tracking-[0.1em] text-brand-900 md:text-4xl">
              Certificate of Website Proficiency
            </h1>
            <div className="mx-auto mt-3 h-px w-16 bg-[#96702f]" />
          </div>

          <p className="font-serif text-sm italic text-slate-500">This certificate is proudly presented to</p>

          <div>
            <div className="font-serif text-4xl text-brand-900 md:text-5xl">{studentName}</div>
            <div className="mx-auto mt-2 h-px w-56 bg-[#cbab66]" />
          </div>

          <div className="max-w-md space-y-1">
            <p className="font-serif text-sm italic text-slate-500">for successfully completing the</p>
            <p className="font-sans text-base font-semibold tracking-wide text-brand-700">School ERP Website Knowledge Assessment</p>
          </div>
        </div>

        {/* Meta ledger */}
        <div className="grid grid-cols-3 divide-x divide-[#cbab66]/50 border-y border-[#cbab66]/50 py-4">
          {[
            { label: "Score", value: score },
            { label: "Role", value: role },
            { label: "Date", value: date },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">{item.label}</div>
              <div className="mt-1 font-mono text-xl font-bold tabular-nums text-brand-900">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Footer: platform attribution on the left, signature on the right, certificate ID centered beneath both */}
        <div className="mt-8 flex items-end justify-between">
          <div className="flex items-center gap-1.5 opacity-70">
            {poweredByLogoSrc ? (
              <img src={poweredByLogoSrc} alt="CraftLanee" className="h-4 w-auto object-contain" />
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Powered by CraftLanee</span>
            )}
          </div>
          <div className="text-center">
            <div className="h-px w-40 bg-slate-400" />
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Authorized Signature</div>
          </div>
        </div>
        <div className="mt-4 text-center font-mono text-[10px] tracking-wide text-slate-400">Certificate ID: {certificateId}</div>
      </div>
    </div>
  );
}
