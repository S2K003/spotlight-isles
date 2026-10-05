# Spotlight Isles

A 15-minute, 6-team, real-time multiplayer strategy game about presentation skills, built for the GSOE9010 Week 5 Presentation Skills (FC4) workshop. Players join on their phones; one projector screen runs the game.

- `/` — landing page: join with a 4-letter code, or host
- `/host` — projector screen (lobby → game → results → debrief). Runs the game engine.
- `/play/CODE` — phone controller
- `/guide` — printable facilitator guide, question bank and QR poster
- `/dev/bots?count=40&code=CODE` — bot simulator for rehearsals

The full design is in [SPOTLIGHT_ISLES_BUILD_SPEC.md](SPOTLIGHT_ISLES_BUILD_SPEC.md). Choices made where the spec was open are in [DECISIONS.md](DECISIONS.md).

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
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key |

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
| `npm test` | Engine unit tests (timeline = 900,000 ms, map, every rule, full-game simulations, colour-blind palette check) |
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
| Movement points, card odds, tile mix, scoring | `config/balance.ts` |
| Questions and explanations | `content/questions.ts` |
| Spotlight topics, twists, waiting-room tips | `content/spotlight.ts` |

## How it works

- **Host-authoritative.** The projector browser runs the engine and is the single source of truth: clock, scoring, answer keys, resolution. Phones send inputs and draw what they receive. Answer keys are not sent until the Reveal.
- **Pure engine.** `lib/engine` is plain TypeScript with no React or Pixi, so every rule is unit-tested.
- **Realtime.** One Supabase Realtime channel per room, `spotlight:CODE`, using Broadcast for messages and Presence for who is connected. Vercel only serves static pages; there is no server code and no database.
- **Rendering.** The projector map is PixiJS v8 (WebGL) with pixi-filters; HUD animation uses GSAP; the phone UI uses Motion. All art is drawn in code and all sound is synthesized with WebAudio.

## Privacy

Only the nickname a player types is collected. There are no accounts and no tracking. Game state lives in the host's browser tab (with a local snapshot so a reload can resume) and nothing is stored on a server after the session.
