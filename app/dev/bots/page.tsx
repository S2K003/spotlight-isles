"use client";

import { useEffect, useRef, useState } from "react";
import { TEAM_DEFS } from "@/config/teams";
import { FINAL_BY_ID, QUESTION_BY_ID } from "@/content/questions";
import { normalizeRoomCode } from "@/lib/engine/rng";
import type { CardId, PublicQuestion, TeamId } from "@/lib/engine/types";
import type { LobbyMsg, PhaseMsg, PlayerInfo } from "@/lib/net/messages";
import { createTransport, type Transport } from "@/lib/net/transport";

const NAMES = ["Ada", "Bo", "Cy", "Dee", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jun", "Kai", "Lux", "Mo", "Nia", "Oz", "Pia", "Quin", "Rae", "Sol", "Tao", "Uma", "Vik", "Wren", "Xan", "Yui", "Zed"];

/** The right answer for a question, as an index (or order) into the shuffled options the host sent. */
function rightAnswer(q: PublicQuestion): number | number[] {
  const fq = FINAL_BY_ID[q.id];
  if (fq) return fq.answer ? 0 : 1;
  const src = QUESTION_BY_ID[q.id];
  if (!src) return 0;
  if (src.type === "order") return src.options.map((o) => q.options.indexOf(o));
  return q.options.indexOf(src.options[src.correct]);
}

function wrongAnswer(q: PublicQuestion, right: number | number[]): number | number[] {
  if (Array.isArray(right)) return right.slice().reverse();
  const others = q.options.map((_, i) => i).filter((i) => i !== right);
  return others[Math.floor(Math.random() * others.length)];
}

/** /dev/bots?count=40&code=ABCD — fake players that join, answer, vote and rate. */
export default function BotsPage() {
  const [code, setCode] = useState("");
  const [count, setCount] = useState(40);
  const [skill, setSkill] = useState(0.6);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({ answers: 0, votes: 0, ratings: 0, phase: "—", mode: "" });
  const skillRef = useRef(skill);
  skillRef.current = skill;
  const autostart = useRef(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let c = normalizeRoomCode(sp.get("code") ?? "");
    if (!c) {
      try {
        c = JSON.parse(localStorage.getItem("spotlight-isles:host") ?? "{}").roomCode ?? "";
      } catch {
        /* ignore */
      }
    }
    setCode(c);
    const n = Number(sp.get("count"));
    if (n > 0) setCount(Math.min(60, Math.floor(n)));
    if (sp.get("skill")) setSkill(Math.max(0, Math.min(1, Number(sp.get("skill")))));
    if (c.length === 4 && sp.get("code")) autostart.current = true;
  }, []);
  useEffect(() => {
    if (autostart.current && code.length === 4) {
      autostart.current = false;
      setRunning(true);
    }
  }, [code]);

  useEffect(() => {
    if (!running || code.length !== 4) return;
    const tag = Math.random().toString(36).slice(2, 6);
    const bots: PlayerInfo[] = Array.from({ length: count }, (_, i) => ({
      playerId: `bot-${tag}-${i}`,
      name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? Math.floor(i / NAMES.length) + 1 : ""}🤖`,
      teamId: (i % 6) as TeamId,
    }));
    const transport: Transport = createTransport(code);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let lastPhase = "";
    let joined = false;
    const say = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l].slice(0, 14));
    setStats((s) => ({ ...s, mode: transport.mode }));

    /** Run `fn` at a random moment in the first part of the phase (immediately if this tab is hidden and throttled). */
    const soon = (windowMs: number, fn: () => void) => {
      const delay = document.hidden ? 0 : 60 + Math.random() * Math.max(0, windowMs * 0.7 - 120);
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, delay);
      timers.add(id);
    };

    const joinAll = () => {
      bots.forEach((b, i) => {
        const id = setTimeout(() => transport.send("join", b), i * 35);
        timers.add(id);
      });
      transport.track({ ...bots[0], extra: bots });
      say(`${bots.length} bots joining room ${code}`);
    };

    const onPhase = (p: PhaseMsg) => {
      if (p.phaseId === lastPhase) return;
      lastPhase = p.phaseId;
      setStats((s) => ({ ...s, phase: `${p.phaseId} (${p.kind})` }));
      const d = p.publicData;
      if ((p.kind === "challenge" || p.kind === "finalQ") && d.question) {
        const q = d.question;
        const right = rightAnswer(q);
        for (const b of bots) {
          if (Math.random() < 0.06) continue; // some people are slow
          soon(p.endsInMs, () => {
            const choice = Math.random() < skillRef.current ? right : wrongAnswer(q, right);
            transport.send("answer", { playerId: b.playerId, phaseId: p.phaseId, choice });
            setStats((s) => ({ ...s, answers: s.answers + 1 }));
          });
        }
      } else if (p.kind === "vote" && d.reach) {
        for (let team = 0; team < 6; team++) {
          const reach = d.reach[team] ?? [];
          const cards = d.teams[team].cards as CardId[];
          // Teams mostly agree (like a real table talking it through), with a few rebels.
          const consensus = reach.length ? reach[Math.floor(Math.random() * reach.length)].key : "hold";
          const card: CardId | "none" = cards.length && Math.random() < 0.6 ? cards[0] : "none";
          for (const b of bots.filter((x) => x.teamId === team)) {
            soon(p.endsInMs, () => {
              const rebel = reach.length && Math.random() < 0.25;
              const destination = rebel ? reach[Math.floor(Math.random() * reach.length)].key : consensus;
              transport.send("vote", { playerId: b.playerId, phaseId: p.phaseId, destination, card });
              setStats((s) => ({ ...s, votes: s.votes + 1 }));
            });
          }
        }
      } else if (p.kind === "spotRate" && d.spot) {
        const speakerTeam = d.spot.teams[d.spot.slot];
        const quality = 2.5 + Math.random() * 2;
        for (const b of bots) {
          if (b.teamId === speakerTeam) continue;
          soon(p.endsInMs, () => {
            const star = () => Math.max(1, Math.min(5, Math.round(quality + (Math.random() - 0.5) * 2)));
            transport.send("rating", { playerId: b.playerId, phaseId: p.phaseId, speakerTeamId: speakerTeam, hook: star(), clarity: star(), confidence: star() });
            setStats((s) => ({ ...s, ratings: s.ratings + 1 }));
          });
        }
      } else if (p.kind === "over") {
        say("Game over received");
      }
    };

    const offMsg = transport.on((event, payload) => {
      if (event === "phase") onPhase(payload as PhaseMsg);
      else if (event === "lobby") {
        const lobby = payload as LobbyMsg;
        const present = new Set(lobby.teams.flatMap((t) => t.players.map((p) => p.id)));
        // The host was reloaded or opened late: join again.
        if (joined && !bots.every((b) => present.has(b.playerId))) joinAll();
      }
    });
    const offStatus = transport.onStatus((s) => {
      say(`transport: ${s}`);
      if (s === "connected") {
        joined = true;
        joinAll();
        transport.send("hello", { playerId: bots[0].playerId });
      }
    });

    return () => {
      for (const b of bots) transport.send("leave", { playerId: b.playerId });
      offMsg();
      offStatus();
      for (const t of timers) clearTimeout(t);
      transport.close();
    };
  }, [running, code, count]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-display text-4xl text-gold">Bot simulator</h1>
      <p className="mt-1 font-bold text-white/70">
        Spawns fake players that join teams round-robin and answer, vote and rate. Open <code>/host</code> first (same browser if no Supabase keys are set), then start the bots. Keep this tab in its own visible window for realistic timing.
      </p>

      <div className="glossy mt-5 grid grid-cols-3 gap-4 rounded-3xl p-5">
        <label className="text-sm font-extrabold text-white/70">
          Room code
          <input value={code} disabled={running} onChange={(e) => setCode(normalizeRoomCode(e.target.value))} maxLength={4} className="mt-1 w-full rounded-xl bg-black/40 px-3 py-2 font-display text-3xl tracking-widest text-white outline-none" />
        </label>
        <label className="text-sm font-extrabold text-white/70">
          Bots (max 60)
          <input type="number" min={1} max={60} value={count} disabled={running} onChange={(e) => setCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className="mt-1 w-full rounded-xl bg-black/40 px-3 py-2 font-display text-3xl text-white outline-none" />
        </label>
        <label className="text-sm font-extrabold text-white/70">
          Accuracy {Math.round(skill * 100)}%
          <input type="range" min={0} max={1} step={0.05} value={skill} onChange={(e) => setSkill(Number(e.target.value))} className="mt-4 w-full" />
        </label>
        <button className={`btn col-span-3 text-2xl ${running ? "bg-rose-500 text-white" : "bg-gold text-ink"}`} disabled={code.length !== 4} onClick={() => setRunning((r) => !r)}>
          {running ? "Stop bots" : `Start ${count} bots`}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TEAM_DEFS.map((t) => (
          <span key={t.id} className="rounded-full px-3 py-1 text-sm font-extrabold text-ink" style={{ background: t.color }}>
            {t.emblem} {t.name}: {Array.from({ length: count }, (_, i) => i).filter((i) => i % 6 === t.id).length}
          </span>
        ))}
      </div>

      <div className="glossy mt-4 rounded-3xl p-5 font-mono text-sm">
        <div id="bot-stats">
          transport={stats.mode || "—"} · phase={stats.phase} · answers={stats.answers} · votes={stats.votes} · ratings={stats.ratings}
        </div>
        <ul className="mt-3 space-y-0.5 text-white/70">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
