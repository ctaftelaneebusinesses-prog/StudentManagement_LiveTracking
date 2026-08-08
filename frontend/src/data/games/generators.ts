import { GameLevel, MatchPair, McqQuestion } from "@/types/learningGames.types";
import { VOCABULARY_WORDS, GENERAL_KNOWLEDGE, WORD_MATCH_PAIRS, MEMORY_ICONS, SHAPE_ICONS } from "./content";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Builds a 4-option MCQ from one correct numeric answer + plausible nearby distractors. */
function numericMcq(prompt: string, correct: number, spread: number): McqQuestion {
  const distractors = new Set<number>();
  while (distractors.size < 3) {
    const candidate = correct + randInt(-spread, spread);
    if (candidate !== correct && candidate >= 0) distractors.add(candidate);
  }
  const options = shuffle([correct, ...Array.from(distractors)]).map(String);
  return { id: uid(), prompt, options, correctIndex: options.indexOf(String(correct)) };
}

const LEVEL_RANGE: Record<GameLevel, { min: number; max: number }> = {
  beginner: { min: 1, max: 10 },
  intermediate: { min: 5, max: 25 },
  advanced: { min: 12, max: 50 },
};

function generateMultiplicationTable(level: GameLevel, count: number): McqQuestion[] {
  const tableRange = level === "beginner" ? [1, 5] : level === "intermediate" ? [2, 10] : [6, 12];
  return Array.from({ length: count }, () => {
    const a = randInt(tableRange[0], tableRange[1]);
    const b = randInt(1, 12);
    return numericMcq(`What is ${a} × ${b}?`, a * b, 10);
  });
}

function generateAddition(level: GameLevel, count: number): McqQuestion[] {
  const { min, max } = LEVEL_RANGE[level];
  return Array.from({ length: count }, () => {
    const a = randInt(min, max);
    const b = randInt(min, max);
    return numericMcq(`What is ${a} + ${b}?`, a + b, 8);
  });
}

function generateSubtraction(level: GameLevel, count: number): McqQuestion[] {
  const { min, max } = LEVEL_RANGE[level];
  return Array.from({ length: count }, () => {
    const a = randInt(min, max);
    const b = randInt(min, a); // b <= a, keep result non-negative
    return numericMcq(`What is ${a} - ${b}?`, a - b, 6);
  });
}

function generateMentalMath(level: GameLevel, count: number): McqQuestion[] {
  const { min, max } = LEVEL_RANGE[level];
  const ops = ["+", "-", "×"] as const;
  return Array.from({ length: count }, () => {
    const op = ops[randInt(0, ops.length - 1)];
    if (op === "×") {
      const a = randInt(1, level === "beginner" ? 5 : level === "intermediate" ? 9 : 12);
      const b = randInt(1, level === "beginner" ? 5 : level === "intermediate" ? 9 : 12);
      return numericMcq(`What is ${a} × ${b}?`, a * b, 10);
    }
    const a = randInt(min, max);
    const b = op === "-" ? randInt(min, a) : randInt(min, max);
    return numericMcq(`What is ${a} ${op} ${b}?`, op === "+" ? a + b : a - b, 8);
  });
}

/** "___ + 5 = 12" style — find the missing operand. */
function generateNumberPuzzles(level: GameLevel, count: number): McqQuestion[] {
  const { min, max } = LEVEL_RANGE[level];
  return Array.from({ length: count }, () => {
    const missing = randInt(min, max);
    const known = randInt(min, max);
    const total = missing + known;
    return numericMcq(`Find the missing number: ? + ${known} = ${total}`, missing, 6);
  });
}

function generateNumberSequences(level: GameLevel, count: number): McqQuestion[] {
  return Array.from({ length: count }, () => {
    const step = level === "beginner" ? randInt(1, 3) : level === "intermediate" ? randInt(2, 5) : randInt(3, 9);
    const start = randInt(1, 20);
    const seq = [start, start + step, start + step * 2, start + step * 3];
    return numericMcq(`What comes next? ${seq.join(", ")}, ?`, start + step * 4, 8);
  });
}

function generatePatternRecognition(level: GameLevel, count: number): McqQuestion[] {
  return Array.from({ length: count }, () => {
    const isDoubling = level !== "beginner" && Math.random() > 0.5;
    if (isDoubling) {
      const start = randInt(1, 5);
      const seq = [start, start * 2, start * 4, start * 8];
      return numericMcq(`Complete the pattern: ${seq.join(", ")}, ?`, start * 16, Math.max(10, start * 4));
    }
    const step = randInt(2, level === "advanced" ? 10 : 5);
    const start = randInt(1, 15);
    const seq = [start, start + step, start + step * 2];
    return numericMcq(`Complete the pattern: ${seq.join(", ")}, ?`, start + step * 3, 8);
  });
}

function generateMissingNumbers(level: GameLevel, count: number): McqQuestion[] {
  const { min, max } = LEVEL_RANGE[level];
  return Array.from({ length: count }, () => {
    const x = randInt(min, max);
    const known = randInt(min, max);
    return numericMcq(`Find X: X - ${known} = ${x - known >= 0 ? x - known : known - x}`, x, 6);
  });
}

function generateLogicalSequences(level: GameLevel, count: number): McqQuestion[] {
  return Array.from({ length: count }, () => {
    const ratio = level === "beginner" ? 2 : level === "intermediate" ? 3 : 5;
    const start = randInt(1, 4);
    const seq = [start, start * ratio, start * ratio * ratio];
    return numericMcq(`What is the next number? ${seq.join(", ")}, ?`, start * ratio * ratio * ratio, Math.max(10, seq[2]));
  });
}

function generateVocabulary(count: number): McqQuestion[] {
  const words = shuffle(VOCABULARY_WORDS).slice(0, count);
  return words.map((w) => {
    const wrongMeanings = shuffle(VOCABULARY_WORDS.filter((v) => v.word !== w.word)).slice(0, 3).map((v) => v.meaning);
    const options = shuffle([w.meaning, ...wrongMeanings]);
    return { id: uid(), prompt: `What does "${w.word}" mean?`, options, correctIndex: options.indexOf(w.meaning) };
  });
}

function generateGeneralKnowledge(count: number): McqQuestion[] {
  return shuffle(GENERAL_KNOWLEDGE)
    .slice(0, count)
    .map((q) => {
      const correctText = q.options[q.correctIndex];
      const options = shuffle(q.options);
      return { id: uid(), prompt: q.question, options, correctIndex: options.indexOf(correctText) };
    });
}

/** Procedurally generates `count` MCQ questions for any of the 11 MCQ-engine games, scaled to the chosen level. */
export function generateMcqQuestions(gameKey: string, level: GameLevel, count: number): McqQuestion[] {
  switch (gameKey) {
    case "multiplication_table":
      return generateMultiplicationTable(level, count);
    case "addition":
      return generateAddition(level, count);
    case "subtraction":
      return generateSubtraction(level, count);
    case "mental_math":
      return generateMentalMath(level, count);
    case "number_puzzles":
      return generateNumberPuzzles(level, count);
    case "number_sequences":
      return generateNumberSequences(level, count);
    case "pattern_recognition":
      return generatePatternRecognition(level, count);
    case "missing_numbers":
      return generateMissingNumbers(level, count);
    case "logical_sequences":
      return generateLogicalSequences(level, count);
    case "vocabulary":
      return generateVocabulary(count);
    case "general_knowledge":
      return generateGeneralKnowledge(count);
    default:
      return [];
  }
}

const NUMBER_WORDS = [
  "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];

/** Builds `count` pairs for the memory-match engine. "Identical" games show the same face on both cards of a pair; "associative" games (matching_puzzles/word_matching) show a term on one card and its match on the other. */
export function generateMatchPairs(gameKey: string, level: GameLevel, count: number): MatchPair[] {
  const n = Math.min(count, level === "beginner" ? 6 : level === "intermediate" ? 8 : 10);
  switch (gameKey) {
    case "memory_cards":
      return shuffle(MEMORY_ICONS).slice(0, n).map((icon) => ({ id: uid(), a: icon, b: icon }));
    case "memory_activities":
      return shuffle(MEMORY_ICONS).slice(0, n).map((icon) => ({ id: uid(), a: icon, b: icon }));
    case "shape_matching":
      return shuffle(SHAPE_ICONS).slice(0, Math.min(n, SHAPE_ICONS.length)).map((shape) => ({ id: uid(), a: shape, b: shape }));
    case "word_matching":
      return shuffle(WORD_MATCH_PAIRS).slice(0, Math.min(n, WORD_MATCH_PAIRS.length)).map((p) => ({ id: uid(), a: p.word, b: p.meaning }));
    case "matching_puzzles": {
      const numbers = shuffle(Array.from({ length: 20 }, (_, i) => i + 1)).slice(0, Math.min(n, 20));
      return numbers.map((num) => ({ id: uid(), a: String(num), b: NUMBER_WORDS[num - 1] }));
    }
    default:
      return [];
  }
}
