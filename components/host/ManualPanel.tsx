"use client";

import { useState } from "react";
import { CARD_INFO } from "@/config/balance";
import { Emblem } from "@/components/shared/Emblem";
import { VoteMap } from "@/components/play/VoteMap";
import type { TeamId } from "@/lib/engine/types";
import type { HostController, HostView } from "@/lib/net/host";

const BANDS = ["0%", "1–49", "50–79", "80+"];

/**
 * Manual Mode (offline backup): the facilitator runs the whole game from the projector laptop.
 * Questions are read aloud and answered by show of hands; this panel records the outcome.
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
    title = kind === "challenge" ? "Hands up! Then score each team when the answer shows" : "How much of each team got it right?";
    body = (
      <div className="grid gap-1.5">
        {data.teams.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <Emblem teamId={t.id} size={34} />
            <span className="w-[108px] truncate text-[20px] font-extrabold">{t.name}</span>
            {BANDS.map((b, i) => (
              <button key={b} onClick={() => ctl.setManualBand(t.id, i)} className="h-11 flex-1 rounded-xl text-[19px] font-extrabold" style={{ background: m.bands[t.id] === i ? t.color : "rgba(255,255,255,.12)", color: m.bands[t.id] === i ? "#0b1026" : "#fff" }}>
                {b}
              </button>
            ))}
            <button onClick={() => ctl.setManualQuickDraw(t.id)} title="Quick Draw: fastest team with 50%+" className="h-11 w-12 rounded-xl text-[20px]" style={{ background: m.quickDraw === t.id ? "#ffd54a" : "rgba(255,255,255,.12)" }}>
              ⚡
            </button>
          </div>
        ))}
        <p className="text-[16px] font-bold text-white/60">Unset teams count as 50–79 (2 MP). ⚡ = Quick Draw (+1 MP).</p>
      </div>
    );
  } else if (kind === "vote") {
    const team = data.teams[sel];
    const reach = data.reach?.[sel] ?? [];
    const dest = m.dests[sel];
    title = "Click each team's destination";
    body = (
      <div>
        <div className="flex gap-1.5">
          {data.teams.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className="relative flex-1 rounded-xl py-1" style={{ background: sel === t.id ? t.color : "rgba(255,255,255,.12)", outline: sel === t.id ? "3px solid #fff" : "none" }}>
              <Emblem teamId={t.id} size={34} className="mx-auto" />
              <span className="block text-[14px] font-extrabold" style={{ color: sel === t.id ? "#0b1026" : "#fff" }}>
                {t.mp ?? 0} MP{m.dests[t.id] ? " ✓" : ""}
              </span>
            </button>
          ))}
        </div>
        {reach.length ? (
          <VoteMap tiles={state.tiles} teams={data.teams} teamId={sel} reach={reach} tally={{}} selected={dest} onSelect={(k) => ctl.setManualDest(sel, k)} className="mx-auto mt-1 h-[330px] w-full" />
        ) : (
          <div className="grid h-[120px] place-items-center text-[24px] font-extrabold text-sky-300">😰 Stage Fright — {team.name} can&apos;t move</div>
        )}
        <div className="mt-1 flex gap-1.5">
          <button onClick={() => ctl.setManualDest(sel, null)} className="h-11 flex-1 rounded-xl text-[18px] font-extrabold" style={{ background: dest ? "rgba(255,255,255,.12)" : "#7c3aed" }}>
            ⚓ Hold
          </button>
          {team.cards.map((c, i) => (
            <button key={`${c}${i}`} onClick={() => ctl.setManualCard(sel, c)} title={CARD_INFO[c].text} className="h-11 flex-1 rounded-xl text-[17px] font-extrabold" style={{ background: m.cards[sel] === c ? "#ffd54a" : "rgba(255,255,255,.12)", color: m.cards[sel] === c ? "#0b1026" : "#fff" }}>
              {CARD_INFO[c].icon} {CARD_INFO[c].name}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (kind === "spotSpeak" || kind === "spotRate" || kind === "spotReady") {
    const spot = data.spot;
    if (!spot) return null;
    title = "Room's star rating for each pitch (applause-o-meter)";
    body = (
      <div className="grid gap-2">
        {[0, 1].map((s) => {
          const t = data.teams[spot.teams[s]];
          return (
            <div key={s} className="flex items-center gap-2">
              <Emblem teamId={t.id} size={36} />
              <span className="w-[120px] truncate text-[20px] font-extrabold">{t.name}</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => ctl.setManualStars(s as 0 | 1, n)} className="h-12 flex-1 rounded-xl text-[30px] leading-none" style={{ background: "rgba(255,255,255,.1)", color: (m.stars[s] ?? 0) >= n ? "#ffd54a" : "rgba(255,255,255,.25)" }}>
                  ★
                </button>
              ))}
            </div>
          );
        })}
        <p className="text-[16px] font-bold text-white/60">4.2+ → 4 MP · 3.5+ → 3 · 2.5+ → 2 · else 1. Unrated counts as 3★. Other teams get 2 MP.</p>
      </div>
    );
  } else if (kind === "finalQ") {
    title = "Which way did each team vote?";
    body = (
      <div className="grid gap-1.5">
        {data.teams.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <Emblem teamId={t.id} size={34} />
            <span className="w-[120px] truncate text-[20px] font-extrabold">{t.name}</span>
            {["✔ TRUE", "✘ FALSE"].map((label, i) => (
              <button key={label} onClick={() => ctl.setManualFinal(t.id, i)} className="h-11 flex-1 rounded-xl text-[20px] font-extrabold" style={{ background: m.finalAnswers[t.id] === i ? (i === 0 ? "#10b981" : "#ef4444") : "rgba(255,255,255,.12)" }}>
                {label}
              </button>
            ))}
          </div>
        ))}
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
