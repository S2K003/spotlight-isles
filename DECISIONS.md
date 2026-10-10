# Decisions

**[SPOTLIGHT_ISLES_BUILD_SPEC.md](SPOTLIGHT_ISLES_BUILD_SPEC.md) describes the first version** (12 rounds, territory, power cards, a Final Showdown). The game has been simplified twice since, after review. This file and the README describe what the code does now. What carried over unchanged from the spec: the 15:00 total, the lobby and joining flow, host-authoritative networking, reload/resume, Manual Mode, the renderer and the printable guide.

## What the reviews asked for, and what changed

| Asked for | What the game does now |
|---|---|
| Simple and clear, with one goal | Fly to your key, then to the Keynote Stage. Five rules in total. Removed over the two rounds of simplification: power cards, chests, swamps, fog, territory scoring, speed bonuses, the Final Showdown, individual awards, ship collisions, the "tailwind" and "fair judge" rules. |
| Mostly group discussion, room to breathe | Six rounds. 45 s to discuss a question. Answers can be changed until time runs out. Music drops while people talk. |
| More time to prepare and speak | Pitch prep is 48 s and each pitch is 40 s (they were 30 s and 25 s). |
| Less time and effort choosing a move | The move decision is 15 s (was 35 s). The phone shows the best hex in green with one GO button, and a group that doesn't choose flies the best route automatically. |
| No collisions | Ships never block each other; any number can share a hex. |
| Every group pitches at least and at most once, chosen fairly | A spin at the start of each pitch round draws two groups from those that have not pitched yet. The order is random and unknown in advance; by round 6 every group has pitched exactly once. |
| A pitch always has a specific topic, displayed | Each group gets its own topic. It is on the projector and the group's phones from the start of prep, and stays on the projector while they speak. |
| Groups named Group 1 to Group 6 | Done (still renameable in the lobby). |
| Strictly 15 minutes | A test fails if the phases don't sum to exactly 900 s. |
| At least one group must complete the goal | Stronger than asked: every group that follows the suggested route reaches the Stage. See below. |
| Questions related to GSOE9010 | Eight scenarios about presenting research; three are drawn per game. |
| The group with the most points moves first | Ships move one at a time in score order. |
| Fair for all groups | The map is rotationally symmetric (identical for every group). Group accuracy is a share, so group size doesn't matter. |

## Why the goal is always reachable

- Every group moves **at least 2 steps every round**, whatever happens, for 6 rounds: at least 12 steps.
- Every generated map has a route (home → own key → Stage) of **11 or 12 steps**.
- The suggested move always shortens the remaining route by the full number of steps, and a ship picks up its key in passing rather than having to stop on it.

So a group that taps GO each round (or does nothing at all) is at the Stage by round 6. Tests check this for 40 maps with every answer wrong, and with no phones touched. Groups that answer and pitch well arrive in round 4 or 5; nobody can arrive before round 4.

## Rules decisions

- **Steps:** question right (half the group or more) 3, otherwise 2. Pitching group: 4★ or more 4, 3★ or more 3, otherwise 2.
- **Audience groups in a pitch round move 2 steps and earn 10 points for marking.** An earlier version gave them a third step for marking; in rehearsal that made every group arrive together in round 4 with nothing left to play for, so marking now earns points instead.
- **Points:** 10 per step earned, 10 for marking, 10 for your key, 10 per star, and 50 / 40 / 30 / 20 / 10 / 10 for reaching the Stage in arrival order. Docked groups keep earning points from questions and pitches.
- **"Most points moves first"** uses the total score including that round's points; ties are broken by a seeded draw. With no collisions, moving first only matters for stars and for arrival order.
- **Both pitching groups prepare at the same time.** The second group therefore has a little longer to think while the first one speaks; with a fixed 15 minutes the alternative was a shorter prep for everyone.
- **Arrival bonuses slightly favour groups drawn to pitch early,** because a strong pitch gives its extra steps sooner. The spin makes that luck rather than a fixed advantage.
- **Keys are personal** and on the opposite island; other groups' keys are left alone. You can't fly through the Stage.
- **Pitches are a group effort:** the group chooses its own speaker. Self-marking is blocked. With five or more groups marking, the highest and lowest averages are dropped. An unrated pitch counts as 3★.
- **The coloured trail** a ship leaves is decoration only.

## Course content and the assessment task

- **Topic: presentation skills.** The ten discussion questions and the six pitch topics are all about presenting (structure, slides, voice and pace, eye contact, notes, timing, teamwork, engaging the audience, handling questions). The pitch topics are about presenting too, so each pitch demonstrates the skill it describes. They were written without access to the Week 5 lecture material, so **check `content/questions.ts` and `content/spotlight.ts` against it.**
- **The game is the third, original activity.** The assessment task asks for a 55–60 minute session with three activities of about a third each, plus an introduction and conclusion. The plan is 58 minutes: 4 + 16 + 16 + 16 + 6. The game keeps its exact 15:00; the sixteenth minute is for checking every group has joined.
- **The two suggested activities are placeholders.** Their instructions are only on Moodle, so `/plan` and `/slides` have editable boxes for them with prompts, and suggested modifications clearly marked as suggestions. Nothing about them is invented.
- **Research evidence is a scaffold, not a claim.** `/plan` page 6 maps each principle to where it appears in the game and leaves the source column and the "what we studied" and "our rehearsal" boxes for the group to fill in. No references are supplied, because the evidence has to be of the group's own reading.
- **Teamwork is designed in.** The rubric's top band needs every facilitator in every activity and a shared introduction and conclusion, so the plan has a role table for every part of the hour, and the game host changes every two rounds.
- **Typed text lives in the browser** (localStorage), shared between the plan, slides and pack. That keeps the site free of any database; the cost is that it has to be filled in and printed on the same computer.
- **Phones and the engagement criterion.** The rubric's top band says "no looking at phones". Phones are this activity's controller, so the phone screens say "phones down, eyes up" during pitches, the plan says so explicitly, and Manual Mode runs the game with no phones.

## Networking

- **One broadcast event carries everything for a phase** (`phase.publicData`), so a phone that joins or reconnects mid-phase gets the whole picture from one message. Lobby updates are batched.
- **Local mode.** With no Supabase keys the app uses the browser's BroadcastChannel so tabs in one browser can play together.
- **The bot simulator uses one connection for all bots.**
- **Inputs are visible on the channel.** A player with developer tools could read rivals' votes or answers. The answer key never leaves the host before the reveal.
- **Either Supabase key name works:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or the older `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Screens

- **Manual Mode:** after a show of hands, click "half or more got it" or "fewer than half" per group. Ships fly the best route by themselves; a destination only needs clicking if a group wants a different hex. Pitches get 1–5 stars.
- **`/guide` has four sheets:** the two-page facilitator guide, the question bank and the QR poster.
- **The HUD is laid out at 1920×1080 and scaled to the window.**
- **The group palette** was chosen by searching for the largest minimum pairwise difference under simulated colour blindness; a test enforces it. Each group also has its own emblem shape.
- **Sound** is fully synthesized. **Low-effects fallback:** `/host?fx=low`, or automatic if frames stay slow.

## Tooling

- **TypeScript 5.x** rather than 7.x, for compatibility with Next.js's type-check step.
- **The end-to-end test uses `playwright-core` with the installed Microsoft Edge.**
