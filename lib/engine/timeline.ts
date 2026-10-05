import { DUR, FINAL_QUESTIONS, ROUNDS } from "@/config/timeline";
import type { Phase, PhaseKind } from "./types";

/** Build the full phase list from config. Offsets are cumulative from 0, so drift can't build up. */
export function buildTimeline(): Phase[] {
  const phases: Phase[] = [];
  let offset = 0;
  const push = (id: string, kind: PhaseKind, seconds: number, round?: number, meta?: Record<string, unknown>) => {
    phases.push({ id, kind, round, startOffsetMs: offset, durationMs: seconds * 1000, meta });
    offset += seconds * 1000;
  };

  push("intro", "intro", DUR.intro);

  ROUNDS.forEach((def, i) => {
    const round = i + 1;
    const p = `r${round}`;
    if (def.kind === "standard") {
      push(`${p}-challenge`, "challenge", DUR.challenge, round, { criterion: def.criterion });
      push(`${p}-reveal`, "reveal", DUR.reveal, round);
    } else {
      push(`${p}-ready`, "spotReady", DUR.spotReady, round, { teams: def.teams });
      push(`${p}-speakA`, "spotSpeak", DUR.spotSpeak, round, { slot: 0 });
      push(`${p}-rateA`, "spotRate", DUR.spotRate, round, { slot: 0 });
      push(`${p}-speakB`, "spotSpeak", DUR.spotSpeak, round, { slot: 1 });
      push(`${p}-rateB`, "spotRate", DUR.spotRate, round, { slot: 1 });
      push(`${p}-spotReveal`, "spotReveal", DUR.spotReveal, round);
    }
    push(`${p}-vote`, "vote", DUR.vote, round);
    push(`${p}-resolve`, "resolve", DUR.resolve, round);
  });

  push("final-banner", "finalBanner", DUR.finalBanner);
  for (let i = 0; i < FINAL_QUESTIONS; i++) {
    push(`final-q${i + 1}`, "finalQ", DUR.finalQ, undefined, { qIndex: i });
    push(`final-reveal${i + 1}`, "finalReveal", DUR.finalReveal, undefined, { qIndex: i });
  }
  push("final-flood", "finalFlood", DUR.finalFlood);
  push("results", "results", DUR.results);
  push("debrief", "debrief", DUR.debrief);
  return phases;
}

export const TIMELINE: Phase[] = buildTimeline();
export const TIMELINE_TOTAL_MS: number = TIMELINE.reduce((s, p) => s + p.durationMs, 0);

/** Index of the phase containing `elapsedMs` of game time; TIMELINE.length once the game is over. */
export function phaseIndexAt(elapsedMs: number): number {
  if (elapsedMs >= TIMELINE_TOTAL_MS) return TIMELINE.length;
  for (let i = TIMELINE.length - 1; i >= 0; i--) {
    if (elapsedMs >= TIMELINE[i].startOffsetMs) return i;
  }
  return 0;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
