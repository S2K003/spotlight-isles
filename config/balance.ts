export const MAP_RADIUS = 4;

/** Obstacles and tokens placed in EACH of the six wedges (the map is rotationally symmetric, so it is identical for every team). */
export const WEDGE = { water: 2, fog: 1, keys: 1, stars: 1 };

/** Cost in steps to ENTER a tile. Fog is slow; water can't be crossed. */
export const TILE_COST = { land: 1, plaza: 1, stage: 1, fog: 2 } as const;

/**
 * Each team's key is on the opposite island. The route home → own key → Stage must take between
 * this many steps on every map, so the journey lasts most of the game.
 */
export const ROUTE_MIN = 10;
export const ROUTE_MAX = 12;

/** Team accuracy on a question → steps. Everyone always moves at least 1: nobody is left behind. */
export const STEP_BANDS = [
  { min: 0.8, steps: 3 },
  { min: 0.5, steps: 2 },
];
export const MIN_STEPS = 1;
export const MAX_STEPS = 4;

/** Pitch star average → steps for the speaking team. */
export const PITCH_BANDS = [
  { min: 4, steps: 3 },
  { min: 3, steps: 2 },
];
/** Audience teams: rating the pitch earns 2 steps, rating it fairly (close to the room) earns 3. */
export const AUDIENCE_STEPS = { none: 1, rated: 2, fair: 3 };
export const FAIR_JUDGE_TOLERANCE = 0.5;
export const SPOTLIGHT_TRIM_MIN_TEAMS = 5;

/** The team in last place gets a tailwind: +1 step. */
export const TAILWIND_STEPS = 1;

export const POINTS = {
  perStep: 10,
  key: 10,
  star: 10,
  /** Bonus for reaching the Keynote Stage, by arrival order. */
  dock: [50, 40, 30, 20, 20, 20],
};

/** Representative accuracy for each Manual Mode band (0%, 1–49, 50–79, 80+). */
export const MANUAL_BAND_ACCURACY = [0, 0.3, 0.65, 0.9];
export const MANUAL_DEFAULT_BAND = 2;

export const TOTAL_ROUNDS = 6;
