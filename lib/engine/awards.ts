import type { Award, PersonalStats, Player } from "./types";

type P = Pick<Player, "id" | "name" | "teamId" | "stats">;

function winner(players: P[], eligible: (p: P) => boolean, better: (a: P, b: P) => number): P | null {
  const pool = players.filter(eligible).sort((a, b) => better(a, b) || a.id.localeCompare(b.id));
  return pool[0] ?? null;
}

const avgMs = (p: P) => (p.stats.correct ? p.stats.correctMs / p.stats.correct : Infinity);
const avgDev = (p: P) => (p.stats.ratings ? p.stats.ratingDev / p.stats.ratings : Infinity);

/** Section 9: the four individual award cards. */
export function computeAwards(playerList: P[]): Award[] {
  const players = playerList.slice().sort((a, b) => a.id.localeCompare(b.id));
  const make = (key: Award["key"], icon: string, title: string, p: P | null, detail: (p: P) => string): Award => ({
    key,
    icon,
    title,
    playerId: p?.id ?? null,
    name: p?.name ?? "—",
    teamId: p?.teamId ?? null,
    detail: p ? detail(p) : "No winner this time",
  });

  const speaker = winner(
    players,
    (p) => typeof p.stats.spotlight === "number",
    (a, b) => (b.stats.spotlight as number) - (a.stats.spotlight as number),
  );
  // Prefer players with at least 3 correct answers so one lucky tap can't take Quick Draw.
  const quickPool = players.some((p) => p.stats.correct >= 3) ? 3 : 1;
  const quick = winner(
    players,
    (p) => p.stats.correct >= quickPool,
    (a, b) => avgMs(a) - avgMs(b),
  );
  const judge = winner(
    players,
    (p) => p.stats.ratings > 0,
    (a, b) => avgDev(a) - avgDev(b) || b.stats.ratings - a.stats.ratings,
  );
  const master = winner(
    players,
    (p) => p.stats.correct > 0,
    (a, b) => b.stats.correct - a.stats.correct || avgMs(a) - avgMs(b),
  );

  return [
    make("speaker", "🎤", "Best Speaker", speaker, (p) => `${(p.stats.spotlight as number).toFixed(1)} ★ Spotlight average`),
    make("quick", "⚡", "Quick Draw", quick, (p) => `${(avgMs(p) / 1000).toFixed(1)} s average correct answer`),
    make("judge", "⚖️", "Fair Judge", judge, (p) => `Within ${avgDev(p).toFixed(2)} ★ of the room`),
    make("master", "🧠", "Rubric Master", master, (p) => `${p.stats.correct} correct answers`),
  ];
}

export function personalStats(players: P[]): Record<string, PersonalStats> {
  const out: Record<string, PersonalStats> = {};
  for (const p of players) {
    out[p.id] = {
      correct: p.stats.correct,
      answered: p.stats.answered,
      avgMs: p.stats.correct ? Math.round(p.stats.correctMs / p.stats.correct) : null,
      ratings: p.stats.ratings,
      spotlight: p.stats.spotlight ?? null,
    };
  }
  return out;
}
