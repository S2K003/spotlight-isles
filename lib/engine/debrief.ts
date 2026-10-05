import { QUESTION_BY_ID, QUESTIONS } from "@/content/questions";
import type { DebriefData, Rating, StatCount } from "./types";

export const CLOSING_PROMPT = "Tell us one thing you learned, or something you liked about today.";

/**
 * Debrief: how the room did on each question (hardest first), the room's pitch averages, which
 * pitch skill was strongest and which needs work, and takeaways from the questions asked.
 */
export function computeDebrief(
  asked: string[],
  questionStats: Record<string, StatCount>,
  spotTotals: { hook: number; clarity: number; confidence: number; n: number },
): DebriefData {
  const questions = asked
    .filter((id) => QUESTION_BY_ID[id])
    .map((id) => {
      const s = questionStats[id];
      const q = QUESTION_BY_ID[id];
      return { id, prompt: q.prompt, accuracy: s && s.total > 0 ? s.correct / s.total : null, why: q.why };
    })
    .sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2) || a.id.localeCompare(b.id));

  const spotlight: Rating | null = spotTotals.n
    ? { hook: spotTotals.hook / spotTotals.n, clarity: spotTotals.clarity / spotTotals.n, confidence: spotTotals.confidence / spotTotals.n }
    : null;

  let strongest: keyof Rating | null = null;
  let weakest: keyof Rating | null = null;
  if (spotlight) {
    const keys: (keyof Rating)[] = ["hook", "clarity", "confidence"];
    strongest = keys.reduce((a, b) => (spotlight[b] > spotlight[a] ? b : a));
    weakest = keys.reduce((a, b) => (spotlight[b] < spotlight[a] ? b : a));
    if (spotlight[strongest] === spotlight[weakest]) strongest = weakest = null;
  }

  const takeaways = questions.map((q) => q.why);
  for (const q of QUESTIONS) {
    if (takeaways.length >= 3) break;
    if (!takeaways.includes(q.why)) takeaways.push(q.why);
  }

  return { questions, spotlight, strongest, weakest, takeaways: takeaways.slice(0, 3), prompt: CLOSING_PROMPT };
}
