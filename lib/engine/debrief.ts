import { CRITERIA } from "@/config/rubric";
import { QUESTIONS, QUESTION_BY_ID } from "@/content/questions";
import type { CriterionKey, DebriefData, StatCount } from "./types";

export const CLOSING_PROMPT = "Tell us one thing you learned, or something you liked about today.";

/**
 * Section 9 debrief: room-wide accuracy per criterion, the strongest skill and the one to work
 * on, and three takeaways taken from the explanations of the questions the room got most wrong.
 */
export function computeDebrief(
  critStats: Record<CriterionKey, StatCount>,
  questionStats: Record<string, StatCount>,
  spotTotals: { hook: number; clarity: number; confidence: number; n: number },
): DebriefData {
  const criteria = {} as Record<CriterionKey, number | null>;
  for (const c of CRITERIA) {
    const s = critStats[c];
    criteria[c] = s && s.total > 0 ? s.correct / s.total : null;
  }

  const scored = CRITERIA.filter((c) => criteria[c] !== null);
  let strongest: CriterionKey | null = null;
  let weakest: CriterionKey | null = null;
  for (const c of scored) {
    if (strongest === null || (criteria[c] as number) > (criteria[strongest] as number)) strongest = c;
    if (weakest === null || (criteria[c] as number) < (criteria[weakest] as number)) weakest = c;
  }
  if (strongest === weakest && scored.length < 2) weakest = null;

  const asked = Object.keys(questionStats)
    .filter((id) => QUESTION_BY_ID[id] && questionStats[id].total > 0)
    .map((id) => ({ id, acc: questionStats[id].correct / questionStats[id].total }))
    .sort((a, b) => a.acc - b.acc || a.id.localeCompare(b.id));
  const takeaways = asked.slice(0, 3).map((a) => QUESTION_BY_ID[a.id].why);
  // No data (e.g. Manual Mode): fall back to one takeaway from each of the first criteria.
  for (const q of QUESTIONS) {
    if (takeaways.length >= 3) break;
    if (!takeaways.includes(q.why) && q.id.endsWith("1")) takeaways.push(q.why);
  }

  return {
    criteria,
    spotlight: spotTotals.n
      ? {
          hook: spotTotals.hook / spotTotals.n,
          clarity: spotTotals.clarity / spotTotals.n,
          confidence: spotTotals.confidence / spotTotals.n,
        }
      : null,
    strongest,
    weakest,
    takeaways: takeaways.slice(0, 3),
    prompt: CLOSING_PROMPT,
  };
}
