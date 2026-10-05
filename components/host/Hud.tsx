"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { POINTS } from "@/config/balance";
import { LEARNING_OBJECTIVES } from "@/config/rubric";
import { Emblem } from "@/components/shared/Emblem";
import { MockSlide } from "@/components/shared/MockSlide";
import { formatClock } from "@/lib/engine/timeline";
import type { PublicData, TeamPublic } from "@/lib/engine/types";
import type { HostController, HostView } from "@/lib/net/host";
import { ORDINAL } from "./MapCanvas";

/** Re-reads the master clock ~10×/s so countdowns are smooth and never depend on React state. */
export function useClock(ctl: HostController): { phaseMs: number; globalMs: number; frac: number } {
  const read = () => {
    const r = ctl.remaining();
    return { phaseMs: r.phaseMs, globalMs: r.globalMs, frac: r.phaseDurationMs > 0 ? 1 - r.phaseMs / r.phaseDurationMs : 0 };
  };
  const [v, setV] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setV(read()), 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl]);
  return v;
}

/* ---------- top centre: global 15:00 countdown ---------- */

export function Clock({ ctl, view }: { ctl: HostController; view: HostView }) {
  const { phaseMs, globalMs, frac } = useClock(ctl);
  const speed = view.state.speed || 1;
  const gameMs = view.over ? 0 : globalMs * speed;
  const low = gameMs < 60_000 && !view.over;
  const paused = view.state.pausedAt !== null;
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const round = view.phase?.round;
  const kind = view.phase?.kind ?? (view.over ? "over" : "lobby");
  const label = round ? `ROUND ${round} / ${view.publicData.totalRounds}` : kind === "results" ? "RESULTS" : kind === "debrief" ? "DEBRIEF" : kind === "over" ? "GAME OVER" : "GET READY";

  // Emergency pause is deliberately hidden behind a long-press on the clock.
  const down = () => {
    hold.current = setTimeout(() => ctl.togglePause(), 1200);
  };
  const up = () => {
    if (hold.current) clearTimeout(hold.current);
  };

  return (
    <div className="absolute left-1/2 top-4 -translate-x-1/2 select-none text-center" onPointerDown={down} onPointerUp={up} onPointerLeave={up} title="Long-press to pause (emergencies only)">
      <div className={`glossy rounded-3xl px-9 pb-1 pt-2 ${low ? "pulse-red" : ""}`} style={low ? { borderColor: "#ef4444", boxShadow: "0 0 40px rgba(239,68,68,.6)" } : undefined}>
        <div className="font-display text-[84px] leading-none tabular-nums" style={{ color: low ? "#ff5a5a" : "#fff" }}>
          {formatClock(gameMs)}
        </div>
        <div className="mx-auto mt-1 h-2 w-full overflow-hidden rounded-full bg-black/40">
          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(0, 100 - frac * 100)}%` }} />
        </div>
        <div className="mt-1 font-display text-[28px] leading-tight tracking-wider text-gold">
          {label}
          {!view.over && view.phase && <span className="ml-3 text-white/70">{Math.ceil((phaseMs * speed) / 1000)}s</span>}
        </div>
      </div>
      {paused && (
        <div className="mt-2 rounded-xl bg-amber-400 px-4 py-1 text-[28px] font-extrabold text-ink">
          PAUSED — long-press the clock to resume · +{formatClock(view.state.pausedMs + (Date.now() - (view.state.pausedAt ?? Date.now())))} added
        </div>
      )}
      {!paused && view.state.pausedMs > 0 && <div className="mt-1 text-[20px] font-bold text-white/70">Extended by {formatClock(view.state.pausedMs)} (paused)</div>}
    </div>
  );
}

/* ---------- top left: what is happening now ---------- */

const PHASE_TEXT: Record<string, [string, string, string]> = {
  intro: ["🗺️", "WELCOME TO SPOTLIGHT ISLES", ""],
  challenge: ["💬", "TALK IT THROUGH", "Discuss, then tap your team's answer"],
  reveal: ["✅", "THE ANSWER", "Points decide who moves first"],
  vote: ["🧭", "WHERE TO?", "Agree on a hex with your team"],
  resolve: ["💨", "SHIPS MOVE", "One at a time — most points first"],
  spotReady: ["🎤", "PITCH PREP", "Choose a speaker and plan your pitch"],
  spotSpeak: ["🎤", "LIVE PITCH", "25 seconds — everyone else listens"],
  spotRate: ["⭐", "MARK THE PITCH", "Hook · Clarity · Confidence"],
  spotReveal: ["📋", "SCORECARDS", "Stars become steps"],
};

export function PhaseBanner({ view }: { view: HostView }) {
  const kind = view.phase?.kind;
  const row = kind ? PHASE_TEXT[kind] : undefined;
  if (!row) return null;
  return (
    <div key={view.phase!.id} className="pop glossy absolute left-6 top-6 flex max-w-[620px] items-center gap-4 rounded-3xl px-6 py-3" style={{ transformOrigin: "left center" }}>
      <span className="text-[52px] leading-none">{row[0]}</span>
      <div>
        <div className="font-display text-[42px] leading-none">{row[1]}</div>
        {row[2] && <div className="mt-1 text-[26px] font-bold leading-tight text-white/80">{row[2]}</div>}
      </div>
    </div>
  );
}

/* ---------- right: scoreboard that re-sorts smoothly ---------- */

const ROW_H = 118;

export function Scoreboard({ view, progress }: { view: HostView; progress: { done: number; total: number }[] | null }) {
  const teams = view.publicData.teams;
  const order = teams.slice().sort((a, b) => b.score - a.score || (a.docked ?? 99) - (b.docked ?? 99) || a.id - b.id);
  const rank = new Map(order.map((t, i) => [t.id, i]));
  return (
    <div className="absolute right-5 top-5 w-[400px]">
      <div className="glossy rounded-3xl p-3">
        <div className="relative" style={{ height: ROW_H * teams.length }}>
          {teams.map((t) => (
            <ScoreRow key={t.id} team={t} index={rank.get(t.id) ?? 0} progress={progress?.[t.id] ?? null} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ team, index, progress }: { team: TeamPublic; index: number; progress: { done: number; total: number } | null }) {
  const scoreRef = useRef<HTMLSpanElement>(null);
  const shown = useRef({ v: team.score });
  useEffect(() => {
    const tw = gsap.to(shown.current, {
      v: team.score,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        if (scoreRef.current) scoreRef.current.textContent = String(Math.round(shown.current.v));
      },
    });
    return () => {
      tw.kill();
    };
  }, [team.score]);

  return (
    <div
      className="absolute inset-x-0 flex items-center gap-3 rounded-2xl px-3"
      style={{
        height: ROW_H - 8,
        transform: `translateY(${index * ROW_H}px)`,
        transition: "transform .7s cubic-bezier(.3,1.3,.5,1)",
        background: `linear-gradient(90deg, ${team.color}55, rgba(0,0,0,.25))`,
        borderLeft: `8px solid ${team.color}`,
      }}
    >
      <Emblem teamId={team.id} size={56} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[32px] leading-none">{team.name}</div>
        <div className="mt-1.5 flex items-center gap-2 whitespace-nowrap text-[24px] font-extrabold leading-none text-white/85">
          {team.docked !== null ? (
            <span className="text-gold">🎤 At the Stage</span>
          ) : (
            <span style={{ opacity: team.hasKey ? 1 : 0.35 }} title={team.hasKey ? "Has its key" : "Still needs its key"}>
              🔑{team.hasKey ? " ✓" : ""}
            </span>
          )}
          {team.stars > 0 && <span>⭐{team.stars}</span>}
        </div>
        {progress && progress.total > 0 && (
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/45">
            <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span ref={scoreRef} className="font-display text-[46px] leading-none tabular-nums">
          {team.score}
        </span>
        {team.steps !== null && team.docked === null && (
          <div className="pop mt-0.5 rounded-lg bg-gold px-2 text-center font-display text-[22px] text-ink">
            {team.steps} {team.steps === 1 ? "step" : "steps"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- big slam banner (GSAP, overshoot easing) ---------- */

export interface SlamMsg {
  id: number;
  text: string;
  sub?: string;
  color?: string;
}

export function Slam({ msg }: { msg: SlamMsg | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !msg) return;
    const tl = gsap.timeline();
    tl.fromTo(el, { scale: 3, opacity: 0, rotate: -6 }, { scale: 1, opacity: 1, rotate: -3, duration: 0.42, ease: "back.out(2.4)" }).to(el, { opacity: 0, scale: 0.9, duration: 0.35, delay: 1.3, ease: "power2.in" });
    return () => {
      tl.kill();
    };
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
      <div ref={ref} className="text-center opacity-0">
        <div className="font-display text-[170px] leading-none" style={{ color: msg.color ?? "#ffd54a", WebkitTextStroke: "6px #0b1026", textShadow: "0 12px 0 rgba(0,0,0,.45), 0 0 80px rgba(255,255,255,.5)" }}>
          {msg.text}
        </div>
        {msg.sub && <div className="mt-2 inline-block rounded-2xl bg-ink/85 px-8 py-2 font-display text-[54px] text-white">{msg.sub}</div>}
      </div>
    </div>
  );
}

/* ---------- bottom panels ---------- */

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-5">{children}</div>;
}

const LETTERS = ["A", "B", "C", "D"];
const OPT_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981"];

export function TeamPips({ teams, progress, label }: { teams: TeamPublic[]; progress: { done: number; total: number }[]; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="text-[24px] font-extrabold uppercase tracking-wider text-white/60">{label}</span>
      {teams.map((t) => {
        const p = progress[t.id];
        const frac = p.total ? p.done / p.total : 0;
        return (
          <div key={t.id} className="flex flex-1 items-center gap-2">
            <Emblem teamId={t.id} size={34} />
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-black/45">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${frac * 100}%`, background: t.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function QuestionPanel({ data, progress, reveal }: { data: PublicData; progress: { done: number; total: number }[]; reveal: boolean }) {
  const q = data.question;
  if (!q) return null;
  const rv = reveal ? data.reveal : undefined;
  if (rv) {
    // Reveal: just the question, the best answer and why, so the result cards fit above.
    return (
      <Panel>
        <div className="text-[30px] font-extrabold leading-snug text-white/80">{q.prompt}</div>
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[#16a34a] px-4 py-2 text-[32px] font-extrabold leading-tight outline outline-4 outline-white">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display text-[30px]" style={{ background: OPT_COLORS[rv.correct] }}>
            {LETTERS[rv.correct]}
          </span>
          <span>{rv.correctText}</span>
        </div>
        <div className="mt-2 rounded-2xl bg-gold/15 px-4 py-2 text-[30px] font-extrabold leading-snug text-gold">💡 {rv.why}</div>
      </Panel>
    );
  }
  return (
    <Panel>
      <div className="flex gap-6">
        {q.slide && <MockSlide slide={q.slide} width={400} />}
        <div className="min-w-0 flex-1">
          <div className="font-display text-[44px] leading-[1.08]">{q.prompt}</div>
          <div className={`mt-3 grid gap-2.5 ${q.slide ? "grid-cols-1" : "grid-cols-2"}`}>
            {q.options.map((opt, i) => {
              return (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-black/35 px-3 py-2 text-[28px] font-extrabold leading-tight">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-[28px]" style={{ background: OPT_COLORS[i] }}>
                    {LETTERS[i]}
                  </span>
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 text-[28px] font-bold text-white/80">💬 Talk it through with your team, then everyone taps the answer you agree on. You can change it until time runs out.</div>
      {!data.manualMode && <TeamPips teams={data.teams} progress={progress} label="Answers in" />}
    </Panel>
  );
}

/** After a round: what each team earned, listed in the order they will move. */
export function ResultStrip({ data, bottom }: { data: PublicData; bottom: number }) {
  const res = data.teamResults;
  const order = data.order;
  if (!res || !order) return null;
  return (
    <div className="absolute left-5 right-[440px] flex gap-3" style={{ bottom }}>
      {order.map((id, i) => {
        const t = data.teams[id];
        const r = res[id];
        const docked = t.docked !== null;
        return (
          <div key={id} className="pop glossy relative flex-1 rounded-2xl px-3 py-2" style={{ animationDelay: `${i * 0.08}s`, borderColor: t.color }}>
            <div className="flex items-center gap-2">
              <span className="font-display text-[26px] text-white/70">{docked ? "🎤" : ORDINAL[i]}</span>
              <Emblem teamId={id} size={34} />
              <span className="truncate font-display text-[26px]">{t.name}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-[24px] font-extrabold text-white/80">
                {r.speaker ? "Pitched" : r.fairJudge ? "⚖️ Fair judge" : r.rated === false ? "Didn't mark" : r.rated ? "Marked" : `${Math.round(r.accuracy * 100)}% right`}
              </span>
              <span className="font-display text-[26px] text-emerald-300">+{r.points}</span>
            </div>
            <div className="font-display text-[32px] leading-tight text-gold">
              {docked ? "At the Stage" : `${r.steps} ${r.steps === 1 ? "step" : "steps"}`}
              {r.tailwind && <span className="ml-2 text-[22px] text-sky-300">🌬️ tailwind</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VotePanel({ data, progress }: { data: PublicData; progress: { done: number; total: number }[] }) {
  return (
    <Panel>
      <div className="flex items-center gap-5">
        <span className="shrink-0 font-display text-[46px] text-gold">🧭 WHERE TO?</span>
        <span className="text-[27px] font-bold leading-snug text-white/85">Talk with your team and tap a glowing hex. Get your 🔑 first, then head for the Stage. Ships move in score order, and you can&apos;t land on another ship.</span>
      </div>
      {!data.manualMode && <TeamPips teams={data.teams} progress={progress} label="Votes in" />}
    </Panel>
  );
}

export function ResolvePanel({ data }: { data: PublicData }) {
  const moves = data.moves ?? [];
  const name = (id: number) => data.teams[id].name.toUpperCase();
  const lines: string[] = [];
  for (const m of moves) {
    if (m.docked) lines.push(`🎤 ${name(m.teamId)} reaches the Stage ${ORDINAL[m.docked - 1]}! +${POINTS.dock[Math.min(m.docked, POINTS.dock.length) - 1]}`);
    if (m.gotKey) lines.push(`🔑 ${name(m.teamId)} found its key`);
    if (m.stars.length) lines.push(`⭐ ${name(m.teamId)} grabbed a star`);
    if (m.blockedAt) lines.push(`💥 ${name(m.teamId)} was beaten to a hex`);
  }
  if (!lines.length) lines.push(moves.some((m) => m.path.length > 1) ? "Ships on the move…" : "⚓ Everyone held position");
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-[30px] font-extrabold">
        {lines.slice(0, 5).map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </Panel>
  );
}

/* ---------- intro: the whole game in three cards ---------- */

const RULES: [string, string, string][] = [
  ["🔑", "FIND YOUR KEY, REACH THE STAGE", "Your team's key is on the opposite island. Fly over it, then head for the Keynote Stage in the middle. Water blocks you and fog slows you down."],
  ["💬", "TALK FIRST, THEN TAP", "Each round your team discusses a question, or pitches for 25 seconds while the others mark it. Better answers and pitches earn more steps."],
  ["🥇", "MOST POINTS MOVES FIRST", "Ships move one at a time, highest score first, and you can't land on another ship. Last place gets a tailwind: one extra step."],
];

export function Intro({ frac }: { frac: number }) {
  const step = frac < 0.2 ? -1 : Math.min(2, Math.floor((frac - 0.2) / 0.27));
  return (
    <div className="absolute inset-x-0 bottom-8 px-10">
      {step < 0 ? (
        <div className="pop mx-auto max-w-[1500px] text-center">
          <div className="title-stroke font-display text-[150px] leading-none text-gold">SPOTLIGHT ISLES</div>
          <div className="mt-2 text-[40px] font-extrabold">A race to the Keynote Stage, powered by good presenting.</div>
          <div className="glossy mx-auto mt-5 grid max-w-[1400px] grid-cols-2 gap-x-8 gap-y-2 rounded-3xl px-8 py-4 text-left text-[28px] font-bold">
            {LEARNING_OBJECTIVES.map((o, i) => (
              <div key={o} className="flex gap-3">
                <span className="font-display text-gold">{i + 1}</span>
                {o}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1760px] grid-cols-3 gap-6">
          {RULES.map(([icon, title, text], i) => (
            <div
              key={title}
              className="glossy rounded-3xl p-6"
              style={{ opacity: i <= step ? 1 : 0.18, transform: i === step ? "translateY(-18px) scale(1.04)" : "none", transition: "all .5s cubic-bezier(.3,1.5,.5,1)", borderColor: i === step ? "#ffd54a" : undefined }}
            >
              <div className="text-[70px] leading-none">{icon}</div>
              <div className="mt-2 font-display text-[40px] leading-tight text-gold">{title}</div>
              <div className="mt-1 text-[28px] font-bold leading-snug text-white/90">{text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small legend so the map reads at a glance. */
export function Legend() {
  const items: [string, string][] = [["🔑", "your key: on the opposite island"], ["🎤", "the Stage: needs your key"], ["⭐", "star: +10 points"], ["☁️", "fog: costs 2 steps"], ["🌊", "water: no way through"]];
  return (
    <div className="glossy absolute left-6 top-[150px] rounded-2xl px-4 py-2 text-[24px] font-bold leading-snug text-white/90">
      {items.map(([icon, text]) => (
        <div key={text}>
          {icon} {text}
        </div>
      ))}
    </div>
  );
}
