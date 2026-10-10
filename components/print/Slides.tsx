"use client";

import { LEARNING_OBJECTIVES, SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { DUR } from "@/config/timeline";
import { Emblem } from "@/components/shared/Emblem";
import { SCHEDULE, TOTAL_MINUTES } from "./PlanDoc";
import { Field } from "./workshop";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

interface Ctx {
  /** QR code image for joining the game, when a room is open in this browser. */
  qr: string;
  code: string;
  origin: string;
}

function Frame({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="relative overflow-hidden text-white" style={{ width: SLIDE_W, height: SLIDE_H, background: "linear-gradient(160deg,#1a1f4d 0%,#0f1434 55%,#0b1026 100%)", fontFamily: "var(--font-body)" }}>
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full" style={{ background: "radial-gradient(circle,#ffd54a33,transparent 70%)" }} />
      <div className="absolute bottom-5 left-12 flex items-center gap-2 opacity-80">
        {TEAM_DEFS.map((t) => (
          <Emblem key={t.id} teamId={t.id} size={22} />
        ))}
        <span className="ml-2 text-[15px] font-bold tracking-wide text-white/60">GSOE9010 · Week 5 · Presentation Skills</span>
      </div>
      <div className="absolute inset-0 px-16 pb-16 pt-12">
        {kicker && <div className="mb-1 text-[20px] font-extrabold uppercase tracking-[0.2em] text-[#ffd54a]">{kicker}</div>}
        {children}
      </div>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h2 className="font-display text-[58px] leading-[1.05]">{children}</h2>;

function ActivitySlide({ id, n }: { id: "a1" | "a2"; n: number }) {
  return (
    <Frame kicker={`Activity ${n} · 16 minutes`}>
      <H>
        <Field k={`${id}.title`} />
      </H>
      <div className="mt-5 grid grid-cols-[1fr_1.25fr] gap-8">
        <div>
          <div className="rounded-2xl bg-[#ffd54a] p-5 text-[#0b1026]">
            <div className="text-[16px] font-extrabold uppercase tracking-widest opacity-70">By the end you can</div>
            <div className="text-[26px] font-extrabold leading-snug">
              <Field k={`${id}.outcome`} />
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white/10 p-5">
            <div className="text-[16px] font-extrabold uppercase tracking-widest text-white/60">Take-away</div>
            <div className="text-[22px] font-bold leading-snug">
              <Field k={`${id}.summary`} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white/10 p-5">
          <div className="text-[16px] font-extrabold uppercase tracking-widest text-white/60">What to do</div>
          <div className="text-[25px] font-bold leading-snug">
            <Field k={`${id}.steps`} />
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** The slide deck for the whole hour. Each entry renders one 1280×720 slide. */
export const SLIDES: { title: string; render: (ctx: Ctx) => React.ReactNode }[] = [
  {
    title: "Title",
    render: () => (
      <Frame>
        <div className="flex h-full flex-col justify-center">
          <div className="text-[24px] font-extrabold uppercase tracking-[0.25em] text-[#ffd54a]">GSOE9010 · Week 5 workshop</div>
          <h1 className="font-display text-[132px] leading-[0.95]" style={{ textShadow: "0 6px 0 rgba(0,0,0,.35)" }}>
            Presentation
            <br />
            Skills
          </h1>
          <div className="mt-6 text-[30px] font-bold text-white/85">Say it so they remember it.</div>
          <div className="mt-8 text-[24px] font-bold text-white/70">
            Facilitated by <Field k="f1" inline />, <Field k="f2" inline />, <Field k="f3" inline /> and <Field k="f4" inline />
          </div>
        </div>
      </Frame>
    ),
  },
  {
    title: "Today",
    render: ({ qr, code }) => (
      <Frame kicker="The next hour">
        <H>What we&apos;ll do, and why</H>
        <div className="mt-5 grid grid-cols-[1.5fr_1fr] gap-8">
          <div>
            <div className="flex h-16 overflow-hidden rounded-2xl text-center text-[20px] font-extrabold text-[#0b1026]">
              {SCHEDULE.map((s, i) => (
                <div key={s.key} className="grid place-items-center px-1" style={{ flex: s.mins, background: ["#94a3b8", "#ffc21a", "#00e5ff", "#f472b6", "#94a3b8"][i] }}>
                  {s.mins}′
                </div>
              ))}
            </div>
            <div className="mt-1 flex text-[19px] font-bold text-white/80">
              {SCHEDULE.map((s) => (
                <div key={s.key} className="px-1 text-center leading-tight" style={{ flex: s.mins }}>
                  {s.key === "a1" ? "Activity 1" : s.key === "a2" ? "Activity 2" : s.key === "a3" ? "Spotlight Isles" : s.seg === "Introduction" ? "Intro" : "End"}
                </div>
              ))}
            </div>
            <div className="mt-6 text-[18px] font-extrabold uppercase tracking-widest text-white/60">By the end of the hour you can</div>
            <ol className="mt-1 list-decimal space-y-1 pl-7 text-[24px] font-bold leading-snug">
              {LEARNING_OBJECTIVES.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-white/10 p-5 text-center">
            <div className="font-display text-[30px] text-[#ffd54a]">While we talk: join the game</div>
            {qr ? (
              <>
                <img src={qr} alt="QR code to join the game" className="mx-auto mt-3 h-[230px] w-[230px] rounded-xl bg-white p-2" />
                <div className="mt-2 font-display text-[54px] leading-none tracking-[0.2em]">{code}</div>
              </>
            ) : (
              <div className="mt-6 text-[24px] font-bold leading-snug text-white/80">Scan the QR code on the game screen, type a nickname and pick your group number.</div>
            )}
            <div className="mt-2 text-[19px] font-bold text-white/70">Sit with your project group.</div>
          </div>
        </div>
        <div className="absolute bottom-16 right-16 text-[18px] font-bold text-white/50">{TOTAL_MINUTES} minutes in total</div>
      </Frame>
    ),
  },
  { title: "Activity 1", render: () => <ActivitySlide id="a1" n={1} /> },
  { title: "Activity 2", render: () => <ActivitySlide id="a2" n={2} /> },
  {
    title: "Activity 3: Spotlight Isles",
    render: () => (
      <Frame kicker="Activity 3 · 16 minutes · our own game">
        <H>
          <span className="text-[#ffd54a]">Spotlight Isles</span>
        </H>
        <div className="mt-2 text-[28px] font-bold text-white/85">Get your group&apos;s airship to the Keynote Stage by talking and pitching well.</div>
        <div className="mt-5 grid grid-cols-3 gap-5">
          {[
            ["🎯", "The goal", "Fly to your key on the opposite island, then to the Stage in the middle."],
            ["💬", "Talk to move", `Discuss each question for ${DUR.challenge} seconds and agree on an answer. Get it right and you move further.`],
            ["🎡", "Everyone pitches once", `A spin picks two groups. You get a topic, ${DUR.spotReady} seconds to prepare and ${DUR.spotSpeak} seconds to speak.`],
          ].map(([icon, title, text]) => (
            <div key={title} className="rounded-2xl bg-white/10 p-5">
              <div className="text-[52px] leading-none">{icon}</div>
              <div className="mt-1 font-display text-[32px] text-[#ffd54a]">{title}</div>
              <div className="text-[23px] font-bold leading-snug">{text}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-5">
          <div className="rounded-2xl bg-[#ffd54a] px-5 py-3 text-[24px] font-extrabold text-[#0b1026]">By the end you can spot good technique, give a short talk, and mark one fairly.</div>
          <a href="/host" target="_blank" rel="noreferrer" className="no-print rounded-2xl bg-emerald-400 px-5 py-3 text-[24px] font-extrabold text-[#0b1026]">
            ▶ Open the game
          </a>
        </div>
      </Frame>
    ),
  },
  {
    title: "How pitches are marked",
    render: () => (
      <Frame kicker="In the game, and in every presentation you give">
        <H>What makes a talk land?</H>
        <div className="mt-6 grid grid-cols-3 gap-5">
          {SPOTLIGHT_CRITERIA.map((c, i) => (
            <div key={c.key} className="rounded-2xl bg-white/10 p-6">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-[#ffd54a] font-display text-[38px] text-[#0b1026]">{i + 1}</div>
              <div className="mt-2 font-display text-[50px] leading-none text-[#ffd54a]">{c.label}</div>
              <div className="mt-2 text-[27px] font-bold leading-snug">{c.hint}</div>
              <div className="mt-3 text-[21px] font-bold leading-snug text-white/70">
                {["Open with a question, a problem or a surprising fact.", "One message. Plain words. Signpost where you're going.", "Pause, look up, vary your voice, and finish on purpose."][i]}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-[25px] font-bold text-white/80">You&apos;ll give each pitch 1–5 stars for each of these. Mark the pitch, not the person.</div>
      </Frame>
    ),
  },
  {
    title: "Take-home messages",
    render: () => (
      <Frame kicker="Wrap-up">
        <H>Three things to take with you</H>
        <div className="mt-6 space-y-4">
          {["take1", "take2", "take3"].map((k, i) => (
            <div key={k} className="flex items-center gap-5 rounded-2xl bg-white/10 p-5">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#ffd54a] font-display text-[38px] text-[#0b1026]">{i + 1}</div>
              <div className="text-[31px] font-extrabold leading-snug">
                <Field k={k} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl bg-[#ffd54a] px-6 py-4 font-display text-[36px] text-[#0b1026]">Your turn: tell us one thing you learned, or one thing you&apos;ll do differently.</div>
      </Frame>
    ),
  },
  {
    title: "Thank you",
    render: () => (
      <Frame>
        <div className="flex h-full flex-col items-center justify-center text-center">
          <h1 className="font-display text-[120px] leading-none text-[#ffd54a]">Thank you</h1>
          <div className="mt-4 text-[38px] font-extrabold">Questions?</div>
          <div className="mt-8 text-[24px] font-bold text-white/70">
            <Field k="f1" inline /> · <Field k="f2" inline /> · <Field k="f3" inline /> · <Field k="f4" inline />
          </div>
        </div>
      </Frame>
    ),
  },
];

/** One slide scaled to a given width (used for printing and for the handout in the pack). */
export function ScaledSlide({ index, width, ctx }: { index: number; width: number; ctx: Ctx }) {
  const k = width / SLIDE_W;
  return (
    <div style={{ width, height: SLIDE_H * k, overflow: "hidden" }}>
      <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${k})`, transformOrigin: "top left" }}>{SLIDES[index].render(ctx)}</div>
    </div>
  );
}

/** The slides as portrait handout pages (two per sheet) for the single upload PDF. */
export function SlidesHandout({ ctx }: { ctx: Ctx }) {
  const pairs: number[][] = [];
  for (let i = 0; i < SLIDES.length; i += 2) pairs.push([i, i + 1].filter((n) => n < SLIDES.length));
  return (
    <>
      {pairs.map((pair, p) => (
        <section key={p} className="sheet" style={{ fontSize: "9pt" }}>
          <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
            <h1 className="text-[18pt] leading-none">Presentation slides</h1>
            <div className="text-right text-[9pt] font-bold">
              Slides {pair[0] + 1}
              {pair[1] !== undefined ? `–${pair[1] + 1}` : ""} of {SLIDES.length}
            </div>
          </div>
          {pair.map((n) => (
            <div key={n} className="mt-4">
              <div className="mb-1 text-[9pt] font-bold text-gray-600">
                {n + 1}. {SLIDES[n].title}
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-400">
                <ScaledSlide index={n} width={716} ctx={ctx} />
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
