/**
 * Rule-based "AI Homework Assistant". No external LLM is wired up yet (see
 * ANTHROPIC_API_KEY/OPENAI_API_KEY absence in env.ts) — this deterministic
 * formatter fills the same product slot (turn a one-line homework note into
 * a clear, student-friendly brief) so the feature works out of the box, and
 * can be swapped for a real model call later without touching the route or
 * the frontend contract (`{ enhanced: string }` in, editable text out).
 */

const STUDY_TIPS = [
  "Break the work into short sessions with a five-minute break in between.",
  "Read each question twice before you start answering.",
  "Keep your notes and textbook nearby for quick reference.",
  "Start with the part you find easiest to build momentum.",
];

const EMOJI_BY_KEYWORD: [RegExp, string][] = [
  [/\bread\b|\bchapter\b|\bstory\b|\btext\b/i, "📖"],
  [/\bwrite\b|\bessay\b|\bparagraph\b/i, "✍️"],
  [/\bmath|\bnumbers?\b|\bequation/i, "🔢"],
  [/\bscience|\bexperiment|\blab\b/i, "🔬"],
  [/\bdraw|\bart\b|\bcolou?r/i, "🎨"],
  [/\bpractice|\bexercise|\bquestions?\b/i, "📝"],
  [/\bproject\b/i, "🛠️"],
  [/\brevis(e|ion)|\bstudy\b/i, "📚"],
];

function pickEmoji(text: string): string {
  const match = EMOJI_BY_KEYWORD.find(([pattern]) => pattern.test(text));
  return match?.[1] ?? "📌";
}

/** Splits "Read Chapter 3 and answer questions 1-10." into distinct action items on "and"/"then"/commas/semicolons. */
function splitIntoSteps(description: string): string[] {
  return description
    .split(/(?:,|;|\n|\band then\b|\bthen\b|\band\b)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/\.$/, ""));
}

export function enhanceHomeworkDescription(input: {
  title: string;
  description: string;
  dueDate?: string;
}): string {
  const { title, description, dueDate } = input;
  const emoji = pickEmoji(`${title} ${description}`);
  const steps = splitIntoSteps(description);
  const tip = STUDY_TIPS[Math.abs(hashString(description)) % STUDY_TIPS.length];

  const lines: string[] = [];
  lines.push(`${emoji} ${title || "Homework"}`);
  lines.push("");
  lines.push("What to do:");
  if (steps.length > 0) {
    for (const step of steps) lines.push(`- ${step}`);
  } else {
    lines.push(`- ${description.trim()}`);
  }
  lines.push("");
  lines.push(`💡 Study tip: ${tip}`);
  lines.push("");
  lines.push(dueDate ? `⏰ Submission reminder: please submit this by ${dueDate}.` : "⏰ Submission reminder: check the due date and submit on time.");

  return lines.join("\n");
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
