"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { TEAM_DEFS } from "@/config/teams";
import { TIPS } from "@/content/spotlight";
import { Airship, Emblem } from "@/components/shared/Emblem";
import type { TeamId } from "@/lib/engine/types";
import type { LobbyMsg } from "@/lib/net/messages";

/** Step 1: nickname. Step 2: pick a team from six big glossy cards with live member counts. */
export function Join({ lobby, initialName, onJoin }: { lobby: LobbyMsg; initialName: string; onJoin: (name: string, teamId: TeamId) => void }) {
  const [name, setName] = useState(initialName);
  const [step, setStep] = useState<"name" | "team">(initialName ? "team" : "name");
  const clean = name.trim().slice(0, 12);

  if (step === "name") {
    return (
      <form
        className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean) setStep("team");
        }}
      >
        <h1 className="title-stroke text-center font-display text-5xl text-gold">SPOTLIGHT ISLES</h1>
        <p className="mt-2 text-center font-bold text-white/70">Room {lobby.roomCode}</p>
        <label htmlFor="nick" className="mt-8 block text-center text-sm font-extrabold uppercase tracking-widest text-white/70">
          Your nickname
        </label>
        <input
          id="nick"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 12))}
          maxLength={12}
          autoComplete="off"
          placeholder="e.g. Sam"
          className="mt-2 w-full rounded-2xl border-2 border-white/25 bg-black/30 px-4 py-4 text-center text-3xl font-extrabold text-white outline-none placeholder:text-white/25 focus:border-gold"
        />
        <button type="submit" disabled={!clean} className="btn mt-4 bg-gold text-2xl text-ink">
          NEXT
        </button>
        <p className="mt-6 text-center text-xs text-white/50">Only your nickname is collected. Nothing is stored after the session.</p>
      </form>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-6 pt-5">
      <button className="text-sm font-bold text-white/60 underline" onClick={() => setStep("name")}>
        ← {clean}
      </button>
      <h2 className="mt-1 text-center font-display text-3xl">Pick your team</h2>
      <p className="mb-3 text-center text-sm font-bold text-white/65">Choose your project group</p>
      <div className="grid grid-cols-2 gap-3">
        {lobby.teams.map((t) => (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.94 }}
            onClick={() => onJoin(clean, t.id)}
            className="glossy relative flex min-h-[132px] flex-col items-center justify-center rounded-3xl p-3"
            style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), 0 0 26px ${t.color}66`, borderColor: t.color }}
          >
            <Emblem teamId={t.id} size={54} />
            <span className="mt-1 font-display text-2xl leading-none" style={{ color: TEAM_DEFS[t.id].text }}>
              {t.name}
            </span>
            <span className="mt-1 rounded-full bg-black/35 px-2.5 py-0.5 text-xs font-extrabold text-white/85">
              {t.players.length} {t.players.length === 1 ? "player" : "players"}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/** Waiting room: the team's airship bobs on clouds while teammates arrive. */
export function Waiting({ lobby, teamId, myId, onSwitch }: { lobby: LobbyMsg; teamId: TeamId; myId: string; onSwitch: () => void }) {
  const team = lobby.teams[teamId];
  const def = TEAM_DEFS[teamId];
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center overflow-hidden px-5 pb-6 pt-8">
      <motion.h2 initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="text-center font-display text-3xl leading-tight">
        You&apos;re on TEAM <span style={{ color: def.text }}>{team.name.toUpperCase()}</span>! {def.emoji}
      </motion.h2>

      <div className="relative mt-4 h-44 w-full">
        <div className="cloud-drift absolute bottom-0 left-4 h-14 w-44 rounded-full bg-white/25 blur-md" />
        <div className="cloud-drift absolute bottom-3 right-2 h-12 w-40 rounded-full bg-white/20 blur-md" style={{ animationDelay: "-6s" }} />
        <div className="bob absolute inset-x-0 top-0 flex justify-center">
          <Airship teamId={teamId} size={170} />
        </div>
      </div>

      <div className="glossy w-full rounded-3xl p-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-white/60">Your crew ({team.players.length})</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AnimatePresence>
            {team.players.map((p) => (
              <motion.span
                key={p.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="rounded-full px-3 py-1 text-sm font-extrabold"
                style={{ background: p.id === myId ? team.color : "rgba(255,255,255,0.14)", color: p.id === myId ? "#0b1026" : "#fff", opacity: p.connected ? 1 : 0.5 }}
              >
                {p.name}
                {p.id === myId ? " (you)" : ""}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 h-14 w-full">
        <AnimatePresence mode="wait">
          <motion.p key={tip} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-center text-base font-bold text-white/85">
            {TIPS[tip]}
          </motion.p>
        </AnimatePresence>
      </div>

      <p className="pulse-soft mt-auto font-display text-2xl text-gold">Waiting for the host…</p>
      <button className="mt-3 text-sm font-bold text-white/55 underline" onClick={onSwitch}>
        Wrong team? Switch
      </button>
    </div>
  );
}
