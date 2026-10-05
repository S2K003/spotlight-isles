"use client";

import confetti from "canvas-confetti";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { CRITERIA, OBJECTIVES_SHORT, RUBRIC, SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { Airship, Emblem } from "@/components/shared/Emblem";
import type { DebriefData, PublicData, RankRow, ResultsData } from "@/lib/engine/types";

/* ---------- results ceremony (60 s): count-up → podium → awards ---------- */

function CountUp({ to, run }: { to: number; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!run) return;
    const o = { v: 0 };
    const tw = gsap.to(o, {
      v: to,
      duration: 2.4,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) ref.current.textContent = String(Math.round(o.v));
      },
    });
    return () => {
      tw.kill();
    };
  }, [to, run]);
  return <span ref={ref}>0</span>;
}

function Podium({ rows, data, stage }: { rows: RankRow[]; data: PublicData; stage: number }) {
  // Visual order: 2nd, 1st, 3rd.
  const slots = [rows[1], rows[0], rows[2]];
  const heights = [190, 270, 140];
  const showAt = [2, 3, 1]; // 3rd rises first, then 2nd, then the winner
  return (
    <div className="flex h-[570px] items-end justify-center gap-5">
      {slots.map((row, i) => {
        if (!row) return <div key={i} className="w-[250px]" />;
        const t = data.teams[row.teamId];
        const up = stage >= showAt[i];
        return (
          <div key={row.teamId} className="flex w-[250px] flex-col items-center" style={{ transform: up ? "translateY(0)" : "translateY(760px)", transition: "transform 1.1s cubic-bezier(.2,1.35,.4,1)" }}>
            <div className={up ? "bob" : ""}>
              <Airship teamId={row.teamId} size={i === 1 ? 200 : 150} />
            </div>
            <div className="mt-1 font-display text-[44px] leading-none" style={{ color: TEAM_DEFS[row.teamId].text }}>
              {t.name}
            </div>
            <div className="font-display text-[34px] text-white">{row.score} pts</div>
            <div className="mt-2 grid w-full place-items-start justify-center rounded-t-3xl border-x-4 border-t-4 border-white/30 pt-3 font-display text-[90px] leading-none text-ink" style={{ height: heights[i], background: `linear-gradient(180deg, ${t.color}, ${t.color}88)` }}>
              {row.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Results({ data, results, frac }: { data: PublicData; results: ResultsData; frac: number }) {
  const rows = results.ranking;
  // Stages: 0 count-up · 1–3 podium steps · 4+ awards flip one by one.
  const stage = frac < 0.2 ? 0 : frac < 0.27 ? 1 : frac < 0.34 ? 2 : frac < 0.5 ? 3 : 4 + Math.min(3, Math.floor((frac - 0.5) / 0.1));
  const fired = useRef(false);
  useEffect(() => {
    if (stage < 3 || fired.current || !rows[0]) return;
    fired.current = true;
    const color = TEAM_DEFS[rows[0].teamId].color;
    const colors = [color, color, "#ffffff", "#ffd54a"];
    const burst = (x: number, angle: number) => void confetti({ particleCount: 120, spread: 80, startVelocity: 62, angle, origin: { x, y: 0.75 }, colors, scalar: 1.4 });
    burst(0.15, 60);
    burst(0.85, 120);
    const a = setTimeout(() => burst(0.5, 90), 500);
    const b = setTimeout(() => {
      burst(0.3, 75);
      burst(0.7, 105);
    }, 1400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [stage, rows]);

  const max = Math.max(1, ...rows.map((r) => r.score));
  return (
    <div className="absolute inset-0 bg-[#060818]/78">
      <div className="absolute left-10 top-8 font-display text-[84px] leading-none text-gold">🏆 RESULTS</div>

      <div className="absolute left-10 top-[195px] w-[600px]">
        {rows.map((r) => {
          const t = data.teams[r.teamId];
          return (
            <div key={r.teamId} className="glossy mb-3 rounded-2xl px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="w-10 font-display text-[36px] text-white/70">{r.rank}</span>
                <Emblem teamId={r.teamId} size={46} />
                <span className="flex-1 truncate font-display text-[34px]">{t.name}</span>
                <span className="font-display text-[44px] tabular-nums text-gold">
                  <CountUp to={r.score} run />
                </span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/45">
                <div className="h-full rounded-full" style={{ width: `${(r.score / max) * 100}%`, background: t.color, transition: "width 2.4s cubic-bezier(.2,1,.3,1)" }} />
              </div>
              <div className="mt-0.5 text-[20px] font-extrabold text-white/70">
                ⬢ {r.tiles} tiles{r.stage ? " · 🎤 Keynote Stage +100" : ""}
                {r.mastery.map((m) => ` · ${RUBRIC[m].icon} ${RUBRIC[m].label} +50`).join("")}
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute left-[680px] right-10 top-[195px]">
        <div style={{ opacity: stage >= 4 ? 0.25 : 1, transform: stage >= 4 ? "scale(.82) translateY(-70px)" : "none", transition: "all .8s", transformOrigin: "top center" }}>
          <Podium rows={rows} data={data} stage={stage} />
        </div>
      </div>

      <div className="absolute bottom-8 left-[680px] right-10 grid grid-cols-4 gap-4" style={{ perspective: 1600 }}>
        {results.awards.map((a, i) => {
          const open = stage >= 4 + i;
          return (
            <div key={a.key} className="relative h-[300px]" style={{ transformStyle: "preserve-3d", transform: open ? "rotateY(0deg)" : "rotateY(180deg)", transition: "transform .9s cubic-bezier(.3,1.3,.5,1)", opacity: stage >= 4 ? 1 : 0 }}>
              <div className="glossy absolute inset-0 flex flex-col items-center justify-center rounded-3xl p-3 text-center" style={{ backfaceVisibility: "hidden", borderColor: "#ffd54a" }}>
                <div className="text-[64px] leading-none">{a.icon}</div>
                <div className="font-display text-[34px] leading-tight text-gold">{a.title}</div>
                <div className="mt-1 flex items-center gap-2">
                  {a.teamId !== null && <Emblem teamId={a.teamId} size={40} />}
                  <span className="font-display text-[42px] leading-none">{a.name}</span>
                </div>
                <div className="mt-1 text-[22px] font-bold text-white/75">{a.detail}</div>
              </div>
              <div className="absolute inset-0 grid place-items-center rounded-3xl border-4 border-gold bg-gradient-to-br from-[#3b2a7a] to-[#141a3a] text-[110px]" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                ❓
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- debrief (50 s) ---------- */

function Radar({ debrief }: { debrief: DebriefData }) {
  const R = 210;
  const cx = 300, cy = 285;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / CRITERIA.length;
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v] as const;
  };
  const poly = (v: (i: number) => number) => CRITERIA.map((_, i) => pt(i, v(i)).join(",")).join(" ");
  return (
    <svg viewBox="0 0 600 570" className="h-[540px] w-[570px]" role="img" aria-label="Room-wide accuracy per criterion">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon key={g} points={poly(() => g)} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
      ))}
      {CRITERIA.map((c, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.19);
        const v = debrief.criteria[c];
        return (
          <g key={c}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,.22)" strokeWidth="2" />
            <text x={lx} y={ly - 6} textAnchor="middle" fontSize="26" fontWeight="800" fill={c === debrief.strongest ? "#86efac" : c === debrief.weakest ? "#fca5a5" : "#fff"}>
              {RUBRIC[c].icon} {RUBRIC[c].label}
            </text>
            <text x={lx} y={ly + 22} textAnchor="middle" fontSize="26" fontWeight="800" fill="#ffd54a">
              {v === null ? "—" : `${Math.round(v * 100)}%`}
            </text>
          </g>
        );
      })}
      <polygon points={poly((i) => Math.max(0.04, debrief.criteria[CRITERIA[i]] ?? 0))} fill="rgba(255,213,74,.38)" stroke="#ffd54a" strokeWidth="5" strokeLinejoin="round" />
      {CRITERIA.map((c, i) => {
        const [x, y] = pt(i, Math.max(0.04, debrief.criteria[c] ?? 0));
        return <circle key={c} cx={x} cy={y} r="8" fill="#ffd54a" stroke="#0b1026" strokeWidth="3" />;
      })}
    </svg>
  );
}

export function Debrief({ debrief, over }: { debrief: DebriefData; over: boolean }) {
  return (
    <div className="absolute inset-0 bg-[#060818]/82">
      <div className="absolute left-10 top-10 whitespace-nowrap font-display text-[50px] leading-none text-gold">📊 HOW DID THE ROOM DO?</div>
      <div className="absolute left-6 top-[150px]">
        <Radar debrief={debrief} />
        {debrief.spotlight && (
          <div className="glossy ml-6 mt-1 w-[560px] rounded-2xl px-5 py-3">
            <div className="text-[24px] font-extrabold uppercase tracking-wider text-white/60">Spotlight pitches (room average)</div>
            {SPOTLIGHT_CRITERIA.map((c) => {
              const v = debrief.spotlight![c.key];
              return (
                <div key={c.key} className="mt-1 flex items-center gap-3 text-[28px] font-extrabold">
                  <span className="w-[180px]">{c.label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-black/45">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${(v / 5) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right">{v.toFixed(1)}★</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="absolute left-[660px] right-10 top-[200px]">
        <div className="grid grid-cols-2 gap-5">
          <div className="glossy rounded-3xl px-6 py-4" style={{ borderColor: "#86efac" }}>
            <div className="text-[28px] font-extrabold text-white/70">🏆 The room&apos;s strongest skill</div>
            <div className="font-display text-[56px] leading-none text-emerald-300">{debrief.strongest ? `${RUBRIC[debrief.strongest].icon} ${RUBRIC[debrief.strongest].label}` : "—"}</div>
          </div>
          <div className="glossy rounded-3xl px-6 py-4" style={{ borderColor: "#fca5a5" }}>
            <div className="text-[28px] font-extrabold text-white/70">🎯 The skill to work on</div>
            <div className="font-display text-[56px] leading-none text-rose-300">{debrief.weakest ? `${RUBRIC[debrief.weakest].icon} ${RUBRIC[debrief.weakest].label}` : "—"}</div>
            {debrief.weakest && <div className="text-[24px] font-bold text-white/75">{RUBRIC[debrief.weakest].blurb}</div>}
          </div>
        </div>

        <div className="glossy mt-4 rounded-3xl px-6 py-3">
          <div className="font-display text-[36px] leading-tight text-gold">3 key takeaways</div>
          {debrief.takeaways.map((t, i) => (
            <div key={t} className="mt-2 flex gap-4 text-[29px] font-extrabold leading-[1.22]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold font-display text-ink">{i + 1}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-3xl bg-gold px-6 py-3 text-ink">
          <div className="text-[22px] font-extrabold uppercase tracking-wider opacity-70">For the Closing</div>
          <div className="font-display text-[40px] leading-[1.1]">&ldquo;{debrief.prompt}&rdquo;</div>
        </div>

        <div className="mt-3 text-[21px] font-bold leading-snug text-white/75">
          <span className="font-extrabold text-gold">Today&apos;s objectives:</span> {OBJECTIVES_SHORT.map((o) => `✔ ${o}`).join("   ")}
        </div>
      </div>

      {over && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35">
          <div className="stamp rounded-[36px] border-[14px] border-[#ff5a5a] bg-[#0b1026]/92 px-16 py-6 text-center shadow-[0_0_120px_rgba(255,90,90,.6)]">
            <div className="font-display text-[190px] leading-none text-[#ff5a5a]">GAME OVER</div>
            <div className="font-display text-[80px] leading-none text-white">15:00</div>
          </div>
        </div>
      )}
    </div>
  );
}
