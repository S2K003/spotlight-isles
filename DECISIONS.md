# Decisions

## Version 2: the simplified game

The first build followed [SPOTLIGHT_ISLES_BUILD_SPEC.md](SPOTLIGHT_ISLES_BUILD_SPEC.md) closely (12 rounds, territory painting, power cards, a Final Showdown). After review it was redesigned to be simpler, slower and built around team discussion. **The spec file describes version 1; this file and the README describe what the code does now.** What carried over unchanged: the 15:00 total, the lobby and joining flow, host-authoritative networking, reload/resume, Manual Mode, the renderer and the printable guide.

| Asked for | What changed |
|---|---|
| Less complicated, clear to everyone | One goal (reach the Keynote Stage) and five rules. Removed: power cards, chests, swamps, territory scoring, region mastery, Quick Draw, Stage Fright, the Final Showdown, individual awards, ordering questions and pitch "twists". |
| Mostly team discussion, room to breathe | Six rounds instead of twelve. 45 s to discuss a question, 30 s to prepare a pitch, 35 s to agree a move. No speed bonus. Answers can be changed until time runs out. Music drops while people talk. |
| Challenges on the map, a tricky route to the destination | Each team's key is on the **opposite island**, so every crew has to cross the map and each other. Water blocks, fog costs double, and you can't land on another ship. |
| Smaller map | Radius 4 (61 hexes) instead of radius 6 (127). |
| Questions related to GSOE9010 | Eight scenarios about presenting research (pitching a project, a literature review, citing a figure on a slide, group presentations, handling a limitation in Q&A). Three are drawn per game. |
| A mix of questions and team pitches rated by other teams, for movement | Rounds alternate question / pitch. The pitching team's star average becomes its steps; the audience earns steps by marking. Every team pitches exactly once. |
| The team with the most points moves first | Ships move one at a time in score order. Moving first matters: you get the hex and the star. |
| Fair and easy for all teams | The map is rotationally symmetric (identical for every team). Every team always moves at least 1 step. Last place gets +1 step. Team accuracy is a share, so team size doesn't matter. |

## Rules decisions

- **The game still lasts exactly 15:00.** The workshop slot is fixed, so the breathing room comes from having half as many rounds, not from an open-ended clock. Durations are in `config/timeline.ts`.
- **Route length is fixed at 10–12 steps** (home → own key → Stage) on every generated map. Simulation showed that a nearby key let most ships finish in round 3 with nothing left to do, and that longer routes left most ships short. With this range nobody arrives before round 4 and typically four or five of six arrive by the end.
- **"Most points moves first" uses the total score,** including the points just earned that round. Ties are broken by a seeded draw. Ships already at the Stage don't move.
- **Blocking.** A ship can fly *through* a hex with another ship on it but can't *land* there; it stops one hex short. A ship that hasn't moved yet still blocks. Any number of ships can dock at the Stage.
- **A wrong answer still moves 1 step** (but scores 0 points). Nobody is ever stuck.
- **Tailwind:** the team or tied teams in last place among those still flying get +1 step, unless every team is level.
- **Points:** 10 per step earned, 10 for your key, 10 per star, and 50 / 40 / 30 / 20 for reaching the Stage in arrival order. Docked teams keep earning points from questions and pitches.
- **Keys are personal.** A team can only pick up its own key; other teams' keys are left where they are.
- **You can't fly through the Stage** and out the other side. Arriving there ends the journey.
- **Pitches are a team effort.** The team chooses its own speaker during the 30 s prep instead of the game picking a random person. The topic is shown on the pitching team's phones during prep and on the projector only when they speak.
- **Audience steps:** didn't mark 1, marked 2, marked fairly (within 0.5★ of the room on every pitch) 3. Self-marking is blocked. With five or more teams marking, the highest and lowest team averages are dropped. An unrated pitch counts as 3★.
- **The coloured trail** a ship leaves is decoration only.
- **Questions avoid repeating a criterion** within a game where possible.

## Course content

I do not have the GSOE9010 course outline. The questions and pitch topics assume it is a research-skills course for engineering coursework students and that this workshop is about oral presentations, as described in the request. **Check `content/questions.ts` and `content/spotlight.ts` against the actual course material and rubric before the session.**

## Networking

- **One broadcast event carries everything for a phase** (`phase.publicData`), so a phone that joins or reconnects mid-phase gets the whole picture from one message. `lobby`, `phase`, `tick`, `map` and `voteTally` are separate events. Lobby updates are batched.
- **Local mode.** With no Supabase keys the app uses the browser's BroadcastChannel so tabs in one browser can play together (rehearsal, development, Manual Mode).
- **The bot simulator uses one connection for all bots.** Bots answer as teams, fly toward their key and then the Stage, and mark pitches.
- **Inputs are visible on the channel.** Supabase Broadcast delivers every message to every subscriber, so a player with developer tools could read rivals' votes or answers. The answer key never leaves the host before the reveal.
- **Either Supabase key name works:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or the older `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Screens

- **Manual Mode** records a show of hands as None / A few / About half / Most, destinations on a map panel (teams listed in move order), and 1–5 stars per pitch.
- **`/guide` has four sheets:** the two-page facilitator guide, the question bank and the QR poster.
- **The HUD is laid out at 1920×1080 and scaled to the window.**
- **The team palette** was chosen by searching for the largest minimum pairwise difference under simulated protanopia, deuteranopia and tritanopia; `tests/colors.test.ts` enforces it. Each team also has its own emblem shape.
- **Sound** is fully synthesized. **Low-effects fallback:** bloom and water distortion switch off automatically if frames stay slow, or with `/host?fx=low`.

## Tooling

- **TypeScript 5.x** rather than 7.x, for compatibility with Next.js's type-check step.
- **The end-to-end test uses `playwright-core` with the installed Microsoft Edge,** so no browser download is needed.
