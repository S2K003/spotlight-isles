"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { CARD_INFO } from "@/config/balance";
import { LEARNING_OBJECTIVES, RUBRIC } from "@/config/rubric";
import { Emblem } from "@/components/shared/Emblem";
import { MockSlide } from "@/components/shared/MockSlide";
import { formatClock } from "@/lib/engine/timeline";
import type { PublicData, TeamPublic } from "@/lib/engine/types";
import type { HostController, HostView } from "@/lib/net/host";

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
  const label = round
    ? `ROUND ${round} / ${view.publicData.totalRounds}`
    : kind.startsWith("final")
      ? "FINAL SHOWDOWN"
      : kind === "results"
        ? "RESULTS"
        : kind === "debrief"
          ? "DEBRIEF"
          : kind === "over"
            ? "GAME OVER"
            : "GET READY";

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

/* ---------- top left: phase banner ---------- */

const PHASE_TEXT: Record<string, [string, string]> = {
  intro: ["🗺️", "WELCOME TO SPOTLIGHT ISLES"],
  reveal: ["✅", "THE ANSWER"],
  vote: ["🗳️", "TEAMS ARE DECIDING…"],
  resolve: ["💨", "ALL SHIPS MOVE!"],
  spotReady: ["🎤", "SPOTLIGHT — GET READY"],
  spotSpeak: ["🎤", "SPOTLIGHT — LIVE PITCH"],
  spotRate: ["⭐", "MARK THE PITCH"],
  spotReveal: ["📋", "SCORECARDS"],
  finalBanner: ["🌙", "FINAL SHOWDOWN"],
  finalQ: ["⚡", "TRUE OR FALSE?"],
  finalReveal: ["✅", "THE ANSWER"],
  finalFlood: ["🌊", "TERRITORY FLOOD"],
};

export function PhaseBanner({ view }: { view: HostView }) {
  const kind = view.phase?.kind;
  if (!kind || kind === "results" || kind === "debrief") return null;
  const crit = view.publicData.criterion;
  const [icon, text] = kind === "challenge" && crit ? [RUBRIC[crit].icon, `${RUBRIC[crit].label.toUpperCase()} CHALLENGE`] : (PHASE_TEXT[kind] ?? ["", ""]);
  return (
    <div key={view.phase!.id} className="glossy absolute left-6 top-6 flex items-center gap-4 rounded-3xl px-6 py-3" style={{ animation: "pop .4s both", transformOrigin: "left center" }}>
      <span className="text-[52px] leading-none">{icon}</span>
      <div>
        <div className="font-display text-[40px] leading-none">{text}</div>
        {crit && (kind === "challenge" || kind === "reveal") && <div className="text-[24px] font-bold text-white/75">{RUBRIC[crit].region} · {RUBRIC[crit].blurb}</div>}
      </div>
    </div>
  );
}

/* ---------- right: scoreboard that re-sorts smoothly ---------- */

const ROW_H = 118;

export function Scoreboard({ view, progress }: { view: HostView; progress: { done: number; total: number }[] | null }) {
  const teams = view.publicData.teams;
  const order = teams.slice().sort((a, b) => b.score - a.score || b.tiles - a.tiles || a.id - b.id);
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
      <div className="w-8 text-center font-display text-[30px] text-white/70">{index + 1}</div>
      <Emblem teamId={team.id} size={54} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[30px] leading-none">{team.name}</span>
          <span className="shrink-0 whitespace-nowrap text-[22px] leading-none">{team.cards.map((c, i) => <span key={i} title={CARD_INFO[c].name}>{CARD_INFO[c].icon}</span>)}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 whitespace-nowrap text-[23px] font-extrabold leading-none text-white/80">
          <span title="Tiles owned">⬢ {team.tiles}</span>
          <span title="Players connected">👤 {team.players}</span>
        </div>
        {progress && progress.total > 0 && (
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/45">
            <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span ref={scoreRef} className="font-display text-[44px] leading-none tabular-nums">
          {team.score}
        </span>
        {team.mp !== null && (
          <div className="pop mt-0.5 rounded-lg px-2 text-center font-display text-[22px]" style={{ background: team.mp === 0 ? "#475569" : "#ffd54a", color: team.mp === 0 ? "#fff" : "#0b1026" }}>
            {team.mp === 0 ? "😰 0" : `${team.mp} MP`}
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
    tl.fromTo(el, { scale: 3, opacity: 0, rotate: -6 }, { scale: 1, opacity: 1, rotate: -3, duration: 0.42, ease: "back.out(2.4)" }).to(el, { opacity: 0, scale: 0.9, duration: 0.35, delay: 1.15, ease: "power2.in" });
    return () => {
      tl.kill();
    };
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
      <div ref={ref} className="text-center opacity-0">
        <div className="font-display text-[190px] leading-none" style={{ color: msg.color ?? "#ffd54a", WebkitTextStroke: "6px #0b1026", textShadow: "0 12px 0 rgba(0,0,0,.45), 0 0 80px rgba(255,255,255,.5)" }}>
          {msg.text}
        </div>
        {msg.sub && <div className="mt-2 inline-block rounded-2xl bg-ink/85 px-8 py-2 font-display text-[54px] text-white">{msg.sub}</div>}
      </div>
    </div>
  );
}

/* ---------- bottom panels ---------- */

function Panel({ children, height = 320 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-5" style={{ minHeight: height }}>
      {children}
    </div>
  );
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
  const order = q.type === "order";
  const correctIdx = rv && !Array.isArray(rv.correct) ? rv.correct : -1;
  const orderPos = rv && Array.isArray(rv.correct) ? rv.correct : null;
  const tf = q.type === "tf";
  return (
    <Panel>
      <div className="flex gap-6">
        {q.slide && <MockSlide slide={q.slide} width={420} />}
        <div className="min-w-0 flex-1">
          <div className="font-display text-[46px] leading-[1.08]">{q.prompt}</div>
          <div className={`mt-3 grid gap-2.5 ${tf ? "grid-cols-2" : q.slide ? "grid-cols-1" : "grid-cols-2"}`}>
            {q.options.map((opt, i) => {
              const right = correctIdx === i;
              const dim = rv && !order && !right;
              const pos = orderPos ? orderPos.indexOf(i) : -1;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2 text-[28px] font-extrabold leading-tight"
                  style={{
                    background: right ? "#16a34a" : "rgba(0,0,0,.35)",
                    opacity: dim ? 0.38 : 1,
                    outline: right ? "4px solid #fff" : "none",
                    transition: "all .4s",
                  }}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-[28px]" style={{ background: order ? (pos >= 0 ? "#ffd54a" : "#6d28d9") : tf ? (i === 0 ? "#10b981" : "#ef4444") : OPT_COLORS[i], color: order && pos >= 0 ? "#0b1026" : "#fff" }}>
                    {order ? (pos >= 0 ? pos + 1 : "?") : tf ? (i === 0 ? "✔" : "✘") : LETTERS[i]}
                  </span>
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {rv ? (
        <div className="mt-3 rounded-2xl bg-gold/15 px-4 py-2 text-[30px] font-extrabold leading-snug text-gold">💡 {rv.why}</div>
      ) : (
        !data.manualMode && <TeamPips teams={data.teams} progress={progress} label="Answers in" />
      )}
    </Panel>
  );
}

/** Reveal: each team's accuracy bar, the MP it earned, and the Quick Draw stamp. */
export function AccuracyStrip({ data }: { data: PublicData }) {
  const res = data.teamResults;
  if (!res) return null;
  return (
    <div className="absolute bottom-[352px] left-5 right-[440px] flex gap-3">
      {data.teams.map((t) => {
        const r = res[t.id];
        return (
          <div key={t.id} className="glossy relative flex-1 rounded-2xl px-3 py-2">
            <div className="flex items-center gap-2">
              <Emblem teamId={t.id} size={36} />
              <span className="truncate font-display text-[26px]">{t.name}</span>
            </div>
            <div className="mt-1 h-4 overflow-hidden rounded-full bg-black/45">
              <div className="h-full rounded-full" style={{ width: `${Math.round(r.accuracy * 100)}%`, background: t.color, transition: "width 1s" }} />
            </div>
            <div className="mt-1 flex items-baseline justify-between text-[26px] font-extrabold">
              <span className="text-white/75">{r.speaker ? "Speaker" : r.fairJudge ? "⚖️ Fair Judge" : `${Math.round(r.accuracy * 100)}%`}</span>
              <span className="font-display text-[30px]" style={{ color: r.mp === 0 ? "#93c5fd" : "#ffd54a" }}>
                {r.stageFright ? "😰 STAGE FRIGHT" : `${r.mp} MP`}
              </span>
            </div>
            {r.quickDraw && <div className="stamp absolute -top-5 right-1 rounded-lg border-4 border-gold bg-ink px-2 font-display text-[24px] text-gold">QUICK DRAW!</div>}
          </div>
        );
      })}
    </div>
  );
}

export function VotePanel({ data, progress }: { data: PublicData; progress: { done: number; total: number }[] }) {
  return (
    <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-3">
      <div className="flex items-center gap-5">
        <span className="pulse-soft font-display text-[44px] text-gold">TEAMS ARE DECIDING…</span>
        <span className="text-[26px] font-bold text-white/75">Talk to your team, then tap together. Majority moves the ship.</span>
      </div>
      {!data.manualMode && <TeamPips teams={data.teams} progress={progress} label="Votes in" />}
    </div>
  );
}

export function ResolvePanel({ data }: { data: PublicData }) {
  const moves = data.moves ?? [];
  const name = (id: number) => data.teams[id].name.toUpperCase();
  const lines: string[] = [];
  const clashers = moves.filter((m) => m.clashAt).map((m) => name(m.teamId));
  if (clashers.length) lines.push(`💥 CLASH! ${clashers.join(" and ")} bounced back`);
  for (const m of moves) {
    if (m.pickup) lines.push(`🎁 ${name(m.teamId)} found ${CARD_INFO[m.pickup].icon} ${CARD_INFO[m.pickup].name}`);
    for (const fx of m.cardFx) {
      if (fx.card === "heckler") lines.push(`📢 ${name(m.teamId)} heckled ${name(fx.target)} (−1 MP next round)`);
      else if (fx.card === "micdrop") lines.push(`🎤 ${name(m.teamId)} MIC DROP! +${fx.tiles.length} tiles`);
      else lines.push(`${CARD_INFO[fx.card].icon} ${name(m.teamId)} played ${CARD_INFO[fx.card].name}`);
    }
    if (m.swamp) lines.push(`🫧 ${name(m.teamId)} sank into Death-by-PowerPoint Swamp`);
  }
  if (!lines.length) lines.push(moves.some((m) => m.path.length > 1) ? "🎨 Territory painted — check the scoreboard!" : "⚓ Everyone held position");
  return (
    <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-3">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-[30px] font-extrabold">
        {lines.slice(0, 4).map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- intro cinematic: rules in three cards + objectives ---------- */

const RULES: [string, string, string][] = [
  ["🧠", "WIN CHALLENGES TO MOVE", "Everyone answers on their phone. More of your team correct = more movement points. Nobody correct? Stage Fright!"],
  ["🗳️", "VOTE WHERE TO FLY", "Your team's majority picks the destination. Every hex you cross is painted your colour. Same hex as a rival? CLASH!"],
  ["🎤", "STEP INTO THE SPOTLIGHT", "Three times, two players give a live 20-second pitch. Everyone else marks it: Hook, Clarity, Confidence."],
];

export function Intro({ frac }: { frac: number }) {
  const step = frac < 0.22 ? -1 : Math.min(2, Math.floor((frac - 0.22) / 0.26));
  return (
    <div className="absolute inset-x-0 bottom-8 px-10">
      {step < 0 ? (
        <div className="pop mx-auto max-w-[1500px] text-center">
          <div className="title-stroke font-display text-[150px] leading-none text-gold">SPOTLIGHT ISLES</div>
          <div className="mt-2 text-[40px] font-extrabold">Every island is a presentation marking criterion. Own the map by 15:00.</div>
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
              style={{
                opacity: i <= step ? 1 : 0.18,
                transform: i === step ? "translateY(-18px) scale(1.04)" : "none",
                transition: "all .5s cubic-bezier(.3,1.5,.5,1)",
                borderColor: i === step ? "#ffd54a" : undefined,
              }}
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
