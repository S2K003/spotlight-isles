"use client";

import confetti from "canvas-confetti";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { OBJECTIVES_SHORT, SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { Airship, Emblem } from "@/components/shared/Emblem";
import type { DebriefData, PublicData, RankRow, ResultsData } from "@/lib/engine/types";
import { ORDINAL } from "./MapCanvas";

/* ---------- results (35 s): count-up → podium → best pitch ---------- */

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const o = { v: 0 };
    const tw = gsap.to(o, {
      v: to,
      duration: 2.2,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) ref.current.textContent = String(Math.round(o.v));
      },
    });
    return () => {
      tw.kill();
    };
  }, [to]);
  return <span ref={ref}>0</span>;
}

function Podium({ rows, data, stage }: { rows: RankRow[]; data: PublicData; stage: number }) {
  // Visual order: 2nd, 1st, 3rd.
  const slots = [rows[1], rows[0], rows[2]];
  const heights = [190, 270, 140];
  const showAt = [2, 3, 1]; // 3rd rises first, then 2nd, then the winner
  return (
    <div className="flex h-[620px] items-end justify-center gap-5">
      {slots.map((row, i) => {
        if (!row) return <div key={i} className="w-[270px]" />;
        const t = data.teams[row.teamId];
        const up = stage >= showAt[i];
        return (
          <div key={row.teamId} className="flex w-[270px] flex-col items-center" style={{ transform: up ? "translateY(0)" : "translateY(820px)", transition: "transform 1.1s cubic-bezier(.2,1.35,.4,1)" }}>
            <div className={up ? "bob" : ""}>
              <Airship teamId={row.teamId} size={i === 1 ? 220 : 160} />
            </div>
            <div className="mt-1 font-display text-[46px] leading-none" style={{ color: TEAM_DEFS[row.teamId].text }}>
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
  // Stages: 0 count-up · 1–3 podium steps · 4 best pitch.
  const stage = frac < 0.22 ? 0 : frac < 0.32 ? 1 : frac < 0.42 ? 2 : frac < 0.7 ? 3 : 4;
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
    return () => clearTimeout(a);
  }, [stage, rows]);

  const max = Math.max(1, ...rows.map((r) => r.score));
  const best = results.bestPitch;
  return (
    <div className="absolute inset-0 bg-[#060818]/78">
      <div className="absolute left-10 top-8 font-display text-[84px] leading-none text-gold">🏆 RESULTS</div>

      <div className="absolute left-10 top-[195px] w-[640px]">
        {rows.map((r) => {
          const t = data.teams[r.teamId];
          return (
            <div key={r.teamId} className="glossy mb-3 rounded-2xl px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="w-10 font-display text-[36px] text-white/70">{r.rank}</span>
                <Emblem teamId={r.teamId} size={46} />
                <span className="flex-1 truncate font-display text-[34px]">{t.name}</span>
                <span className="font-display text-[44px] tabular-nums text-gold">
                  <CountUp to={r.score} />
                </span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/45">
                <div className="h-full rounded-full" style={{ width: `${(r.score / max) * 100}%`, background: t.color }} />
              </div>
              <div className="mt-0.5 text-[22px] font-extrabold text-white/75">
                {r.docked !== null ? `🎤 Reached the Stage ${ORDINAL[r.docked - 1]}` : r.hasKey ? "🔑 Had its key, still flying" : "Still looking for its key"}
                {r.stars > 0 ? ` · ⭐ ${r.stars}` : ""}
                {r.pitch !== null ? ` · pitch ${r.pitch.toFixed(1)}★` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute left-[720px] right-10 top-[190px]">
        <Podium rows={rows} data={data} stage={stage} />
      </div>

      {best !== null && (
        <div className="absolute bottom-8 left-[720px] right-10 flex justify-center" style={{ opacity: stage >= 4 ? 1 : 0, transform: stage >= 4 ? "none" : "translateY(60px)", transition: "all .7s cubic-bezier(.2,1.35,.4,1)" }}>
          <div className="glossy flex items-center gap-5 rounded-3xl px-8 py-4" style={{ borderColor: "#ffd54a" }}>
            <span className="text-[70px] leading-none">🎤</span>
            <div>
              <div className="font-display text-[34px] leading-none text-gold">BEST PITCH</div>
              <div className="flex items-center gap-3">
                <Emblem teamId={best} size={50} />
                <span className="font-display text-[56px] leading-none" style={{ color: TEAM_DEFS[best].text }}>
                  {data.teams[best].name}
                </span>
                <span className="font-display text-[44px] text-white">{results.ranking.find((r) => r.teamId === best)?.pitch?.toFixed(1)}★</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- debrief (30 s) ---------- */

function Bar({ label, frac, text }: { label: string; frac: number; text: string }) {
  return (
    <div className="mt-2 flex items-center gap-3 text-[28px] font-extrabold">
      <span className="w-[190px] shrink-0">{label}</span>
      <div className="h-6 flex-1 overflow-hidden rounded-full bg-black/45">
        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(2, frac * 100)}%` }} />
      </div>
      <span className="w-20 text-right tabular-nums">{text}</span>
    </div>
  );
}

export function Debrief({ debrief, over }: { debrief: DebriefData; over: boolean }) {
  const label = (k: string | null) => SPOTLIGHT_CRITERIA.find((c) => c.key === k)?.label ?? "—";
  return (
    <div className="absolute inset-0 bg-[#060818]/82">
      <div className="absolute left-10 top-10 whitespace-nowrap font-display text-[50px] leading-none text-gold">📊 HOW DID THE ROOM DO?</div>

      <div className="absolute left-10 top-[190px] w-[820px]">
        <div className="glossy rounded-3xl px-6 py-4">
          <div className="font-display text-[34px] leading-tight text-gold">The questions (hardest first)</div>
          {debrief.questions.map((q) => (
            <div key={q.id} className="mt-3">
              <div className="text-[25px] font-bold leading-snug text-white/90">{q.prompt}</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-black/45">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (q.accuracy ?? 0) * 100)}%`, background: (q.accuracy ?? 0) >= 0.6 ? "#34d399" : "#fb7185" }} />
                </div>
                <span className="w-[150px] text-right text-[26px] font-extrabold">{q.accuracy === null ? "—" : `${Math.round(q.accuracy * 100)}% right`}</span>
              </div>
            </div>
          ))}
        </div>

        {debrief.spotlight && (
          <div className="glossy mt-4 rounded-3xl px-6 py-4">
            <div className="font-display text-[34px] leading-tight text-gold">The pitches (room average)</div>
            {SPOTLIGHT_CRITERIA.map((c) => (
              <Bar key={c.key} label={c.label} frac={debrief.spotlight![c.key] / 5} text={`${debrief.spotlight![c.key].toFixed(1)}★`} />
            ))}
          </div>
        )}
      </div>

      <div className="absolute left-[900px] right-10 top-[190px]">
        {debrief.strongest && debrief.weakest && (
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="glossy rounded-3xl px-5 py-3" style={{ borderColor: "#86efac" }}>
              <div className="text-[25px] font-extrabold text-white/70">🏆 Strongest pitch skill</div>
              <div className="font-display text-[52px] leading-none text-emerald-300">{label(debrief.strongest)}</div>
            </div>
            <div className="glossy rounded-3xl px-5 py-3" style={{ borderColor: "#fca5a5" }}>
              <div className="text-[25px] font-extrabold text-white/70">🎯 Pitch skill to work on</div>
              <div className="font-display text-[52px] leading-none text-rose-300">{label(debrief.weakest)}</div>
            </div>
          </div>
        )}

        <div className="glossy rounded-3xl px-6 py-3">
          <div className="font-display text-[36px] leading-tight text-gold">3 key takeaways</div>
          {debrief.takeaways.map((t, i) => (
            <div key={t} className="mt-2 flex gap-4 text-[27px] font-extrabold leading-[1.22]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold font-display text-ink">{i + 1}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-3xl bg-gold px-6 py-3 text-ink">
          <div className="text-[22px] font-extrabold uppercase tracking-wider opacity-70">For the Closing</div>
          <div className="font-display text-[38px] leading-[1.1]">&ldquo;{debrief.prompt}&rdquo;</div>
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
