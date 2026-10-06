# Spotlight Isles

A 15-minute, 6-team game about presentation skills, built for the GSOE9010 Week 5 Presentation Skills (FC4) workshop. Players join on their phones; one projector screen runs the game. It is mostly team discussion: talk through a question or prepare a pitch, then decide together where to fly.

## How to play

1. **The goal:** fly your airship to your group's 🔑 key (on the opposite island), then to the 🎤 Keynote Stage in the middle.
2. **Every round every group moves 2 steps.** Do well and you move 3.
   - *Question rounds (1, 3, 5):* discuss a scenario about presenting research for 45 seconds and tap the answer you agree on. If half the group or more picks the best answer, you move 3.
   - *Pitch rounds (2, 4, 6):* a spin picks two groups that haven't pitched yet. Each gets a topic on the big screen, 48 seconds to choose a speaker and prepare, and 40 seconds to speak. The other groups mark Hook, Clarity and Confidence. A good pitch moves 3, a great one 4. Every group pitches exactly once.
3. **Moving is one tap.** The phone shows the best hex in green; tap GO (or pick another). A group that doesn't choose still flies the best route.
4. **The group with the most points moves first.** Ships never block each other; going first only matters for ⭐ stars and for arriving first.
5. **Most points wins.** Points come from steps earned, marking pitches, your key, stars, and reaching the Stage early (50 / 40 / 30 / 20 / 10).

The route is 11–12 steps on every map and everyone moves at least 2 a round, so a group that keeps tapping GO always reaches the Stage by round 6. Groups that answer and pitch well arrive in round 4 or 5.

- `/` — landing page: join with a 4-letter code, or host
- `/host` — projector screen (lobby → game → results → debrief). Runs the game engine.
- `/play/CODE` — phone controller
- `/guide` — printable facilitator guide, question bank and QR poster
- `/dev/bots?count=40&code=CODE` — bot simulator for rehearsals

[DECISIONS.md](DECISIONS.md) explains the design choices. [SPOTLIGHT_ISLES_BUILD_SPEC.md](SPOTLIGHT_ISLES_BUILD_SPEC.md) is the original, more complex design (version 1); the game was simplified after review, so where they differ, this README and DECISIONS.md are correct.

## Deploy to Vercel (about 10 minutes)

You need two free accounts: [Supabase](https://supabase.com) (carries the live phone traffic) and [Vercel](https://vercel.com) (hosts the site).

### 1. Create a Supabase project

1. Sign in at supabase.com → **New project**. Any name and region; pick the region closest to you. No tables are needed.
2. Open **Project Settings → API** (or the **Connect** button) and copy:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **anon / publishable key**

Only Supabase **Realtime** (Broadcast + Presence) is used. Nothing is stored.

### 2. Put the code on GitHub

Install [Git](https://git-scm.com/download/win) if you don't have it, then in this folder:

```bash
git init
git add .
git commit -m "Spotlight Isles"
```

Create an empty repository on github.com and push to it (GitHub shows the two commands to copy).

### 3. Import into Vercel

1. vercel.com → **Add New… → Project** → import the GitHub repository. Vercel detects Next.js; leave the build settings alone.
2. Before deploying, open **Environment Variables** and add both:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable key (`sb_publishable_...`). On older projects, `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the anon key also works. |

3. **Deploy.** If you add or change the variables later, redeploy: they are baked in at build time.

No GitHub? Install Node.js, run `npx vercel` in this folder and follow the prompts, then add the two variables in the Vercel dashboard and run `npx vercel --prod`.

### 4. Check it

1. Open `https://your-site.vercel.app/host` on the projector laptop. The lobby must **not** show the amber "LOCAL MODE" warning. If it does, the environment variables are missing: add them and redeploy.
2. Scan the QR code with a phone **on mobile data** (not the same Wi-Fi). Pick a team. Your name should appear on the big screen within a second or two.
3. Run a rehearsal: open `/host?speed=10` and, in another window, `/dev/bots?count=40&code=CODE`. The whole game plays in 90 seconds.

## Run it locally

Requires [Node.js](https://nodejs.org) 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then paste your two Supabase values (optional, see below)
npm run dev                  # http://localhost:3000
```

**Without Supabase keys** the game runs in *local mode*: tabs in the same browser talk to each other directly. That is enough to rehearse with bots, try the phone screens in another tab, and play in Manual Mode. Real phones need the keys.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Engine unit tests (timeline = 900,000 ms, fair symmetric map, every rule, full-game simulations, colour-blind palette check) |
| `npm run smoke` | End-to-end rehearsal in headless Edge: full game with 40 bots + a phone, host reload, Manual Mode (run `npm run build` first) |

## Running the session

- **Before:** open `/host` during the Agenda so people join early. Click a team name to rename it to the real project-group name. Click a player's name to remove them.
- **START** begins the 15:00 clock. It never runs long: every phase boundary is `start time + fixed offset`.
- **Keep the host tab visible and in front.** Browsers slow down background tabs. The page asks the screen to stay awake.
- **If the host tab reloads or crashes,** reopen `/host`. It resumes in the right phase on the same clock, and phones reconnect by themselves.
- **If a phone drops,** reopening the link puts the player straight back in their team.
- **Emergency pause:** long-press the clock for a second. The paused time is added to the end and shown on screen.
- **If the Wi-Fi fails:** tick **Manual Mode** in the lobby and run the game by show of hands from the laptop. The guide has the steps.
- **Sound** comes from the projector laptop only. The volume slider is in the lobby.
- **Slow laptop?** `/host?fx=low` turns off bloom and water distortion. The game also does this by itself if the frame rate drops.
- `/host?fresh=1` discards a saved game and opens a new room.

Print `/guide?code=CODE` (Print → Save as PDF, A4, margins none, background graphics on) for the facilitator guide, run sheet, question bank and QR poster.

## Customising

| To change | Edit |
|---|---|
| Region / criterion names (to match the official rubric) | `config/rubric.ts` |
| Team names, colours, emblems | `config/teams.ts` (run `npm test`: it checks the colours stay colour-blind safe) |
| Phase durations and round order | `config/timeline.ts` (a test fails if the total is not exactly 900 s) |
| Steps, points, map size, obstacles per island | `config/balance.ts` |
| Questions and explanations (check these against the course material) | `content/questions.ts` |
| Pitch topics and waiting-room tips | `content/spotlight.ts` |

## How it works

- **Host-authoritative.** The projector browser runs the engine and is the single source of truth: clock, scoring, answer keys, resolution. Phones send inputs and draw what they receive. Answer keys are not sent until the Reveal.
- **Pure engine.** `lib/engine` is plain TypeScript with no React or Pixi, so every rule is unit-tested.
- **Realtime.** One Supabase Realtime channel per room, `spotlight:CODE`, using Broadcast for messages and Presence for who is connected. Vercel only serves static pages; there is no server code and no database.
- **Rendering.** The projector map is PixiJS v8 (WebGL) with pixi-filters; HUD animation uses GSAP; the phone UI uses Motion. All art is drawn in code and all sound is synthesized with WebAudio.

## Privacy

Only the nickname a player types is collected. There are no accounts and no tracking. Game state lives in the host's browser tab (with a local snapshot so a reload can resume) and nothing is stored on a server after the session.
