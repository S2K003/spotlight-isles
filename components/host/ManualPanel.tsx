"use client";

import { useState } from "react";
import { Emblem } from "@/components/shared/Emblem";
import { VoteMap } from "@/components/play/VoteMap";
import type { TeamId } from "@/lib/engine/types";
import type { HostController, HostView } from "@/lib/net/host";


/**
 * Manual Mode (offline backup): the facilitator runs the whole game from the projector laptop.
 * Questions are answered by show of hands; this panel records the outcome.
 */
export function ManualPanel({ ctl, view }: { ctl: HostController; view: HostView }) {
  const [sel, setSel] = useState<TeamId>(0);
  const kind = view.phase?.kind;
  const { state, publicData: data } = view;
  const m = state.manual;
  if (!kind) return null;

  let body: React.ReactNode = null;
  let title = "";

  if (kind === "challenge" || kind === "reveal") {
    title = kind === "challenge" ? "Hands up! Score each team once the answer shows" : "How much of each team got it right?";
    body = (
      <div className="grid gap-1.5">
        {data.teams.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <Emblem teamId={t.id} size={34} />
            <span className="w-[100px] truncate text-[20px] font-extrabold">{t.name}</span>
            {([true, false] as const).map((ok) => (
              <button key={String(ok)} onClick={() => ctl.setManualPass(t.id, ok)} className="h-11 flex-1 rounded-xl text-[18px] font-extrabold" style={{ background: m.pass[t.id] === ok ? (ok ? "#10b981" : "#ef4444") : "rgba(255,255,255,.12)" }}>
                {ok ? "✔ Half or more got it" : "✘ Fewer than half"}
              </button>
            ))}
          </div>
        ))}
        <p className="text-[16px] font-bold text-white/60">Got it → 3 steps · otherwise 2. Unset groups count as &ldquo;got it&rdquo;.</p>
      </div>
    );
  } else if (kind === "vote") {
    const team = data.teams[sel];
    const reach = data.reach?.[sel] ?? [];
    const dest = m.dests[sel];
    title = "Optional: ships fly the best route by themselves";
    body = (
      <div>
        <div className="flex gap-1.5">
          {(data.order ?? data.teams.map((t) => t.id)).map((id) => {
            const t = data.teams[id];
            return (
              <button key={id} onClick={() => setSel(id)} className="relative flex-1 rounded-xl py-1" style={{ background: sel === id ? t.color : "rgba(255,255,255,.12)", outline: sel === id ? "3px solid #fff" : "none" }}>
                <Emblem teamId={id} size={34} className="mx-auto" />
                <span className="block text-[14px] font-extrabold" style={{ color: sel === id ? "#0b1026" : "#fff" }}>
                  {t.docked !== null ? "🎤" : `${t.steps ?? 0}`}
                  {m.dests[id] ? " ✎" : ""}
                </span>
              </button>
            );
          })}
        </div>
        {reach.length ? (
          <VoteMap tiles={state.tiles} teams={data.teams} teamId={sel} reach={reach} tally={{}} selected={dest && dest !== "hold" ? dest : null} suggested={data.suggest?.[sel]} onSelect={(k) => ctl.setManualDest(sel, k)} radius={8} className="mx-auto mt-1 h-[340px] w-full" />
        ) : (
          <div className="grid h-[120px] place-items-center text-[24px] font-extrabold text-gold">{team.docked !== null ? `🎤 ${team.name} is at the Stage` : `${team.name} can't move`}</div>
        )}
        <div className="mt-1 flex gap-1.5">
          <button onClick={() => ctl.setManualDest(sel, null)} className="h-11 flex-1 rounded-xl text-[18px] font-extrabold" style={{ background: dest === null ? "#10b981" : "rgba(255,255,255,.12)" }}>
            ✈ Best route (default)
          </button>
          <button onClick={() => ctl.setManualDest(sel, "hold")} className="h-11 flex-1 rounded-xl text-[18px] font-extrabold" style={{ background: dest === "hold" ? "#7c3aed" : "rgba(255,255,255,.12)" }}>
            ⚓ Stay
          </button>
        </div>
        <p className="mt-1 text-[15px] font-bold text-white/60">You only need to click if a group wants a different hex. Groups are listed in move order.</p>
      </div>
    );
  } else if (kind === "spotSpeak" || kind === "spotRate" || kind === "spotReady") {
    const spot = data.spot;
    if (!spot) return null;
    title = "The room's star rating for each pitch";
    body = (
      <div className="grid gap-2">
        {[0, 1].map((s) => {
          const t = data.teams[spot.teams[s]];
          return (
            <div key={s} className="flex items-center gap-2">
              <Emblem teamId={t.id} size={36} />
              <span className="w-[110px] truncate text-[20px] font-extrabold">{t.name}</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => ctl.setManualStars(s as 0 | 1, n)} className="h-12 flex-1 rounded-xl text-[30px] leading-none" style={{ background: "rgba(255,255,255,.1)", color: (m.stars[s] ?? 0) >= n ? "#ffd54a" : "rgba(255,255,255,.25)" }}>
                  ★
                </button>
              ))}
            </div>
          );
        })}
        <p className="text-[16px] font-bold text-white/60">4–5★ → 4 steps · 3★ → 3 · 1–2★ → 2. Unrated counts as 3★. The other groups move 2 steps.</p>
      </div>
    );
  } else {
    return null;
  }

  return (
    <div className="glossy absolute left-5 top-[150px] z-30 w-[560px] rounded-3xl p-4" style={{ borderColor: "#f59e0b" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-lg bg-amber-500 px-2 py-0.5 text-[16px] font-extrabold text-ink">MANUAL MODE</span>
        <span className="text-[19px] font-extrabold leading-tight">{title}</span>
      </div>
      {body}
    </div>
  );
}
