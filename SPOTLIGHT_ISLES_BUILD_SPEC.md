# SPOTLIGHT ISLES — Build Spec
### A 15-minute, 6-team, real-time multiplayer strategy game about presentation skills
**For:** GSOE9010 Week 5 – Presentation Skills (FC4) workshop · **Host:** Vercel · **Players:** ~6–50 on their phones + 1 projector screen

---

## 0. Instructions for Claude Code (read first)

You are building a complete, production-quality web game from this spec. Work through the **milestones in Section 14 in order** and do not skip the acceptance checks.

- Use **current stable versions** of every library and verify APIs against their docs before using them (don't rely on memory of old APIs, especially PixiJS v8 and Supabase Realtime).
- Keep the **game engine as pure TypeScript functions** (no React, no Pixi inside `/lib/engine`) so it can be unit-tested.
- The **15:00 duration is a hard requirement**. The timeline is data-driven, and a test must prove that the phases sum to exactly 900,000 ms.
- All art is **original and code-generated** (procedural hexes, shapes, gradients, particles). Do not use copyrighted characters, logos, or fonts that aren't free to use. Sound effects must be synthesized with WebAudio or taken from CC0 sources.
- When something in this spec is ambiguous, choose the simplest option that keeps the game fun and on time, and note the choice in `DECISIONS.md`.

---

## 1. The concept in one paragraph

Six teams (the project groups in the workshop) scan a QR code, pick their team on their phones, and wait in a lobby. When the facilitator presses **START**, a glowing archipelago appears on the projector. Every island region is named after a **presentation marking criterion**: Structure, Visuals, Delivery, Engagement, Timing, and Q&A. Each team controls one **airship crew** that starts on one of the six corners of the hex map. Every round, **all teams face the same presentation-skills challenge at the same time**. How well they do decides how many hexes they can move (winning gives more movement, losing gives less, and a total wipe-out means *Stage Fright*: no movement). Then each team's members **vote on their phones** for where their airship goes and whether to play a power card. All six ships **move simultaneously**, painting territory, clashing when two teams target the same hex, grabbing power-ups and dodging hazards. Three times in the game, a **Spotlight round** puts a random player on the spot to give a live 20-second mini-pitch out loud, and the other teams **mark it with a rubric** on their phones. The game ends at **exactly 15:00** with a Keynote Stage showdown, a podium ceremony, and a **debrief screen showing which presentation criteria the room mastered and which need work**. The facilitators use that screen straight away in the Closing.

### Learning objectives (shown on the intro screen and in the facilitator materials)
1. Recognise what makes a presentation strong across six marking criteria.
2. Practise a short oral pitch under time pressure, with a hook, clarity and confidence.
3. Practise **assessing** presentations against a rubric, fairly and consistently.
4. Make fast, collaborative team decisions through clear communication.

---

## 2. Where it fits in the workshop

Recommended placement: **Activity Three (the facilitators' own activity), extended to 15 minutes** by trimming Activity Two's pitch-prep time from 15 to 10 minutes. This keeps every suggested activity and objective intact. *(Confirm with your teammates and tutor. The game itself is always exactly 15:00.)*

| Time | Segment | Notes |
|---|---|---|
| 0:00 | Agenda (2 min) | Show the QR code on the slide so people join the lobby early |
| 0:02 | Activity One — Diagrams (15 min) | As per the outline |
| 0:17 | Activity Two — Elevator Pitch (15 min) | Prep shortened to 10 min |
| 0:32 | **Activity Three — SPOTLIGHT ISLES (15:00)** | The game |
| 0:47 | Closing (3 min) | Uses the game's debrief screen |

The lobby is open before the game starts and does **not** count toward the 15 minutes. The 15:00 clock starts only when the host presses START.

---

## 3. The exact 15:00 timeline (the game "itinerary")

All durations are in seconds. The engine builds this list from `config/timeline.ts`, and a unit test asserts that the total is **900**.

**Standard round = 46 s:** Challenge 20 → Reveal 6 → Team Vote 12 → Move Resolution 8
**Spotlight round = 87 s:** Get Ready 5 → Speaker A 20 → Rate A 8 → Speaker B 20 → Rate B 8 → Reveal 6 → Team Vote 12 → Move Resolution 8

| Clock | Phase | Duration |
|---|---|---|
| 00:00 – 00:40 | **Intro cinematic + how to play** (camera flies over the map, rules in 3 animated cards, objectives) | 40 |
| 00:40 – 01:26 | Round 1 — Standard (Structure) | 46 |
| 01:26 – 02:12 | Round 2 — Standard (Visuals) | 46 |
| 02:12 – 03:39 | Round 3 — **SPOTLIGHT** (Teams 1 & 2 speak) | 87 |
| 03:39 – 04:25 | Round 4 — Standard (Delivery) | 46 |
| 04:25 – 05:11 | Round 5 — Standard (Engagement) | 46 |
| 05:11 – 06:38 | Round 6 — **SPOTLIGHT** (Teams 3 & 4 speak) | 87 |
| 06:38 – 07:24 | Round 7 — Standard (Timing) | 46 |
| 07:24 – 08:10 | Round 8 — Standard (Q&A) | 46 |
| 08:10 – 09:37 | Round 9 — **SPOTLIGHT** (Teams 5 & 6 speak) | 87 |
| 09:37 – 10:23 | Round 10 — Standard (random criterion) | 46 |
| 10:23 – 11:09 | Round 11 — Standard (random criterion) | 46 |
| 11:09 – 11:55 | Round 12 — Standard (random criterion) | 46 |
| 11:55 – 13:10 | **FINAL SHOWDOWN: Keynote Stage** (3 rapid-fire true/false questions, then the territory flood) | 75 |
| 13:10 – 14:10 | **Results ceremony** (score count-up, podium, awards, confetti) | 60 |
| 14:10 – 15:00 | **Debrief screen** (room-wide rubric mastery + facilitator talking points), ending with a "GAME OVER — 15:00" card | 50 |
| **Total** | | **900** |

Final Showdown internal split (75 s): Banner 5 → Q1 12 + reveal 5 → Q2 12 + reveal 5 → Q3 12 + reveal 5 → Territory flood + Stage capture animation 19.

**Timing rules**
- The host keeps one master clock: `startedAt = Date.now()` when START is pressed. Every phase boundary is `startedAt + cumulativeOffset`, never "previous phase end + duration", so drift can't build up.
- Phases never end early, even if everyone has answered. The phone shows "Locked in ✓ — waiting for other teams".
- A big **global countdown (15:00 → 0:00)** is always visible in the top centre of the projector.
- **Emergency pause** (host only, hidden behind a long-press) freezes the clock. The total game time extends by the paused duration, and this is shown on the host screen. It's for genuine emergencies only.
- **Rehearsal mode:** `/host?speed=10` runs the entire game 10× faster (90 s) for testing.

---

## 4. The map

### Geometry
- Hex grid with **axial coordinates**, radius **6** → 127 hexes, rendered as **pseudo-3D extruded hex tiles** (top face + visible side faces, slight height variation by biome).
- The **6 corners** of the outer ring are the **6 team home tiles**, all exactly 6 steps from the centre, so the map is perfectly fair.
- **Centre hex = the Keynote Stage.** It is locked and glowing during normal rounds and can only be captured in the Final Showdown.
- **Ring 1 around the centre = Keynote Plaza** (6 normal tiles with a marble look).
- The remaining tiles are split into **6 wedge regions** (60° each). Each region is a biome named after one criterion:

| Region | Criterion key | Biome look |
|---|---|---|
| Structure Peaks | `structure` | Slate cliffs, glowing blue crystal pillars |
| Visual Valley | `visuals` | Neon flower meadows, prism shards |
| Delivery Plains | `delivery` | Golden wheat fields with soundwave ripples |
| Engagement Coast | `engagement` | Coral beaches, turquoise shallows |
| Time Fortress | `timing` | Brass clockwork plates, rotating gear details |
| Q&A Bayou | `qa` | Misty teal marsh, floating "?" fireflies |

> **Customisable:** region names and keys live in `config/rubric.ts`. If the course has an official presentation rubric, rename the regions to match it exactly.

### Tile types (generated with a seeded RNG; the host generates the map once and sends it to all clients)
| Type | Share | Rule |
|---|---|---|
| Land | ~70% | Costs 1 movement point (MP) |
| Water | ~12% | Impassable, animated shader. **The generator must check (with BFS) that all land is connected and all homes can reach the plaza; otherwise reseed.** |
| Filler-Word Fog | ~8% | Costs 2 MP to enter. Swirling grey fog with faint "um… uh…" text particles |
| Death-by-PowerPoint Swamp | ~5% | Ending your move here gives −1 MP next round. Bubbling, with tiny sinking slide icons |
| Treasure chest | 6 at the start, +3 respawn every 3 rounds | Landing here gives a power card |

Water, fog and swamp never spawn on home tiles, plaza tiles, or the tiles next to a home.

### Territory
- A team owns its home tile from the start, and it can never be stolen.
- **Every tile a team's ship passes through or lands on is painted in that team's colour** (with a paint-splash animation). Tiles owned by other teams flip to the mover, unless they're shielded.
- Water and the Keynote Stage are never claimable during normal rounds.

---

## 5. Core round loop

### 5.1 Challenge phase (20 s) — winning or losing decides your movement
The same challenge appears on every phone at the same moment. **Every member answers individually.**

- **Team accuracy** = correct members ÷ members who were connected during the phase. This makes a team of 1 exactly as strong as a team of 8.
- **Speed** = the median time it took that team's correct members to answer, measured when the **host receives** each answer (never from client clocks).

**Movement points (MP) earned:**
| Result | MP |
|---|---|
| 0% correct (or nobody answered) | **0 — STAGE FRIGHT** (ship shakes, sweat-drop animation, can't move) |
| 1–49% | 1 |
| 50–79% | 2 |
| 80–100% | 3 |
| **Quick Draw bonus:** fastest team with ≥50% accuracy | +1 |

Then apply modifiers: Strong Hook card +1, swamp penalty −1, Heckler −1. The final MP is clamped to between 0 and 5.

**Round score** (used to break clashes) = accuracy × 1000 − median speed in ms ÷ 100.

### 5.2 Reveal (6 s)
- **Phone:** ✅ or ❌ with a one-line explanation of *why* (the teaching moment), plus "Your team: 3/4 correct → 2 MP".
- **Projector:** the correct answer, a bar showing each team's accuracy, MP badges flying onto each ship, and a "QUICK DRAW!" stamp on the fastest team.

### 5.3 Team Vote (12 s) — the team's decision moves the ship
Each phone shows a **zoomed mini-map centred on their ship** with every **reachable hex highlighted** (worked out by Dijkstra using tile costs, up to the team's MP). There's also a "Hold position" option.

- Each member taps a destination. **Teammates' votes appear live as small avatar dots on the hexes**, so the team can see the room converging.
- If the team holds power cards, a second row appears: **Play card? [None] [Card A] [Card B]**.
- When the timer ends, the **majority** decides. Ties are broken randomly using the seeded RNG. If nobody votes, the ship holds position.
- The path is the shortest one to the destination, with ties broken deterministically by a fixed neighbour order, so every client sees the same path.
- **Projector during the vote:** the map shows each team's "votes in" progress ring around its ship, but **rivals' choices stay hidden** until resolution for surprise. Shows "TEAMS ARE DECIDING…" with a ticking-clock sound.

### 5.4 Move Resolution (8 s) — everything happens at once
Resolve deterministically in `lib/engine/resolve.ts`:
1. Apply cards played this round (see Section 7).
2. **Clashes:** if two or more teams target the same destination, the team with the higher round score wins it. The others stop on the **last tile of their path before the clash** (or their origin). Repeat until there are no shared destinations (max 10 iterations; then everyone left in conflict stays at their origin).
3. **Paint tiles** along each final path in step order. If two teams paint the same tile in the same round, the higher round score keeps it. Shielded tiles are skipped.
4. **Pickups:** landing on a chest gives a random card. Each team can hold at most 2 cards; if full, the oldest is replaced.
5. **Hazards:** ending on a swamp queues −1 MP for next round.
6. Recompute the scores.

**Animation (projector):** all ships move **at the same time**, one hex every ~280 ms, leaving glowing colour trails. Tiles flip with a splash and a particle burst. Clashes get a slow-motion "CLASH!" flash, sparks, a short screen shake, and a bounce-back. Chests burst open with the card flying to the team's scoreboard slot. The scoreboard re-sorts with a smooth animation.

---

## 6. Spotlight rounds (oral presentation + marking practice)

Spotlight rounds are where the game connects directly to **presentation marking**.

1. **Get Ready (5 s):** the projector spins a slot-machine reel and picks **one random connected member** from each of the two featured teams (a team of 1 means that person). A random **topic** and **twist** are drawn (Section 12).
2. **Speaker A (20 s):** the speaker's phone shows "🎤 YOU'RE ON!" with the topic, twist, and a big countdown. They **speak out loud to the room**. The projector shows the speaker's name, team, topic and twist under a stage spotlight effect, plus a live "audio" visualiser animation (decorative; no microphone needed).
3. **Rate A (8 s):** every player **not on the speaker's team** rates the speech from 1 to 5 stars on three rubric criteria:
   - **Hook** (engagement) · **Clarity** (structure) · **Confidence** (delivery)
   Self-team rating is blocked in the UI and ignored by the engine.
4. Speaker B and Rate B work the same way.
5. **Reveal (6 s):** an animated scorecard for each speaker shows the three criterion averages as filling bars and the overall average.

**Movement from a Spotlight round:**
- **Speaking teams:** MP comes from the speaker's overall average (worked out from per-team averages, with the highest and lowest team averages dropped when 5 or more teams rated): ≥4.2 → 4 MP, ≥3.5 → 3, ≥2.5 → 2, otherwise 1. *Speaking always earns at least 1 MP, because courage is rewarded.*
- **Non-speaking teams:** a base of 2 MP, plus a **Fair Judge bonus of +1 MP** if their team's ratings were within 0.5 of the room average for both speakers. This rewards consistent, fair marking.

Then the round continues with the normal Team Vote and Move Resolution.

Over the whole game, each of the 6 teams speaks exactly once (rounds 3, 6 and 9).

---

## 7. Power cards

Cards drop from chests, and each card is a glossy card with an original icon.

| Card | Effect | Visual |
|---|---|---|
| **Strong Hook** 🪝 | +1 MP next round | Golden hook swoosh onto the ship |
| **Rehearsed** 🛡️ | Your tiles can't be stolen during this round's resolution | Translucent shield domes over your territory |
| **Heckler** 📢 | The **current score leader** (if it isn't you) gets −1 MP next round | Megaphone soundwave hits the leader's ship |
| **Mic Drop** 🎤 | When you land, also claim all 6 neighbouring tiles (except protected ones) | Shockwave ring + boom |

Targeting the leader automatically keeps the vote to a single tap and acts as a built-in catch-up mechanic.

---

## 8. Final Showdown — the Keynote Stage (75 s)

- A big banner reads "FINAL SHOWDOWN". The sky turns to night and spotlights sweep the map.
- **3 rapid-fire true/false questions** (12 s each, 5 s reveal), taken from the final pool.
- For **each question a team gets ≥50% correct**, it claims **2 tiles** (or **3 tiles** if it's in the bottom 3 on score, as a comeback boost). Claimed tiles are unowned or unshielded enemy tiles next to its territory, chosen by the engine closest to the Stage first.
- **The Keynote Stage** goes to the team with the most correct answers across the 3 questions; fastest total median time breaks ties. **+100 points**, with a giant spotlight and fireworks over the Stage in that team's colour.
- 19-second finale animation: territory floods out in waves, then the Stage capture.

---

## 9. Scoring & awards

**Team score** = owned tiles × 10 + **Region Mastery** (owning the most tiles in a region with at least 5 of them) × 50 for each region + Keynote Stage 100.

**Results ceremony (60 s):** the score counts up per team, a 3-step podium rises with the winning ships, and confetti falls in the winner's colour. Then 4 **individual award cards** flip over:
- 🎤 **Best Speaker** — highest Spotlight average
- ⚡ **Quick Draw** — fastest average correct answer
- ⚖️ **Fair Judge** — individual ratings closest to the room average
- 🧠 **Rubric Master** — most correct answers overall

**Debrief screen (50 s, used by the facilitators in the Closing):**
- A radar chart of **room-wide accuracy per criterion** (Structure, Visuals, Delivery, Engagement, Timing, Q&A), plus the Spotlight criterion averages.
- "🏆 The room's strongest skill: X" and "🎯 The skill to work on: Y", worked out from the data.
- **3 key takeaways**, taken from the explanations of the questions the room got most wrong.
- A prompt for the Closing: *"Tell us one thing you learned, or something you liked about today."*
- At 15:00 exactly, a **"GAME OVER"** card is stamped on screen. All phones show "Thanks for playing! 🎉" plus their team's rank and their personal stats.

---

## 10. Screens & UX

### 10.1 Routes
| Route | Who | Purpose |
|---|---|---|
| `/` | Everyone | Landing page: **Join** (enter a 4-letter code) or **Host** |
| `/host` | Facilitator laptop → projector | Lobby → game → results (1920×1080 first, must also look good at 1280×720) |
| `/play/[code]` | Players' phones | Controller (portrait, mobile-first, 360–430 px wide) |
| `/guide` | Facilitators | A printable 2-page **Facilitator Guide + QR poster** (print-to-PDF ready, for the uploaded materials) |
| `/dev/bots` | Testing | Spawns N fake players that join random teams and answer, vote and rate randomly |

### 10.2 Host lobby (projector)
- A large animated title, "SPOTLIGHT ISLES", over the slowly rotating map preview at dawn.
- A big **QR code** + room code + URL.
- **6 team cards** (colour + emblem + editable team name; the facilitator can type the real group names). Each shows player avatars popping in as they join, with a "pop" sound.
- Total player counter. **START** button (shows a warning if any team is empty, but still allows the start).
- Facilitator controls: rename teams, kick a player, toggle **Manual Mode** (see 10.5), choose volume.

### 10.3 Player flow (phone)
1. **Join:** nickname (max 12 characters, simple profanity filter) → **pick a team** from 6 big glossy cards showing live member counts → "You're on TEAM TIDE! 🌊".
2. **Waiting room:** their team's airship bobs on clouds, teammates' names appear, there's a tip carousel ("Tip: pause instead of saying 'um'"), and a pulsing "Waiting for the host…".
3. **In game**, the phone always shows: the team colour band at the top, the phase name, a big countdown ring, and the main interaction:
   - Challenge → big tap-friendly answer buttons (or tap-to-order chips for ordering questions)
   - Reveal → ✅/❌ + explanation + team MP
   - Vote → mini-map + live teammate dots + card row
   - Resolution → "👀 Look at the big screen!" with a small animated ship
   - Spotlight → "🎤 YOU'RE ON" screen for the speaker; three star sliders for raters; "Your team is speaking — cheer them on! 📣" for the speaker's teammates
4. **Reconnecting:** `playerId` and `teamId` are saved in `localStorage`. Reopening the link resumes instantly in the current phase.
5. Haptic `navigator.vibrate` on phase changes where supported (it isn't on iOS, which is fine). A "Reduce motion" toggle is available.
6. **Late joiners** can join at any time and take part from the next phase.

### 10.4 Projector HUD (in game)
- **Top centre:** the global 15:00 countdown (turns red and pulses below 1:00) and a round counter ("ROUND 4 / 12").
- **Top left:** the phase banner with the criterion icon (e.g., "DELIVERY CHALLENGE").
- **Right:** the scoreboard with ship icon, team name, score, tiles, cards held, and the MP badge for the current round. It re-sorts with an animation.
- **Bottom:** during the Challenge, the question in large text plus "answers in" progress bars per team (never correctness until the Reveal).
- **Spotlight:** the stage view replaces the bottom area.

### 10.5 Manual Mode (offline backup — must be implemented)
If Wi-Fi fails, the facilitator can run the whole game from the projector laptop. Questions are read aloud and answered by show of hands. For each team, the host clicks the accuracy band (0 / 1–49 / 50–79 / 80+) and the Quick Draw team, then clicks each team's destination on the big map. The timeline and visuals stay the same.

---

## 11. Visual & audio direction — "graphically stunning"

**Style:** a polished, cozy-strategy **stylised low-poly fantasy archipelago floating in the sky**: soft gradients, rim lighting, bloom on glowing elements, constant gentle motion. It should look like a modern indie game, not a website.

- **Renderer:** **PixiJS v8** canvas for the projector map (WebGL). Use **pixi-filters** for bloom/glow and displacement on the water. Write a **lightweight custom particle system** (pooled sprites) for splashes, sparks, fireflies, fog wisps and confetti trails.
- **Pseudo-3D hexes:** each tile is drawn as a top face plus darker side faces with height variation by biome. Add soft drop shadows, a subtle noise texture, and slight vertex jitter so tiles look hand-crafted.
- **Living world:** drifting cloud layers with parallax under the islands, animated water, slowly rotating gears in Time Fortress, swaying grass in Delivery Plains, fireflies in Q&A Bayou, crystal glints in Structure Peaks.
- **Time of day across the 15 minutes:** dawn (intro) → bright day (rounds 1–6) → golden sunset (rounds 7–12) → **night with sweeping spotlights** (Final Showdown). Tween the sky gradient and global light tint between them.
- **Camera:** a gentle idle drift. During resolution it zooms slightly toward the action; during clashes it does a quick punch-in plus screen shake; during the Final Showdown it slowly orbits.
- **Team ships:** six original airship designs drawn in code, each with a unique **emblem shape** as well as a colour, so the game is colour-blind friendly: Comet ★ (amber), Volt ⚡ (violet), Tide 〰 (cyan), Ember ▲ (coral red), Grove ● (green), Prism ◆ (pink). Each has a propeller animation, a hover bob, and a coloured trail. Check that the six colours are distinguishable with a colour-blindness simulator.
- **UI motion:** GSAP for banners, count-ups, podium and card flips; Framer Motion (or Motion) for phone UI transitions. Banners slam in with overshoot easing.
- **Typography:** a bold display font from Google Fonts (e.g., "Lilita One" or "Bungee") for titles and banners, plus "Inter" or "Nunito" for body text. Projector text should be ≥28 px; question text ≥44 px.
- **Phone UI:** dark, glossy cards with team-coloured glows, big rounded buttons (≥56 px tall), satisfying press states, and a confetti burst on correct answers.
- **Audio (projector only; phones silent by default):** synthesized WebAudio SFX (pop, whoosh, paint splat, clash boom, chest open, tick-tock during votes, fanfare) and a looping upbeat background track (CC0 or synthesized) that ducks during Spotlight speeches. There's a volume slider on the host.
- **Performance:** a steady 60 fps on a typical laptop. Cache tile graphics as textures and pool particles. Phones must stay smooth on mid-range Android.

---

## 12. Content — question bank & Spotlight prompts

Store this in `content/questions.ts` and `content/spotlight.ts`. Each standard round picks an unused question from its criterion (rounds 10–12 pick from the criteria the room did worst on so far, to reinforce learning). Shuffle answer options per round, but use the same shuffle for everyone.

`type: "mcq"` = 4 options, one correct. `type: "order"` = the player taps 4 chips into the correct order (correct only if the whole order matches). `type: "slide"` = an MCQ shown with a **rendered mock slide** (build the mock slide from the `slide` spec as a styled HTML/SVG card on both the phone and the projector).

### Structure
**S1 · mcq** — Which opening is strongest for a 2-minute pitch about a water-purifying straw?
- "Hi, I'm Alex, and today I'll be talking about our product."
- ✅ "Around 2 billion people lack safe drinking water. This straw makes water safe in seconds."
- "Let me start with the history of filtration since 1850."
- "Sorry, I'm a bit nervous, so bear with me."
*Why:* Open with a hook: a striking fact plus a promise. Save introductions for later or skip them.

**S2 · order** — Put this elevator pitch in the most effective order.
✅ Order: (1) "Bridge failures put lives and billions of dollars at risk." → (2) "Our sensor detects tiny cracks months before they become dangerous." → (3) "In our pilot, it flagged every crack the inspectors later confirmed." → (4) "Can we demo it on one of your bridges next month?"
*Why:* Problem → Solution → Proof → Ask. (The example pitch is fictional.)

**S3 · mcq** — You have 3 minutes and 7 key points. Best move?
- Speak faster to fit all 7 · ✅ Pick the 3 that matter most to this audience · Put all 7 on one slide · Skip the conclusion
*Why:* Audiences remember a few clear points. Prioritise ruthlessly.

**S4 · mcq** — What should your final sentence do?
- "That's it… any questions?" · ✅ Restate your key message and give a clear call to action · Introduce a brand-new statistic · Apologise for going over time
*Why:* The ending is what people remember. Land the message and tell them what to do next.

### Visuals
**V1 · slide** — `slide: { title: "Results", bullets: 9 long bullets in 14px text, 3 clashing colours, a clip-art icon }` — What's the BIGGEST problem with this slide?
- ✅ Too much text: the audience reads instead of listening · The title should be in capitals · It needs more colours · It needs a border
*Why:* Slides support you; they shouldn't replace you. Aim for one idea per slide.

**V2 · mcq** — You want to show how energy use changed over 10 years. Best visual?
- Pie chart · ✅ Line chart · A table of 120 monthly numbers · Word cloud
*Why:* Line charts show change over time at a glance.

**V3 · mcq** — Comparing the market share of 3 competitors. Clearest visual?
- ✅ Simple bar chart · 3D exploding pie chart · A paragraph of text · Scatter plot
*Why:* Bars make side-by-side comparison easy; 3D effects distort the proportions.

**V4 · slide** — `slide: { title: "Key Findings", red text on a green background }` — What would make this slide readable for everyone?
- ✅ High contrast, e.g., dark text on a light background · A bigger logo · Adding animation · Using italics
*Why:* Low contrast is hard to read, and red/green is a common colour-blindness problem.

### Delivery
**D1 · mcq** — You keep saying "um". Best fix?
- Talk faster so there's no gap · ✅ Replace the "um" with a short, silent pause · Memorise the script word-for-word · Apologise each time
*Why:* A pause sounds confident and gives the audience time to think.

**D2 · mcq** — Where should you look while pitching to 6 judges?
- At your slides · At one friendly judge only · ✅ Share eye contact across all of them, a few seconds each · At the ceiling while you think
*Why:* Spreading eye contact makes everyone feel spoken to.

**D3 · mcq** — Nervous before speaking. What helps most?
- Skip rehearsal so you stay fresh · ✅ Slow breathing, and rehearse your first 30 seconds until it's automatic · Three coffees · Read straight from your notes
*Why:* A confident start builds momentum, and slow breathing calms your body.

**D4 · mcq** — Your voice sounds flat. Which technique adds energy?
- ✅ Vary your pace and pitch, and stress key words · Be loud the whole time · Add more slides · Speak only in questions
*Why:* Vocal variety signals what matters and keeps attention.

### Engagement
**E1 · mcq** — Audience: high-school students. Topic: carbon capture. Best hook?
- "Carbon capture uses amine-based solvent absorption." · ✅ "Imagine the air in this room is a bank account, and we're deep in debt. Here's how we pay it back." · "Let me show you 40 equations." · "This topic is a bit boring, but…"
*Why:* Use analogies matched to the audience. Lead with meaning, not jargon.

**E2 · mcq** — What makes a statistic stick?
- Reading it to 4 decimal places · ✅ Comparing it to something familiar ("that's three Olympic pools every minute") · Putting it in a footnote · Saying it very quickly
*Why:* Concrete comparisons make numbers memorable.

**E3 · mcq** — Half the room is on their phones mid-talk. You should…
- Keep going exactly as planned · ✅ Ask the audience a quick question or a show of hands · Tell them off · End early
*Why:* Interaction resets attention.

**E4 · mcq** — Why tell a short story in a technical pitch?
- It fills time · ✅ People remember stories and connect emotionally to the problem · It replaces the need for evidence · Judges require it
*Why:* Stories create connection, and evidence then backs them up.

### Timing
**T1 · mcq** — At a natural speaking pace, roughly how many words fit in a 2-minute pitch?
- About 50 · ✅ About 250–300 · About 600 · About 1,000
*Why:* People typically speak around 120–160 words a minute. Write your script to fit.

**T2 · mcq** — You're at 1:45 of a 2:00 pitch with 3 slides left. Best move?
- Rush through all 3 · ✅ Jump to your conclusion and call to action · Ask for 5 more minutes · Stop mid-sentence
*Why:* Always protect your ending.

**T3 · mcq** — The best way to make sure you finish on time?
- ✅ Rehearse out loud with a timer, at least twice · Rehearse silently in your head · Plan to improvise · Add extra backup slides
*Why:* Speaking out loud takes longer than reading silently. Only a timed run tells the truth.

**T4 · mcq** — A good time split for a 2-minute pitch?
- 90 s background, 30 s solution · ✅ About 15 s hook, 30 s problem, 45 s solution, 30 s proof + ask · 2 minutes of Q&A · 100 s about your team
*Why:* Spend most of the time on the problem and solution, but keep the hook and the ask.

### Q&A
**Q1 · mcq** — A judge asks something you don't know. Best response?
- Make up a confident answer · ✅ "Great question. I don't know yet, but here's how we'd find out, and I'll follow up." · Ignore it · "That's not really relevant."
*Why:* Honesty plus a plan builds credibility.

**Q2 · mcq** — A question is long and confusing. First step?
- Answer whatever you think they meant · ✅ Briefly rephrase it back to check you understood · Ask them to repeat it three times · Move on to the next question
*Why:* Rephrasing confirms the question and buys you thinking time.

**Q3 · mcq** — A hostile question challenges your data. Best approach?
- Get defensive · ✅ Stay calm, acknowledge the concern, and answer with evidence · Laugh it off · "Just read the report."
*Why:* Calm, evidence-based answers win over the room.

**Q4 · mcq** — How can you prepare for Q&A?
- Hope nobody asks anything · ✅ Predict the 5 toughest questions and prepare short answers · Run long so there's no time for questions · Memorise your slides
*Why:* Most questions are predictable, so prepare for them.

### Final Showdown pool (true/false; pick 3 at random)
- F1 "Reading your slides word-for-word keeps the audience engaged." → **False**
- F2 "A well-placed pause can make your key point more powerful." → **True**
- F3 "Each slide should have one clear message." → **True**
- F4 "'So… yeah, that's it' is a strong way to finish." → **False**
- F5 "You should adapt your pitch to who's listening." → **True**
- F6 "More animations always make slides better." → **False**

### Spotlight prompts (`content/spotlight.ts`)
**Topics:** Pitch a pen to an alien who has never seen writing · Convince us Monday should be a public holiday · Explain Wi-Fi to your grandparent · Sell an umbrella that survives a Sydney southerly · Pitch your favourite food as a revolutionary technology · Explain why bridges don't fall down, to a 7-year-old · Convince the room to take the stairs · Pitch a "smart" version of a boring object (a brick, a spoon, a chair) · Explain what an engineer does without using the word "build" · Sell sleep to a university student

**Twists:** Start with a question · Use exactly one number · End with a clear call to action · Zero "ums" allowed · Use a gesture for every key point · Pretend we're investors with $1M

---

## 13. Technical architecture

### 13.1 Stack
- **Next.js (App Router) + TypeScript**, deployed on **Vercel**.
- **Tailwind CSS** for UI; **PixiJS v8** + **pixi-filters** for the projector map; **GSAP** and **Motion** for animation; **qrcode** to generate the QR; **canvas-confetti** for celebrations.
- **Realtime: Supabase Realtime** (Broadcast + Presence channels). *Vercel serverless functions can't hold WebSocket connections, so a managed realtime service carries the live traffic.* There are **no database tables**; only Realtime is used. The free tier is plenty for one classroom, but check the current limits.
- **Vitest** for engine tests; **Playwright** (optional) for an end-to-end smoke test.

### 13.2 Authority model: host-authoritative
- The **projector browser (`/host`) runs the game engine** and is the single source of truth: clock, scoring, answer keys, resolution.
- Phones are thin clients: they send inputs and render the state they receive.
- Answer keys **never** leave the host before the Reveal.
- The host saves an engine **snapshot to `localStorage`** after every phase change and at least every 2 s. If the host tab reloads, it resumes from the snapshot, recalculating the current phase from `startedAt` (an epoch timestamp), so the 15:00 end time doesn't move.
- The host requests a **Screen Wake Lock** and shows a warning banner: "Keep this tab visible. Browsers slow down background tabs."

### 13.3 Channel & messages
Channel: `spotlight:{ROOMCODE}` (4 uppercase letters, avoiding ambiguous ones like O/0 and I/1).

**Presence (phones):** `{ playerId, name, teamId }`.

**Host → all (broadcast):**
| Event | Payload |
|---|---|
| `lobby` | teams, players, map preview seed |
| `phase` | `{ phaseId, kind, roundIndex, endsInMs, publicData }` (sent on every phase change) |
| `tick` | `{ phaseId, endsInMs, globalRemainingMs }` (every 1 s; phones smooth their countdown locally) |
| `map` | full tile list (once at START, plus diffs after each resolution) |
| `reveal` | correct answer, explanation, per-team accuracy and MP |
| `voteTally` | **per-team** live vote dots (each phone filters to its own team) |
| `resolution` | move list `{ teamId, path[], clashAt?, cardFx[] }` for the animation |
| `spotlight` | speaker `playerId`s, topic, twist |
| `results` / `debrief` | final scores, awards, rubric stats, personal stats keyed by `playerId` |

**Phone → host:**
| Event | Payload |
|---|---|
| `answer` | `{ playerId, phaseId, choice }` (the host stamps the receive time) |
| `vote` | `{ playerId, phaseId, destination: "q,r" or "hold", card?: "none" or cardId }` (the latest vote wins) |
| `rating` | `{ playerId, phaseId, speakerTeamId, hook, clarity, confidence }` |
| `hello` | used on (re)join to request the current `phase` + `map` |

Inputs carrying an old `phaseId` are ignored.

### 13.4 Folder structure
```
/app
  /page.tsx                  landing
  /host/page.tsx             projector (client component)
  /play/[code]/page.tsx      phone controller
  /guide/page.tsx            printable facilitator guide + QR poster
  /dev/bots/page.tsx         bot simulator
/components/host/*           Lobby, HUD, Scoreboard, Banner, SpotlightStage, Results, Debrief
/components/play/*           Join, TeamPicker, Waiting, AnswerPad, OrderPad, VoteMap, RatingStars, ...
/game/render/*               Pixi scene: MapRenderer, TileFactory, Ships, Particles, Sky, Camera, Water
/game/audio/*                WebAudio synth SFX + music player
/lib/engine/*                PURE logic: timeline, mapgen, hex, pathfinding, scoring, resolve, cards, spotlight, awards, debrief, rng
/lib/net/*                   Supabase channel wrapper, message types, host loop, client store
/config/*                    timeline.ts, rubric.ts, teams.ts, balance.ts (MP thresholds, card odds, etc.)
/content/*                   questions.ts, spotlight.ts
/tests/*                     vitest specs
```

### 13.5 Key types (starting point)
```ts
type CriterionKey = "structure" | "visuals" | "delivery" | "engagement" | "timing" | "qa";
type TileType = "land" | "water" | "fog" | "swamp" | "stage" | "plaza";
interface Tile { q: number; r: number; type: TileType; region: CriterionKey | "plaza"; owner?: TeamId; chest?: boolean; height: number; }
type TeamId = 0 | 1 | 2 | 3 | 4 | 5;
interface Team { id: TeamId; name: string; color: string; emblem: string; pos: Hex; home: Hex; cards: CardId[]; pendingMods: Mod[]; score: number; }
interface Player { id: string; name: string; teamId: TeamId; connected: boolean; stats: PlayerStats; }
type PhaseKind = "intro" | "challenge" | "reveal" | "vote" | "resolve" | "spotReady" | "spotSpeak" | "spotRate" | "spotReveal" | "finalBanner" | "finalQ" | "finalReveal" | "finalFlood" | "results" | "debrief" | "over";
interface Phase { id: string; kind: PhaseKind; round?: number; startOffsetMs: number; durationMs: number; meta?: Record<string, unknown>; }
interface GameState { roomCode: string; seed: number; startedAt: number | null; pausedMs: number; phaseIndex: number; tiles: Tile[]; teams: Team[]; players: Record<string, Player>; inputs: PhaseInputs; history: RoundSummary[]; }
```

### 13.6 Environment & deploy
- `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- A README with step-by-step setup: create a free Supabase project → copy the URL and anon key → push the repo to GitHub → import it into Vercel → add the env vars → deploy → open `/host` on the projector laptop.
- Only nicknames are collected and nothing is stored after the session. State this on the landing page.

---

## 14. Build milestones (do these in order, each with its acceptance check)

1. **Scaffold** — Next.js + TypeScript + Tailwind + Vitest; landing page; config files. ✔ `npm run build` passes.
2. **Engine core (pure)** — seeded RNG, hex math, map generation with connectivity check, Dijkstra for reachable tiles, timeline builder. ✔ Tests: **timeline sums to 900,000 ms**; 6 homes are equidistant from the centre; all land is connected for 50 random seeds.
3. **Scoring & resolution** — MP rules, round score, clash resolution, painting, cards, hazards, spotlight scoring with trimming, Fair Judge, Final Showdown claims, Region Mastery, awards, debrief stats. ✔ Unit tests cover every rule in Sections 5–9, including clash chains and teams of 1.
4. **Realtime lobby** — Supabase channel, presence, room code, QR, team picking, rename teams, reconnect from `localStorage`. ✔ 3 real phones + 30 bots appear in the lobby within 2 s.
5. **Host game loop** — master clock, phase scheduling, input collection, snapshots and resume, wake lock, pause, `?speed=10`. ✔ At speed 10 the game ends at 90 s ±0.5 s; at speed 1 it ends at 15:00 ±1 s; reloading the host mid-game resumes correctly.
6. **Phone controller** — every phase screen in Section 10.3, mobile-first and polished. ✔ Works at 375×667 and 430×932; one-thumb usable.
7. **Projector renderer** — Pixi map, pseudo-3D tiles, biomes, water, clouds, ships, simultaneous move animation, clashes, painting, chests, HUD, scoreboard. ✔ 60 fps at 1080p with 6 ships and full particle effects.
8. **Spotlight rounds** — speaker reel, stage view, rating UI, scorecard. ✔ Each team speaks exactly once; self-rating impossible.
9. **Final Showdown, results, debrief** — night sky, spotlights, flood, stage capture, podium, awards, radar chart, takeaways, GAME OVER at 15:00. ✔ The debrief data matches the engine's stats.
10. **Audio & juice pass** — SFX, music with ducking, screen shake, banners, confetti, tuned easing. ✔ It feels like a game.
11. **Manual Mode + `/guide` page** — offline backup control, plus a printable facilitator guide and QR poster. ✔ A full game can be played with no phones.
12. **Bots & full rehearsal** — `/dev/bots?count=40&code=ABCD`. ✔ A full 15-minute run with 40 bots shows no errors in the console and ends exactly on time.
13. **Deploy** — Vercel + README. ✔ The production URL works from a phone on mobile data.

---

## 15. Facilitator run sheet (4 facilitators)

### Roles
| Role | Who | Job |
|---|---|---|
| **Game Master (MC)** | Facilitator 1 | On the mic: narrates, builds hype, reads challenges aloud for accessibility, hosts the Spotlight moments, leads the debrief |
| **Tech Operator** | Facilitator 2 | Runs `/host` on the projector laptop, watches connections, handles reconnects, ready to switch to Manual Mode |
| **Floor Coach A** | Facilitator 3 | Looks after Teams 1–3: helps people join, encourages discussion during votes, cheers the speakers |
| **Floor Coach B** | Facilitator 4 | Looks after Teams 4–6: same as Coach A |

### Live script (key cues)
| Clock | Who | Cue |
|---|---|---|
| Before START | Coaches | "Scan the QR on the screen, pick your project group's team, and wait on the cloud." |
| 00:00 | MC | "Welcome to Spotlight Isles! Every region is a presentation marking criterion. Win challenges to move further, and your team votes on where to go. We finish at exactly 15:00." |
| Each Challenge | MC | Reads the question aloud and counts down the last 5 seconds. |
| Each Vote | Coaches | "Talk to your team, decide fast, tap together!" |
| Each Resolution | MC | Commentates like a sports caster: "TIDE and EMBER are going for the same tile… CLASH!" |
| Spotlight | MC | "Lights up on… [name]! Twenty seconds, make us care!" Leads applause after each speaker. "Mark them fairly: Hook, Clarity, Confidence." |
| 11:55 | MC | "Night falls… FINAL SHOWDOWN for the Keynote Stage!" |
| 13:10 | MC | Hypes the podium and reads the award winners. |
| 14:10 | MC | Reads the strongest and weakest skill from the debrief and links them to the workshop objectives. |
| 15:00 | MC | "Game over! Now, in one sentence: what's one thing you learned today?" → into the Closing |

### Checklist
- **1 week before:** finish building, deploy, run a full bot rehearsal.
- **3 days before:** rehearse with all 4 facilitators on their phones; practise the script; time it.
- **1 day before:** a full 15-minute real-time dry run; print the QR poster (one per table); export `/guide` as a PDF for the materials.
- **On the day (arrive 15 minutes early):** test the Wi-Fi with several phones; laptop on charge, sleep disabled, notifications off; projector at 1080p; sound check; open the lobby during the Agenda segment so people join early.
- **Backup:** Manual Mode; a facilitator hotspot for the host laptop; a printed copy of the questions.

---

## 16. How the design targets the facilitation marks

*Replace these criteria with the exact wording from the Facilitation assessment task sheet if it differs.*

| Likely marking area | How Spotlight Isles addresses it |
|---|---|
| **Relevance to the weekly topic** | Every region, question, card and hazard is a presentation concept; the Spotlight rounds are live oral presentation practice |
| **Innovative facilitation strategy** | A custom-built, real-time multiplayer strategy game with team voting and simultaneous movement |
| **Engagement of all participants** | Everyone answers, votes and rates every round; nobody sits waiting. A team of 1 is as strong as a big team. Every team speaks once |
| **Clear objectives & structure** | Objectives are shown on the intro screen and revisited on the debrief screen |
| **Time management** | A hard-coded, tested 15:00 timeline with a visible countdown |
| **Reflection / debrief** | Data-driven debrief showing the room's strongest skill, skill to work on, and takeaways, feeding straight into the Closing |
| **Assessment literacy** | Peer rubric marking with fairness rules (no self-rating, trimmed averages, Fair Judge bonus) |
| **Inclusivity & accessibility** | No accounts or installs; colour + emblem team identity; big text; questions read aloud; reduced-motion option |
| **Facilitator teamwork** | Four defined roles and a cue-by-cue script |
| **Uploaded materials (30%)** | `/guide` PDF (plan, rules, objectives, roles, run sheet), the question bank mapped to criteria, screenshots, and the QR poster. Combine everything into one PDF with the rest of the team's materials |
