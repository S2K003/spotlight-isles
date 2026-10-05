"use client";

import { useEffect, useState } from "react";
import { SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { PITCH_RECIPE } from "@/content/spotlight";
import { Emblem } from "@/components/shared/Emblem";
import type { PublicData, SpeakerResult } from "@/lib/engine/types";
import type { HostView } from "@/lib/net/host";
import { TeamPips } from "./Hud";

function Bars() {
  return (
    <div className="flex h-24 items-end gap-1.5" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <div key={i} className="eq-bar w-3 rounded-t bg-gold" style={{ height: `${40 + ((i * 37) % 60)}%`, animationDelay: `${-(i * 0.137) % 0.9}s`, animationDuration: `${0.5 + ((i * 13) % 7) / 10}s` }} />
      ))}
    </div>
  );
}

function Scorecard({ teamId, teamName, res, steps }: { teamId: number; teamName: string; res: SpeakerResult; steps: number }) {
  return (
    <div className="glossy flex-1 rounded-3xl px-6 py-4">
      <div className="flex items-center gap-3">
        <Emblem teamId={teamId} size={60} />
        <div className="min-w-0 flex-1 truncate font-display text-[48px] leading-none" style={{ color: TEAM_DEFS[teamId].text }}>
          {teamName}
        </div>
        <div className="text-right">
          <div className="font-display text-[60px] leading-none text-gold">{res.overall === null ? "—" : res.overall.toFixed(1)}★</div>
          <div className="pop rounded-lg bg-gold px-2 text-center font-display text-[26px] text-ink">
            {steps} {steps === 1 ? "step" : "steps"}
          </div>
        </div>
      </div>
      {SPOTLIGHT_CRITERIA.map((c, i) => {
        const v = (res[c.key] as number | null) ?? 0;
        return (
          <div key={c.key} className="mt-2 flex items-center gap-3 text-[28px] font-extrabold">
            <span className="w-[200px]">{c.label}</span>
            <div className="h-6 flex-1 overflow-hidden rounded-full bg-black/45">
              <div className="h-full rounded-full bg-gold" style={{ width: `${(v / 5) * 100}%`, transition: `width 1.1s ${0.15 + i * 0.25}s cubic-bezier(.2,1,.3,1)` }} />
            </div>
            <span className="w-14 text-right tabular-nums">{res[c.key] === null ? "—" : v.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  view: HostView;
  data: PublicData;
  seconds: number;
  progress: { done: number; total: number }[];
}

/** The stage view that replaces the bottom area during pitch rounds. */
export function SpotlightStage({ view, data, seconds, progress }: Props) {
  const spot = data.spot;
  const kind = view.phase?.kind;
  // Scorecard bars animate from 0: flip a flag just after mount.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    setGrown(false);
    const id = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(id);
  }, [view.phase?.id]);
  if (!spot || !kind) return null;

  const slot = spot.slot;
  const team = data.teams[spot.teams[slot]];

  if (kind === "spotReady") {
    return (
      <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-5">
        <div className="flex items-center gap-4">
          <span className="font-display text-[46px] text-gold">🎤 PITCH ROUND</span>
          <span className="rounded-full bg-black/40 px-4 py-1 font-display text-[38px]">{seconds}s to prepare</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-5">
          {[0, 1].map((s) => {
            const t = data.teams[spot.teams[s]];
            return (
              <div key={s} className="rounded-2xl bg-black/35 px-5 py-3" style={{ borderLeft: `8px solid ${t.color}` }}>
                <div className="flex items-center gap-3">
                  <Emblem teamId={t.id} size={46} />
                  <span className="font-display text-[38px]" style={{ color: TEAM_DEFS[t.id].text }}>
                    {t.name}
                  </span>
                  <span className="text-[26px] font-bold text-white/65">pitches {s === 0 ? "1st" : "2nd"}</span>
                </div>
                <div className="mt-1 text-[24px] font-extrabold uppercase tracking-wider text-white/55">Your topic is on your phones</div>
                <div className="text-[28px] font-extrabold leading-snug">Choose one speaker. Plan 25 seconds together.</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[27px] font-bold">
          <span className="text-white/70">Everyone else, you&apos;ll mark:</span>
          {PITCH_RECIPE.map(([label, hint]) => (
            <span key={label} className="rounded-xl bg-black/35 px-3 py-1">
              <span className="font-display text-gold">{label}</span> <span className="text-white/75">{hint}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "spotSpeak") {
    return (
      <div className="absolute bottom-5 left-5 right-[440px] h-[380px] overflow-hidden rounded-3xl border border-white/20 bg-[#070a1c]/92 shadow-2xl">
        <div className="spot-beam absolute left-1/2 top-[-40px] h-[520px] w-[620px] -translate-x-1/2" style={{ background: "conic-gradient(from 160deg at 50% 0%, transparent 0deg, rgba(255,241,184,.42) 14deg, rgba(255,241,184,.42) 26deg, transparent 40deg)" }} />
        <div className="absolute bottom-0 left-1/2 h-20 w-[760px] -translate-x-1/2 rounded-[50%] bg-[#fff1b8]/20 blur-xl" />
        <div className="relative flex h-full items-center gap-8 px-10">
          <div className="grid h-[150px] w-[150px] shrink-0 place-items-center rounded-full font-display text-[92px] leading-none" style={{ background: seconds <= 5 ? "#ef4444" : "#ffd54a", color: "#0b1026", boxShadow: "0 0 50px rgba(255,213,74,.7)" }}>
            {seconds}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4">
              <Emblem teamId={team.id} size={70} />
              <div className="font-display text-[76px] leading-none" style={{ color: TEAM_DEFS[team.id].text }}>
                🎤 {team.name}
              </div>
            </div>
            <div className="mt-3 text-[26px] font-extrabold uppercase tracking-widest text-white/60">Their pitch</div>
            <div className="font-display text-[50px] leading-[1.05]">{spot.topics[slot]}</div>
          </div>
          <Bars />
        </div>
      </div>
    );
  }

  if (kind === "spotRate") {
    return (
      <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-5">
        <div className="flex items-center gap-4">
          <span className="font-display text-[50px] text-gold">⭐ MARK {team.name.toUpperCase()}&apos;S PITCH</span>
          <span className="rounded-full bg-black/40 px-4 py-1 font-display text-[40px]">{seconds}s</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {SPOTLIGHT_CRITERIA.map((c) => (
            <div key={c.key} className="rounded-2xl bg-black/35 px-5 py-3">
              <div className="font-display text-[44px] leading-none">{c.label}</div>
              <div className="text-[26px] font-bold text-white/75">{c.hint}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[26px] font-bold text-white/75">1–5 stars on your phone. Marking earns your team 2 steps. Marking fairly (close to the room&apos;s average) earns 3.</div>
        {!data.manualMode && <TeamPips teams={data.teams} progress={progress} label="Marks in" />}
      </div>
    );
  }

  const res = spot.results;
  if (!res) return null;
  const zero = (r: SpeakerResult): SpeakerResult => ({ ...r, hook: 0, clarity: 0, confidence: 0 });
  return (
    <div className="absolute bottom-5 left-5 right-[440px] flex gap-5">
      {[0, 1].map((s) => (
        <Scorecard key={s} teamId={spot.teams[s]} teamName={data.teams[spot.teams[s]].name} res={grown ? res[s] : zero(res[s])} steps={data.teamResults?.[spot.teams[s]].steps ?? 0} />
      ))}
    </div>
  );
}
