"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RUBRIC } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { AudioEngine } from "@/game/audio/sfx";
import type { RenderEvent } from "@/game/render/MapRenderer";
import { HostController, type HostView } from "@/lib/net/host";
import { AccuracyStrip, Clock, Intro, PhaseBanner, QuestionPanel, ResolvePanel, Scoreboard, Slam, useClock, VotePanel, type SlamMsg } from "./Hud";
import { Lobby } from "./Lobby";
import { ManualPanel } from "./ManualPanel";
import { MapCanvas } from "./MapCanvas";
import { Debrief, Results } from "./Results";
import { SpotlightStage } from "./SpotlightStage";

const W = 1920;
const H = 1080;

export default function HostApp() {
  const [ctl, setCtl] = useState<HostController | null>(null);
  const [lowFx, setLowFx] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setLowFx(sp.get("fx") === "low");
    const c = new HostController({ speed: Number(sp.get("speed")) || 1, fresh: sp.has("fresh"), noStore: sp.has("nostore") });
    c.connect();
    setCtl(c);
    return () => c.disconnect();
  }, []);
  if (!ctl) return <div className="grid h-dvh place-items-center font-display text-4xl text-gold">Loading Spotlight Isles…</div>;
  return <Host ctl={ctl} lowFx={lowFx} />;
}

function useStageScale(): number {
  const [k, setK] = useState(1);
  useEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return k;
}

function Host({ ctl, lowFx }: { ctl: HostController; lowFx: boolean }) {
  const view = useSyncExternalStore(ctl.subscribe, ctl.getView, ctl.getView);
  const k = useStageScale();
  const audio = useRef<AudioEngine | null>(null);
  if (!audio.current) audio.current = new AudioEngine();
  const [volume, setVolume] = useState(0.7);
  const [soundOn, setSoundOn] = useState(false);
  const [slam, setSlam] = useState<SlamMsg | null>(null);
  const [hiddenWarn, setHiddenWarn] = useState(false);
  const slamId = useRef(0);
  const showSlam = useCallback((text: string, sub?: string, color?: string) => setSlam({ id: ++slamId.current, text, sub, color }), []);

  const kind = view.over ? "over" : (view.phase?.kind ?? "lobby");
  const started = view.state.startedAt !== null;

  /* ---- sound: unlocked by the first click (browsers block autoplay) ---- */
  const unlock = useCallback(() => {
    const a = audio.current!;
    a.unlock();
    a.setVolume(volume);
    setSoundOn(a.ready);
  }, [volume]);
  useEffect(() => {
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [unlock]);
  useEffect(() => () => audio.current?.dispose(), []);

  /* ---- keep the screen awake and warn about background tabs ---- */
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        /* not supported or denied */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void request();
      } else if (started && !view.over) {
        setHiddenWarn(true);
      }
    };
    void request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [started, view.over]);
  useEffect(() => {
    if (!hiddenWarn) return;
    const id = setTimeout(() => setHiddenWarn(false), 9000);
    return () => clearTimeout(id);
  }, [hiddenWarn]);

  /* ---- "pop" when a player joins the lobby ---- */
  const playerCount = Object.keys(view.state.players).length;
  const lastCount = useRef(playerCount);
  useEffect(() => {
    if (playerCount > lastCount.current && !started) audio.current?.play("pop");
    lastCount.current = playerCount;
  }, [playerCount, started]);

  /* ---- phase changes: banners, stings and music ---- */
  useEffect(() => {
    const a = audio.current!;
    const data = view.publicData;
    if (started && !view.over) a.startMusic();
    a.duck(kind === "spotSpeak");
    switch (kind) {
      case "intro":
        a.play("whoosh");
        break;
      case "challenge":
        a.play("banner");
        showSlam(`ROUND ${view.phase?.round}`, data.criterion ? `${RUBRIC[data.criterion].icon} ${RUBRIC[data.criterion].label}` : undefined);
        break;
      case "reveal":
      case "finalReveal":
      case "spotReveal":
        a.play("reveal");
        break;
      case "resolve":
        a.play("whoosh");
        break;
      case "spotReady":
        a.play("banner");
        showSlam("SPOTLIGHT!", `Round ${view.phase?.round}`, "#fff1b8");
        break;
      case "spotSpeak":
        a.play("pop");
        break;
      case "finalBanner":
        a.play("boom");
        showSlam("FINAL SHOWDOWN", "The Keynote Stage awaits", "#c4b5fd");
        break;
      case "results":
        a.play("fanfare");
        break;
      case "over":
        a.stopMusic();
        a.play("gameover");
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.phaseVersion]);

  // Ticking clock while teams decide.
  useEffect(() => {
    if (kind !== "vote") return;
    let n = 0;
    const id = setInterval(() => audio.current?.play(n++ % 2 ? "tock" : "tick"), 500);
    return () => clearInterval(id);
  }, [kind, view.phaseVersion]);

  const onRenderEvent = useCallback(
    (e: RenderEvent, teamId?: number) => {
      const a = audio.current;
      if (e === "step") a?.play("step");
      else if (e === "paint") a?.play("splat");
      else if (e === "clash") {
        a?.play("clash");
        showSlam("CLASH!", undefined, "#ff5a5a");
      } else if (e === "chest") a?.play("chest");
      else if (e === "card") a?.play("card");
      else if (e === "micdrop") a?.play("boom");
      else if (e === "flood") a?.play("whoosh");
      else if (e === "firework") a?.play("firework");
      else if (e === "stage") {
        a?.play("boom");
        a?.play("fanfare");
        if (teamId !== undefined) showSlam(TEAM_DEFS[teamId].emblem, `${ctl.state.teams[teamId].name.toUpperCase()} TAKES THE STAGE! +100`, TEAM_DEFS[teamId].text);
      }
    },
    [ctl, showSlam],
  );

  const onVolume = (v: number) => {
    setVolume(v);
    audio.current?.setVolume(v);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <MapCanvas ctl={ctl} view={view} onEvent={onRenderEvent} lowFx={lowFx} />
      <div className="absolute left-1/2 top-1/2" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${k})` }}>
        {!started ? (
          <Lobby
            ctl={ctl}
            view={view}
            volume={volume}
            onVolume={onVolume}
            onStart={() => {
              unlock();
              ctl.start();
            }}
          />
        ) : (
          <GameHud ctl={ctl} view={view} kind={kind} audio={audio.current} />
        )}
        <Slam key={slam?.id ?? 0} msg={slam} />
        {started && hiddenWarn && (
          <div className="absolute bottom-2 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-amber-400 px-5 py-1 text-[24px] font-extrabold text-ink">⚠ Keep this tab visible. Browsers slow down background tabs.</div>
        )}
        {started && !soundOn && !view.over && (
          <button className="absolute bottom-2 left-3 z-50 rounded-xl bg-black/60 px-4 py-1 text-[22px] font-extrabold" onClick={unlock}>
            🔇 Click anywhere to enable sound
          </button>
        )}
        {view.over && (
          <button className="absolute bottom-3 right-4 z-50 rounded-xl bg-white/15 px-4 py-1 text-[22px] font-extrabold" onClick={() => ctl.newRoom()}>
            New game
          </button>
        )}
      </div>
    </div>
  );
}

function GameHud({ ctl, view, kind, audio }: { ctl: HostController; view: HostView; kind: string; audio: AudioEngine }) {
  const { frac, phaseMs } = useClock(ctl);
  const data = view.publicData;
  const speed = view.state.speed || 1;
  const seconds = Math.max(0, Math.ceil((phaseMs * speed) / 1000));
  const collecting = kind === "challenge" || kind === "finalQ" || kind === "vote" || kind === "spotRate";
  const progress = ctl.inputProgress();
  const full = kind === "results" || kind === "debrief" || kind === "over";

  return (
    <>
      {!full && <PhaseBanner view={view} />}
      {!full && kind !== "intro" && <Scoreboard view={view} progress={collecting && !data.manualMode ? progress : null} />}

      {kind === "intro" && <Intro frac={frac} />}
      {(kind === "challenge" || kind === "finalQ") && <QuestionPanel data={data} progress={progress} reveal={false} />}
      {(kind === "reveal" || kind === "finalReveal") && <QuestionPanel data={data} progress={progress} reveal />}
      {kind === "reveal" && <AccuracyStrip data={data} />}
      {kind === "finalReveal" && data.final && (
        <div className="absolute bottom-[352px] left-5 right-[440px] flex gap-3">
          {data.teams.map((t) => {
            const q = data.final!.perQ[data.final!.perQ.length - 1];
            const passed = q?.passed[t.id];
            const n = data.final!.bottom3.includes(t.id) ? 3 : 2;
            return (
              <div key={t.id} className="glossy flex-1 rounded-2xl px-3 py-2 text-center" style={{ borderColor: passed ? t.color : undefined, opacity: passed ? 1 : 0.55 }}>
                <div className="truncate font-display text-[28px]" style={{ color: TEAM_DEFS[t.id].text }}>
                  {t.name}
                </div>
                <div className="font-display text-[30px]">{passed ? `+${n} tiles 🌊` : "—"}</div>
              </div>
            );
          })}
        </div>
      )}
      {kind === "vote" && <VotePanel data={data} progress={progress} />}
      {kind === "resolve" && <ResolvePanel data={data} />}
      {kind.startsWith("spot") && <SpotlightStage view={view} data={data} frac={frac} seconds={seconds} progress={progress} onReelTick={() => audio.play("reel")} />}
      {kind === "finalBanner" && (
        <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-4 text-[34px] font-extrabold">
          🌙 3 rapid-fire true/false questions. Each one your team gets right floods <span className="text-gold">2 more tiles</span> — <span className="text-gold">3</span> if you&apos;re in the bottom three. Most correct takes the <span className="text-gold">Keynote Stage (+100)</span>.
        </div>
      )}
      {kind === "finalFlood" && (
        <div className="glossy absolute bottom-5 left-5 right-[440px] rounded-3xl px-8 py-4 text-center font-display text-[48px]">
          {frac < 0.6 ? "🌊 Territory floods out…" : data.final?.stageWinner != null ? <span style={{ color: TEAM_DEFS[data.final.stageWinner].text }}>🎤 {data.teams[data.final.stageWinner].name.toUpperCase()} CAPTURES THE KEYNOTE STAGE!</span> : "The Keynote Stage stays unclaimed!"}
        </div>
      )}

      {kind === "results" && data.results && <Results data={data} results={data.results} frac={frac} />}
      {(kind === "debrief" || kind === "over") && (view.state.debrief ? <Debrief debrief={view.state.debrief} over={kind === "over"} /> : null)}

      <Clock ctl={ctl} view={view} />
      {view.state.manualMode && <ManualPanel ctl={ctl} view={view} />}
    </>
  );
}
