"use client";

import { useEffect, useRef, useState } from "react";
import type { MapRenderer, RenderEvent } from "@/game/render/MapRenderer";
import type { TimeOfDay } from "@/game/render/Sky";
import type { HostController, HostView } from "@/lib/net/host";

type Kind = string;
export const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

/** Dawn (lobby + intro) → day (rounds 1–3) → sunset (rounds 4–6) → night (results onward). */
export function timeOfDay(kind: Kind, round: number): TimeOfDay {
  if (kind === "lobby" || kind === "intro") return "dawn";
  if (kind === "results" || kind === "debrief" || kind === "over") return "night";
  return round >= 4 ? "sunset" : "day";
}

function insetsFor(kind: Kind) {
  if (kind === "lobby" || kind === "results" || kind === "debrief" || kind === "over") return { left: 0, right: 0, top: 0, bottom: 0 };
  if (kind === "intro") return { left: 0, right: 0, top: 60, bottom: 0 };
  const moving = kind === "vote" || kind === "resolve";
  const bottom = moving ? 190 : kind === "reveal" ? 500 : kind === "spotReady" ? 470 : kind.startsWith("spot") ? 400 : 390;
  // During the vote and the moves the legend sits on the left, so the map shifts right to clear it.
  return { left: moving ? 330 : 20, right: 440, top: 130, bottom };
}

interface Props {
  ctl: HostController;
  view: HostView;
  onEvent: (e: RenderEvent, teamId?: number) => void;
  lowFx: boolean;
}

/** CSS sky behind a full-window Pixi canvas, driven by the host's phase changes. */
export function MapCanvas({ ctl, view, onEvent, lowFx }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const kind: Kind = view.over ? "over" : (view.phase?.kind ?? "lobby");
  const round = view.phase?.round ?? 0;
  const tod = timeOfDay(kind, round);

  useEffect(() => {
    let dead = false;
    let made: MapRenderer | null = null;
    (async () => {
      try {
        await document.fonts?.ready;
        const mod = await import("@/game/render/MapRenderer");
        const font = getComputedStyle(document.documentElement).getPropertyValue("--font-lilita").trim() || "sans-serif";
        const r = await mod.MapRenderer.create(hostRef.current!, { lowFx, font, onEvent: (e, t) => eventRef.current(e, t) });
        if (dead) {
          r.destroy();
          return;
        }
        made = r;
        rendererRef.current = r;
        setReady(true);
      } catch (err) {
        console.error("Map renderer failed to start", err);
        setFailed(true);
      }
    })();
    return () => {
      dead = true;
      made?.destroy();
      rendererRef.current = null;
    };
  }, [lowFx]);

  // Phase changes drive the scene.
  const first = useRef(true);
  useEffect(() => {
    const r = rendererRef.current;
    if (!ready || !r) return;
    const { state, publicData: pd } = view;
    r.setTimeOfDay(tod, first.current);
    first.current = false;
    r.setInsets(insetsFor(kind));
    r.setMode(kind === "lobby" || kind === "results" || kind === "debrief" || kind === "over" ? "lobby" : kind === "intro" ? "intro" : "play");
    r.setHomes(pd.teams);

    const rem = ctl.remaining();
    const fresh = rem.phaseDurationMs > 0 && rem.phaseMs > rem.phaseDurationMs * 0.6;
    if (kind === "resolve" && pd.moves && r.hasMap && fresh) {
      r.playResolution(pd.moves, state.tiles, pd.teams, rem.phaseMs);
    } else {
      r.syncTiles(state.tiles, !r.hasMap || !fresh);
      r.syncTeams(pd.teams, !r.hasMap || !fresh);
    }

    // Once the round's result is known, each ship shows its place in the move order and its steps.
    const show = kind === "reveal" || kind === "spotReveal" || kind === "vote";
    r.setBadges(show ? pd.teams.map((t) => (t.docked !== null || t.order === null || t.steps === null ? null : `${ORDINAL[t.order]} · ${t.steps}`)) : null);
    if (kind !== "vote") r.setVoteProgress(null);
    if (kind === "results" && pd.results?.ranking[0]) r.celebrate(pd.results.ranking[0].teamId, Math.min(30, rem.phaseMs / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view.phaseVersion, view.state.roomCode]);

  // "Votes in" rings.
  useEffect(() => {
    const r = rendererRef.current;
    if (!ready || !r || kind !== "vote") return;
    if (view.state.manualMode) r.setVoteProgress(view.state.manual.dests.map((d) => (d ? 1 : 0)));
    else r.setVoteProgress(ctl.inputProgress().map((p) => (p.total ? p.done / p.total : 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view.version, kind]);

  return (
    <>
      {(["dawn", "day", "sunset", "night"] as TimeOfDay[]).map((t) => (
        <div key={t} className={`sky sky-${t}`} style={{ opacity: tod === t ? 1 : 0 }} />
      ))}
      <div className="sky stars" style={{ opacity: tod === "night" ? 1 : tod === "dawn" ? 0.35 : 0 }} />
      <div ref={hostRef} className="absolute inset-0" />
      {failed && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/60 p-6 text-center text-xl font-bold">
          The 3D map couldn&apos;t start (WebGL unavailable). The game still runs — use the scoreboard and prompts.
        </div>
      )}
    </>
  );
}
