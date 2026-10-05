"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { TEAM_DEFS } from "@/config/teams";
import { Emblem } from "@/components/shared/Emblem";
import type { TeamId } from "@/lib/engine/types";
import type { HostController, HostView } from "@/lib/net/host";

function TeamName({ ctl, teamId, name, color }: { ctl: HostController; teamId: TeamId; name: string; color: string }) {
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  const commit = () => {
    if (value.trim() && value.trim() !== name) ctl.renameTeam(teamId, value);
    else setValue(name);
  };
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value.slice(0, 12))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      maxLength={12}
      aria-label={`Team ${teamId + 1} name`}
      title="Click to rename (type your real group name)"
      className="w-full min-w-0 rounded-lg bg-transparent font-display text-[40px] leading-none outline-none focus:bg-black/40"
      style={{ color }}
    />
  );
}

interface Props {
  ctl: HostController;
  view: HostView;
  volume: number;
  onVolume: (v: number) => void;
  onStart: () => void;
}

/** Projector lobby: title, QR + room code, six team cards filling up, START and facilitator controls. */
export function Lobby({ ctl, view, volume, onVolume, onStart }: Props) {
  const { state } = view;
  const [qr, setQr] = useState("");
  const [origin, setOrigin] = useState("");
  const [confirm, setConfirm] = useState(false);
  const url = origin ? `${origin}/play/${state.roomCode}` : "";

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!url) return;
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: "#0b1026", light: "#ffffff" } })
      .then((d) => live && setQr(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);

  const players = Object.values(state.players);
  const byTeam = state.teams.map((t) => players.filter((p) => p.teamId === t.id));
  const total = players.filter((p) => p.connected).length;
  const empty = byTeam.filter((m) => m.filter((p) => p.connected).length === 0).length;
  const startRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1026]/30 via-transparent to-[#0b1026]/75" />

      <div className="absolute left-12 top-8">
        <div className="title-stroke font-display text-[132px] leading-[0.9] text-gold">SPOTLIGHT ISLES</div>
        <div className="mt-1 text-[34px] font-extrabold text-white/90">15 minutes · 6 airship crews · one archipelago of presentation skills</div>
      </div>

      {/* Join card */}
      <div className="glossy absolute left-12 top-[250px] w-[520px] rounded-[36px] p-6 text-center">
        <div className="font-display text-[40px] leading-none">📱 SCAN TO JOIN</div>
        <div className="mx-auto mt-3 grid h-[400px] w-[400px] place-items-center rounded-3xl bg-white p-3">{qr ? <img src={qr} alt={`QR code for ${url}`} className="h-full w-full" /> : null}</div>
        <div className="mt-3 text-[26px] font-extrabold text-white/70">or go to</div>
        <div className="break-all text-[30px] font-extrabold leading-tight">{origin.replace(/^https?:\/\//, "")}</div>
        <div className="mt-1 text-[26px] font-extrabold text-white/70">and enter code</div>
        <div className="font-display text-[120px] leading-none tracking-[0.18em] text-gold">{state.roomCode}</div>
      </div>

      {/* Team cards */}
      <div className="absolute left-[610px] right-12 top-[250px] grid grid-cols-3 gap-5">
        {state.teams.map((t) => (
          <div key={t.id} className="glossy h-[270px] overflow-hidden rounded-3xl p-4" style={{ borderColor: t.color, boxShadow: `inset 0 1px 0 rgba(255,255,255,.2), 0 0 34px ${t.color}55` }}>
            <div className="flex items-center gap-3">
              <Emblem teamId={t.id} size={60} />
              <TeamName ctl={ctl} teamId={t.id} name={t.name} color={TEAM_DEFS[t.id].text} />
              <span className="rounded-full bg-black/40 px-3 font-display text-[32px]">{byTeam[t.id].filter((p) => p.connected).length}</span>
            </div>
            <div className="mt-3 flex flex-wrap content-start gap-2">
              {byTeam[t.id].slice(0, 14).map((p) => (
                <button
                  key={p.id}
                  onClick={() => ctl.kick(p.id)}
                  title="Click to remove this player"
                  className="pop rounded-full px-3 py-0.5 text-[24px] font-extrabold hover:line-through"
                  style={{ background: t.color, color: "#0b1026", opacity: p.connected ? 1 : 0.4 }}
                >
                  {p.name}
                </button>
              ))}
              {byTeam[t.id].length > 14 && <span className="text-[24px] font-extrabold text-white/70">+{byTeam[t.id].length - 14}</span>}
              {byTeam[t.id].length === 0 && <span className="pulse-soft text-[26px] font-bold text-white/45">Waiting for crew…</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Start bar */}
      <div className="absolute bottom-10 left-[610px] right-12">
        <div className="glossy flex items-center gap-6 rounded-3xl px-7 py-4">
          <div>
            <div className="font-display text-[72px] leading-none text-gold">{total}</div>
            <div className="text-[24px] font-extrabold text-white/70">{total === 1 ? "player" : "players"} ready</div>
          </div>
          <div className="flex-1 text-[24px] font-bold leading-snug text-white/80">
            {empty > 0 && !state.manualMode ? (
              <span className="text-amber-300">⚠ {empty} team{empty > 1 ? "s have" : " has"} no players yet. An empty team can&apos;t move. You can still start.</span>
            ) : state.manualMode ? (
              <span className="text-amber-300">Manual Mode: no phones needed. You score each round from this screen.</span>
            ) : (
              "The 15:00 clock starts when you press START."
            )}
          </div>
          {confirm ? (
            <div className="flex gap-3">
              <button className="btn bg-white/15 px-6 text-[30px] text-white" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="btn bg-emerald-400 px-8 font-display text-[44px] text-ink" onClick={onStart}>
                GO! Start 15:00
              </button>
            </div>
          ) : (
            <button ref={startRef} className="btn bg-gold px-14 font-display text-[64px] leading-none text-ink" style={{ minHeight: 110 }} onClick={() => (empty > 0 && !state.manualMode ? setConfirm(true) : onStart())}>
              START
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-5 text-[22px] font-extrabold text-white/80">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-6 w-6" checked={state.manualMode} onChange={(e) => ctl.setManualMode(e.target.checked)} />
            Manual Mode (offline backup)
          </label>
          <label className="flex items-center gap-2">
            🔊
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} className="w-40" aria-label="Volume" />
          </label>
          <button className="underline" onClick={() => ctl.newRoom()}>
            New room code
          </button>
          <a className="underline" href="/guide" target="_blank" rel="noreferrer">
            Facilitator guide
          </a>
          <a className="underline" href={`/dev/bots?code=${state.roomCode}&count=30`} target="_blank" rel="noreferrer">
            Add bots
          </a>
          {ctl.rehearsalSpeed > 1 && <span className="rounded-lg bg-fuchsia-500 px-2 text-ink">REHEARSAL ×{ctl.rehearsalSpeed}</span>}
        </div>
      </div>

      <div className="absolute bottom-3 left-12 w-[520px] text-[19px] font-bold leading-snug text-white/65">
        ⚠ Keep this tab visible during the game. Browsers slow down background tabs.
        {view.mode === "local" && <div className="mt-1 text-amber-300">LOCAL MODE: no Supabase keys set, so only tabs in this browser can join. See the README to connect phones.</div>}
        {view.mode === "supabase" && view.status !== "connected" && <div className="mt-1 text-amber-300">Realtime: {view.status}…</div>}
      </div>
    </div>
  );
}
