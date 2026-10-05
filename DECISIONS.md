# Decisions

Choices made where the build spec was ambiguous or left room, following its rule: pick the simplest option that keeps the game fun and on time.

## Rules and scoring

- **Other teams' home tiles are impassable.** Homes can never be stolen, and they sit on the map's corners, so nothing needs to path through one.
- **A ship that holds position always keeps its tile.** If another team targets a tile where a ship is standing still, the mover loses that clash whatever the round scores are, because the stationary ship has nowhere to bounce back to.
- **Clash fallback.** After the 10-iteration cap, teams still in conflict return to their origin; this is repeated until no two ships share a tile (all ships at their origins is always valid).
- **Ties.** Equal round scores in a clash or paint contest are broken by one seeded random draw per team per round. Tied votes are broken by the seeded RNG.
- **The swamp penalty applies only when a ship *moves onto* a swamp.** A ship stuck there with 0 MP is not penalised again each round, which would be a death spiral.
- **Heckler is not spent if you are the outright leader** (it would have no target). If you are tied for the lead it hits the other leader.
- **Mic Drop still fires if you get bounced**; it claims the tiles around wherever you actually land.
- **Card pickups and tie-breaks are drawn from a stream seeded per round**, so a reloaded host reproduces the same outcome.
- **"Connected during the phase"** for team accuracy means connected when the phase ends, plus anyone who answered.
- **Region wedges are centred on each team's home corner,** so every team starts in "its" criterion region. Each region has exactly 20 tiles. One starting chest is placed in each region (mid ring), so no team starts closer to treasure than another.
- **Region Mastery needs a strict lead** (and at least 5 tiles). A tie for most tiles gives nobody the bonus. The plaza is not a region.
- **The Keynote Stage tile is worth its 100 bonus** and is not also counted as a ×10 tile.
- **Spotlight round scores** (used only for clashes that round): speakers use their star average × 200; audience teams use 400 + 100 for Fair Judge − 100 × their deviation from the room.
- **Unrated speeches count as 3★** (2 MP). A featured team with nobody connected gets the 1 MP minimum.
- **Fair Judge for a speaking team** is not awarded; they earn speaker MP instead. Their ratings of the *other* speaker still count toward that speaker's score and toward the individual Fair Judge award.
- **Each speaker gets a different topic and twist,** and Speaker B's is only shown when their turn starts, so B gets no extra preparation time. Six twists, six speakers: each twist is used once.
- **Final Showdown "most correct answers"** is measured as summed team accuracy over the three questions, so team size doesn't matter. Within a flood wave the lowest-scoring team claims first. If no team gets anything right, the Stage stays unclaimed.
- **Rounds 10–12** take the three criteria with the lowest room accuracy so far, worst first, without repeating a criterion.
- **Quick Draw award** prefers players with at least 3 correct answers, so one lucky fast tap can't win it.
- **First answer locks in.** Votes and ratings can be changed until the phase ends (the latest one wins).
- **Team switching** is allowed in the lobby only.

## Networking

- **One broadcast event carries everything for a phase.** The spec lists separate `reveal`, `resolution`, `spotlight`, `results` and `debrief` events; their payloads travel inside `phase.publicData` instead, so a phone that joins or reconnects mid-phase gets the whole picture from a single message. `lobby`, `phase`, `tick`, `map` and `voteTally` are separate events as specified. The full map is resent after each resolution rather than diffs (it is about 9 KB).
- **A `join` message** was added alongside `hello` so the host learns a player's name and team even if Presence is slow to sync; Presence remains the source of truth for who is connected. A host that reloads rebuilds its player list from Presence.
- **Local mode.** With no Supabase keys the app uses the browser's BroadcastChannel so tabs in one browser can play together. This is for rehearsal, development and Manual Mode. The lobby shows a warning.
- **The bot simulator uses one connection for all bots** (one Presence entry carrying the bot list), so 40 bots don't use 40 of the Supabase connection allowance. Bots know the question bank and answer correctly at a configurable rate (default 60%) so rehearsals produce realistic movement.
- **Inputs are visible on the channel.** Supabase Broadcast delivers every message to every subscriber, so a determined player could read rivals' votes or answers with developer tools. The answer *key* never leaves the host before the Reveal. For a classroom game this was judged acceptable against the cost of running a server.

## Screens

- **Manual Mode destinations are picked on a map panel** on the host screen (the same mini-map the phones use) rather than by clicking the 3D map. It shows each team's reachable hexes and costs the same way phones do.
- **Manual Mode accuracy bands can be set during the Challenge or the Reveal.** The answer is on screen during the Reveal, so the operator scores the show of hands then. Unset teams count as 50–79%.
- **Manual Mode Final Showdown records each team's TRUE/FALSE answer,** not whether it was right, so the operator's clicks don't give the answer away on the projector.
- **`/guide` has four sheets:** the two-page facilitator guide, plus the question bank (the "printed copy of the questions" backup) and the QR poster.
- **Projector type sizes.** Questions are 46 px and primary text is 28 px or larger on the 1920×1080 canvas. A few secondary labels (scoreboard counts, hints) are 20–26 px. The HUD is laid out at 1920×1080 and scaled to the window, so 1280×720 shows the same layout.
- **The Final Showdown "orbit"** is a slow sway and zoom of the map; the tiles are pre-drawn 2.5D so a true orbit isn't possible.
- **Rehearsal speed** is any value up to 60 (`/host?speed=10`). Clocks on phones show real seconds remaining during a sped-up rehearsal.
- **The team palette** differs from the spec's suggested hex values in exact shade (names and emblems are as specified). It was chosen by searching for the largest minimum pairwise difference under simulated protanopia, deuteranopia and tritanopia; `tests/colors.test.ts` enforces it.
- **Sound** is fully synthesized, including the music loop, so there are no audio files to license.
- **Low-effects fallback.** Bloom and water displacement switch off automatically if frames stay slow, or with `/host?fx=low`.

## Tooling

- **TypeScript 5.x** rather than 7.x, for compatibility with Next.js's type-check step.
- **The end-to-end test uses `playwright-core` with the installed Microsoft Edge,** so no browser download is needed.
