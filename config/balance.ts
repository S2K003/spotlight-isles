export const MAP_RADIUS = 4;

/** Obstacles and tokens placed in EACH of the six wedges (the map is rotationally symmetric, so it is identical for every team). */
export const WEDGE = { water: 2, keys: 1, stars: 1 };

/**
 * Each team's key is on the opposite island. The route home → own key → Stage takes between this
 * many steps on every map. ROUTE_MAX must not exceed MIN_STEPS × the number of rounds: that is
 * what guarantees a team following the suggested route reaches the Stage by the last round.
 */
export const ROUTE_MIN = 11;
export const ROUTE_MAX = 12;

/** Every team moves at least this far every round, whatever happens. */
export const MIN_STEPS = 2;
export const GOOD_STEPS = 3;
export const GREAT_STEPS = 4;

/** Question: this share of the team (or more) choosing the best answer earns GOOD_STEPS. */
export const QUESTION_PASS = 0.5;
/** Pitch: star average needed for GOOD_STEPS and GREAT_STEPS. */
export const PITCH_GOOD = 3;
export const PITCH_GREAT = 4;
export const SPOTLIGHT_TRIM_MIN_TEAMS = 5;

export const POINTS = {
  perStep: 10,
  /** Audience groups earn this for marking the pitches (points decide who moves first). */
  mark: 10,
  key: 10,
  star: 10,
  /** Bonus for reaching the Keynote Stage, by arrival order. */
  dock: [50, 40, 30, 20, 10, 10],
};

export const TOTAL_ROUNDS = 6;
