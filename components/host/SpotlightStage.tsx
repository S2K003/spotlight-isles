"use client";

import { useEffect, useState } from "react";
import { SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { Emblem } from "@/components/shared/Emblem";
import type { PublicData, SpeakerResult } from "@/lib/engine/types";
import type { HostView } from "@/lib/net/host";
import { TeamPips } from "./Hud";

/** Slot-machine reel that spins through a team's names and lands on the chosen speaker. */
function Reel({ names, final, locked, onTick }: { names: string[]; final: string; locked: boolean; onTick: () => void }) {
  const [shown, setShown] = useState(names[0] ?? "…");
  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      setShown(names.length ? names[Math.floor(Math.random() * names.length)] : "…");
      onTick();
    }, 85);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, names.join("|")]);
  return (
    <div className="overflow-hidden rounded-2xl bg-black/45 px-5 py-2 text-center font-display text-[64px] leading-tight" style={{ color: locked ? "#ffd54a" : "#fff", textShadow: locked ? "0 0 30px rgba(255,213,74,.8)" : "none" }}>
      <span key={locked ? "final" : shown} className={locked ? "pop inline-block" : "inline-block"}>
        {locked ? final : shown}
      </span>
    </div>
  );
}

function Bars() {
  return (
    <div className="flex h-24 items-end gap-1.5" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => (
        <div key={i} className="eq-bar w-3 rounded-t bg-gold" style={{ height: `${40 + ((i * 37) % 60)}%`, animationDelay: `${-(i * 0.137) % 0.9}s`, animationDuration: `${0.5 + ((i * 13) % 7) / 10}s` }} />
      ))}
    </div>
  );
}

function Scorecard({ name, teamId, teamName, res, mp }: { name: string; teamId: number; teamName: string; res: SpeakerResult; mp: number }) {
  return (
    <div className="glossy flex-1 rounded-3xl px-6 py-4">
      <div className="flex items-center gap-3">
        <Emblem teamId={teamId} size={56} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[44px] leading-none">{name}</div>
          <div className="text-[24px] font-bold text-white/70">{teamName}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-[60px] leading-none text-gold">{res.overall === null ? "—" : res.overall.toFixed(1)}★</div>
          <div className="pop rounded-lg bg-gold px-2 text-center font-display text-[26px] text-ink">{mp} MP</div>
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
      {res.trimmed && <div className="mt-1 text-[20px] font-bold text-white/55">Highest and lowest team averages dropped for fairness</div>}
    </div>
  );
}

interface Props {
  view: HostView;
  data: PublicData;
  frac: number;
  seconds: number;
  progress: { done: number; total: number }[];
  onReelTick: () => void;
}

/** The stage view that replaces the bottom area during Spotlight rounds. */
export function SpotlightStage({ view, data, frac, seconds, progress, onReelTick }: Props) {
  const spot = data.spot;
  const kind = view.phase?.kind;
  // Bars animate from 0 on the scorecard: flip a flag just after mount.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    setGrown(false);
    const id = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(id);
  }, [view.phase?.id]);
  if (!spot || !kind) return null;

  const slot = spot.slot;
  const speaker = spot.speakers[slot];
  const team = data.teams[spot.teams[slot]];

  if (kind === "spotReady") {
    const locked = frac > 0.6;
    return (
      <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-5">
        <div className="text-center font-display text-[46px] text-gold">🎰 WHO STEPS INTO THE SPOTLIGHT?</div>
        <div className="mt-3 grid grid-cols-2 gap-6">
          {[0, 1].map((s) => {
            const t = data.teams[spot.teams[s]];
            const names = Object.values(view.state.players)
              .filter((p) => p.teamId === t.id && p.connected)
              .map((p) => p.name);
            return (
              <div key={s}>
                <div className="mb-2 flex items-center justify-center gap-3 text-[32px] font-extrabold">
                  <Emblem teamId={t.id} size={44} />
                  <span style={{ color: TEAM_DEFS[t.id].text }}>{t.name}</span>
                  <span className="text-white/60">speaks {s === 0 ? "1st" : "2nd"}</span>
                </div>
                <Reel names={names} final={spot.speakers[s].name} locked={locked} onTick={onReelTick} />
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-center text-[28px] font-bold text-white/75">20 seconds each, out loud. Everyone else marks: Hook · Clarity · Confidence</div>
      </div>
    );
  }

  if (kind === "spotSpeak") {
    return (
      <div className="absolute bottom-5 left-5 right-[440px] h-[380px] overflow-hidden rounded-3xl border border-white/20 bg-[#070a1c]/92 shadow-2xl">
        {/* Stage spotlight */}
        <div className="spot-beam absolute left-1/2 top-[-40px] h-[520px] w-[620px] -translate-x-1/2" style={{ background: "conic-gradient(from 160deg at 50% 0%, transparent 0deg, rgba(255,241,184,.42) 14deg, rgba(255,241,184,.42) 26deg, transparent 40deg)" }} />
        <div className="absolute bottom-0 left-1/2 h-20 w-[760px] -translate-x-1/2 rounded-[50%] bg-[#fff1b8]/20 blur-xl" />
        <div className="relative flex h-full items-center gap-8 px-10">
          <div className="grid h-[150px] w-[150px] shrink-0 place-items-center rounded-full font-display text-[92px] leading-none" style={{ background: seconds <= 5 ? "#ef4444" : "#ffd54a", color: "#0b1026", boxShadow: "0 0 50px rgba(255,213,74,.7)" }}>
            {seconds}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4">
              <Emblem teamId={team.id} size={64} />
              <div className="font-display text-[72px] leading-none">🎤 {speaker.name}</div>
              <div className="rounded-xl px-3 py-1 font-display text-[30px] text-ink" style={{ background: team.color }}>
                {team.name}
              </div>
            </div>
            <div className="mt-3 text-[26px] font-extrabold uppercase tracking-widest text-white/60">Topic</div>
            <div className="font-display text-[50px] leading-[1.05]">{spot.topic}</div>
            <div className="mt-2 inline-block rounded-2xl bg-gold px-4 py-1 text-[32px] font-extrabold text-ink">Twist: {spot.twist}</div>
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
          <span className="font-display text-[52px] text-gold">⭐ MARK {speaker.name.toUpperCase()}&apos;S PITCH</span>
          <span className="rounded-full bg-black/40 px-4 py-1 font-display text-[40px]">{seconds}s</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {SPOTLIGHT_CRITERIA.map((c) => (
            <div key={c.key} className="rounded-2xl bg-black/35 px-5 py-3">
              <div className="font-display text-[44px] leading-none">{c.label}</div>
              <div className="text-[26px] font-bold text-white/75">{c.hint}</div>
              <div className="text-[22px] font-extrabold text-gold">Criterion: {c.maps}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[26px] font-bold text-white/70">1–5 stars on your phone. Mark fairly: teams close to the room average earn the ⚖️ Fair Judge bonus. {team.name} can&apos;t rate their own speaker.</div>
        {!data.manualMode && <TeamPips teams={data.teams} progress={progress} label="Ratings in" />}
      </div>
    );
  }

  // spotReveal
  const res = spot.results;
  if (!res) return null;
  const zero: SpeakerResult = { hook: 0, clarity: 0, confidence: 0, overall: res[0].overall, teamAverages: {}, raterTeams: 0, trimmed: false };
  return (
    <div className="absolute bottom-5 left-5 right-[440px] flex gap-5">
      {[0, 1].map((s) => (
        <Scorecard
          key={s}
          name={spot.speakers[s].name}
          teamId={spot.teams[s]}
          teamName={data.teams[spot.teams[s]].name}
          res={grown ? res[s] : { ...zero, overall: res[s].overall, trimmed: res[s].trimmed }}
          mp={data.teamResults?.[spot.teams[s]].mp ?? 0}
        />
      ))}
    </div>
  );
}
