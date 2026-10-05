import { CARD_ODDS, MAX_CARDS } from "@/config/balance";
import { weightedPick, type Rng } from "./rng";
import type { CardId, Team, TeamId } from "./types";

export function drawCard(rng: Rng): CardId {
  return weightedPick(
    rng,
    CARD_ODDS.map((c) => ({ weight: c.weight, value: c.card })),
  );
}

/** Add a card to a hand. A hand holds at most MAX_CARDS; when full, the oldest card is replaced. */
export function giveCard(cards: CardId[], card: CardId): CardId[] {
  const next = cards.concat(card);
  while (next.length > MAX_CARDS) next.shift();
  return next;
}

export function removeCard(cards: CardId[], card: CardId): CardId[] {
  const i = cards.indexOf(card);
  return i < 0 ? cards : cards.slice(0, i).concat(cards.slice(i + 1));
}

/**
 * Heckler targets the current score leader, as long as that isn't the team playing it.
 * Returns null when the playing team is the outright leader (the card is then not spent).
 */
export function hecklerTarget(teams: Pick<Team, "id" | "score">[], self: TeamId): TeamId | null {
  const me = teams.find((t) => t.id === self);
  const others = teams.filter((t) => t.id !== self).sort((a, b) => b.score - a.score || a.id - b.id);
  if (!me || !others.length) return null;
  return others[0].score >= me.score ? others[0].id : null;
}
