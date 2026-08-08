import { PoweredByCraftLanee } from "@/components/branding/PoweredByCraftLanee";

/**
 * Presentational, print-ready certificate plate. Pure Tailwind, no jsPDF and
 * no html2canvas — MyAttemptsTab's "Download Certificate" and "Print / Save
 * as PDF" both just render this and call window.print(). That's deliberate:
 * an earlier version rasterized this component via html2canvas for a
 * one-click download, but html2canvas reimplements text layout instead of
 * using the browser's real text engine and produced subtle artifacts (a
 * phantom underline through a heading) the on-screen version never had.
 * Printing renders this exact DOM with the real engine, so it can't drift
 * out of sync with what's previewed.
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
}

// Deliberately NOT a fixed aspect-ratio box: at any width narrower than this
// design was tuned for (a cramped modal, a small screen), forcing a fixed
// height off the width let the title wrap and its extra line overflow past
// the bottom border/corner marks — exactly the "overlapping" layout this
// replaced. Auto height (driven by the inner content, h-full removed below)
// means the card always grows to fit whatever it's showing, at any width,
// and still looks landscape-proportioned at its natural ~1040px design width.
export function CertificateDocument({ schoolName, studentName, score, role, date, certificateId, logoSrc }: CertificateDocumentProps) {
  return (
    <div className="wk-certificate relative mx-auto w-full max-w-[1040px] bg-[#f5f6f2] p-3 shadow-[0_30px_60px_-25px_rgba(13,24,38,0.45)] print:h-screen print:w-screen print:max-w-none print:p-0 print:shadow-none">
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

      <div className="relative flex flex-col px-16 py-11">
        {/*
          Logo well. A real logo is sized by height with auto width (same
          convention as <PoweredByCraftLanee>, since the source mark is a
          wide ~4.4:1 horizontal lockup, not square) — forcing it into the
          square dashed placeholder box below produced a tiny, cramped
          rendering. The dashed square is only the "no logo yet" affordance,
          so it disappears once a real logoSrc is supplied.
        */}
        {logoSrc ? (
          <img src={logoSrc} alt="" className="absolute left-11 top-9 h-10 w-auto object-contain" />
        ) : (
          <div className="absolute left-11 top-9 flex h-16 w-16 items-center justify-center border border-dashed border-slate-400 text-center text-[8px] font-medium uppercase tracking-wider text-slate-400">
            Logo
          </div>
        )}

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
          <PoweredByCraftLanee className="inline-flex" surface="light" />
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
