"use client";

import confetti from "canvas-confetti";
import { motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { PITCH_RECIPE } from "@/content/spotlight";
import { Airship, Emblem } from "@/components/shared/Emblem";
import { useRemaining } from "@/components/shared/useCountdown";
import { formatClock } from "@/lib/engine/timeline";
import type { PhaseKind, PublicData, SpeakerResult, TeamId } from "@/lib/engine/types";
import { GameClient, type ClientView } from "@/lib/net/client";
import { AnswerPad, LockedIn, RatingStars } from "./Inputs";
import { Join, Waiting } from "./Lobby";
import { VoteMap } from "./VoteMap";

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

const PHASE_TITLE: Record<PhaseKind | "lobby", string> = {
  lobby: "Lobby",
  intro: "Get ready",
  challenge: "Team question",
  reveal: "Answer",
  vote: "Where to?",
  resolve: "Ships moving",
  spotReady: "Pitch prep",
  spotSpeak: "Live pitch",
  spotRate: "Mark the pitch",
  spotReveal: "Scorecards",
  results: "Results",
  debrief: "Debrief",
  over: "Game over",
};

const REDUCE_KEY = "spotlight-isles:reduce-motion";

export default function PlayApp({ code }: { code: string }) {
  const [client, setClient] = useState<GameClient | null>(null);
  useEffect(() => {
    const c = new GameClient(code);
    c.connect();
    setClient(c);
    return () => c.close();
  }, [code]);
  if (!client) return <Center>Connecting…</Center>;
  return <Play client={client} code={code} />;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-6 text-center text-xl font-extrabold text-white/80">{children}</div>;
}

function Play({ client, code }: { client: GameClient; code: string }) {
  const view = useSyncExternalStore(client.subscribe, client.getView, client.getView);
  const [reduce, setReduce] = useState(false);
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    try {
      setReduce(localStorage.getItem(REDUCE_KEY) === "1" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      /* ignore */
    }
  }, []);
  const toggleReduce = () => {
    setReduce((r) => {
      try {
        localStorage.setItem(REDUCE_KEY, r ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !r;
    });
  };

  // Haptic nudge on every phase change (not supported on iOS, which is fine).
  const phaseId = view.phase?.phaseId;
  useEffect(() => {
    if (phaseId && phaseId !== "lobby") navigator.vibrate?.(35);
  }, [phaseId]);

  const { lobby, me, phase } = view;
  const started = !!phase && phase.kind !== "lobby";
  const joined = me.teamId !== null && !!me.name && !!lobby?.teams[me.teamId]?.players.some((p) => p.id === me.playerId);

  let body: React.ReactNode;
  if (view.kicked && !joined) {
    body = (
      <Center>
        <div>
          <p>The host removed you from the room.</p>
          <button className="btn mt-4 bg-gold px-6 text-ink" onClick={() => location.reload()}>
            Rejoin
          </button>
        </div>
      </Center>
    );
  } else if (!lobby) {
    body = (
      <Center>
        <div>
          <p className="pulse-soft font-display text-3xl text-gold">Looking for room {code}…</p>
          <p className="mt-3 text-sm font-bold text-white/60">
            {view.status === "error"
              ? "Connection problem. Check your Wi-Fi or mobile data."
              : view.mode === "local"
                ? "This site has no realtime keys set, so only tabs in the host's own browser can join."
                : "Make sure the host screen is open and the code is right."}
          </p>
        </div>
      </Center>
    );
  } else if (!joined || (switching && !started)) {
    body = (
      <Join
        lobby={lobby}
        initialName={me.name}
        onJoin={(name, teamId) => {
          client.join(name, teamId);
          setSwitching(false);
        }}
      />
    );
  } else if (!started) {
    body = <Waiting lobby={lobby} teamId={me.teamId as TeamId} myId={me.playerId} onSwitch={() => setSwitching(true)} />;
  } else {
    body = <Game client={client} view={view} reduce={reduce} />;
  }

  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <main className={`relative min-h-dvh bg-gradient-to-b from-[#1a1f4d] via-[#0f1434] to-[#0b1026] ${reduce ? "reduce-motion" : ""}`}>
        {body}
        <button onClick={toggleReduce} className="fixed bottom-1.5 right-2 z-50 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white/60" aria-pressed={reduce}>
          {reduce ? "Motion: reduced" : "Reduce motion"}
        </button>
      </main>
    </MotionConfig>
  );
}

/* ---------- in-game frame ---------- */

function Ring({ view }: { view: ClientView }) {
  const get = useCallback(() => view.phaseEndsAt - performance.now(), [view.phaseEndsAt]);
  const ms = useRemaining(get);
  const dur = Math.max(1, view.phase?.durationMs ?? 1);
  const frac = Math.max(0, Math.min(1, ms / dur));
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={R} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.18)" strokeWidth="5" />
        <circle cx="28" cy="28" r={R} fill="none" stroke={frac < 0.2 ? "#ef4444" : "#ffd54a"} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-xl">{view.paused ? "❚❚" : secs}</span>
    </div>
  );
}

function GlobalClock({ view }: { view: ClientView }) {
  const get = useCallback(() => view.globalEndsAt - performance.now(), [view.globalEndsAt]);
  const ms = useRemaining(get, 500);
  return <span className="tabular-nums">{formatClock(ms)}</span>;
}

function Game({ client, view, reduce }: { client: GameClient; view: ClientView; reduce: boolean }) {
  const phase = view.phase!;
  const data = phase.publicData;
  const teamId = view.me.teamId as TeamId;
  const team = data.teams[teamId];
  const def = TEAM_DEFS[teamId];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2.5 px-3 py-2 shadow-lg" style={{ background: `linear-gradient(180deg, ${def.color}, ${def.color}cc)` }}>
        <Emblem teamId={teamId} size={38} />
        <div className="min-w-0 flex-1 leading-tight" style={{ color: teamId === 4 || teamId === 1 || teamId === 3 ? "#fff" : "#0b1026" }}>
          <div className="truncate font-display text-xl">{team?.name ?? def.name}</div>
          <div className="truncate text-xs font-extrabold opacity-80">
            {team?.score ?? 0} pts · {team?.docked !== null ? "🎤 at the Stage" : team?.hasKey ? "🔑 ✓" : "needs 🔑"} · <GlobalClock view={view} />
          </div>
        </div>
        <div className="text-right leading-tight" style={{ color: teamId === 4 || teamId === 1 || teamId === 3 ? "#fff" : "#0b1026" }}>
          <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">{data.round > 0 ? `Round ${data.round}/${data.totalRounds}` : " "}</div>
          <div className="font-display text-lg">{PHASE_TITLE[phase.kind]}</div>
        </div>
        <Ring view={view} />
      </header>

      {view.paused && <div className="bg-amber-400 py-1 text-center text-sm font-extrabold text-ink">Game paused by the host</div>}

      {/* Keyed so each phase slides in; no exit animation, so the screen is never blank between phases. */}
      <motion.section key={phase.phaseId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex flex-1 flex-col px-4 pb-10 pt-4">
        <PhaseBody client={client} view={view} data={data} teamId={teamId} reduce={reduce} />
      </motion.section>
    </div>
  );
}

function BigScreen({ teamId, text = "👀 Look at the big screen!", sub }: { teamId: TeamId; text?: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="bob">
        <Airship teamId={teamId} size={150} />
      </div>
      <p className="mt-4 font-display text-3xl">{text}</p>
      {sub && <p className="mt-2 text-base font-bold text-white/75">{sub}</p>}
    </div>
  );
}

/** What my team earned this round and where we are in the move order. */
function Earned({ data, teamId }: { data: PublicData; teamId: TeamId }) {
  const r = data.teamResults?.[teamId];
  const team = data.teams[teamId];
  if (!r) return null;
  if (team.docked !== null) {
    return (
      <div className="glossy mt-4 rounded-2xl p-4 text-center">
        <p className="font-display text-2xl text-gold">🎤 You&apos;re at the Stage</p>
        <p className="font-bold text-white/80">+{r.points} points this round</p>
      </div>
    );
  }
  return (
    <div className="glossy mt-4 rounded-2xl p-4 text-center">
      <p className="font-bold text-white/85">
        {r.speaker ? "Your pitch earned" : r.fairJudge ? "⚖️ Fair marking! You earned" : r.rated === false ? "No marks sent, so only" : r.rated ? "For marking the pitches" : `Your team: ${r.correct}/${r.members} correct`}
      </p>
      <p className="font-display text-4xl text-gold">
        {r.steps} {r.steps === 1 ? "step" : "steps"} <span className="text-2xl text-emerald-300">+{r.points} pts</span>
      </p>
      {r.tailwind && <p className="text-sm font-extrabold text-sky-300">🌬️ Tailwind: +1 step for being in last place</p>}
      {team.order !== null && <p className="mt-1 text-sm font-extrabold text-white/70">You move {ORDINAL[team.order]} this round</p>}
    </div>
  );
}

function Scorecard({ team, res }: { team: string; res: SpeakerResult }) {
  return (
    <div className="glossy rounded-2xl p-3">
      <div className="font-display text-xl">{team}</div>
      {res.overall === null ? (
        <p className="py-2 text-center font-bold text-white/60">No marks received</p>
      ) : (
        <>
          {SPOTLIGHT_CRITERIA.map((c) => {
            const v = (res[c.key] as number) ?? 0;
            return (
              <div key={c.key} className="mt-1.5 flex items-center gap-2 text-sm font-extrabold">
                <span className="w-24">{c.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/40">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(v / 5) * 100}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-gold" />
                </div>
                <span className="w-8 text-right tabular-nums">{v.toFixed(1)}</span>
              </div>
            );
          })}
          <p className="mt-2 text-center font-display text-2xl text-gold">{res.overall.toFixed(1)} ★</p>
        </>
      )}
    </div>
  );
}

function PhaseBody({ client, view, data, teamId, reduce }: { client: GameClient; view: ClientView; data: PublicData; teamId: TeamId; reduce: boolean }) {
  const phase = view.phase!;
  const myId = view.me.playerId;
  const [slideW, setSlideW] = useState(328);
  useEffect(() => setSlideW(Math.min(400, window.innerWidth - 32)), []);

  // Confetti burst on a correct answer.
  const fired = useRef("");
  const correct = phase.kind === "reveal" ? data.reveal?.playerCorrect[myId] : undefined;
  useEffect(() => {
    if (correct && !reduce && fired.current !== phase.phaseId) {
      fired.current = phase.phaseId;
      void confetti({ particleCount: 70, spread: 75, origin: { y: 0.55 }, colors: [TEAM_DEFS[teamId].color, "#ffd54a", "#ffffff"] });
    }
  }, [correct, reduce, phase.phaseId, teamId]);

  switch (phase.kind) {
    case "intro":
      return (
        <div className="flex flex-1 flex-col justify-center gap-3">
          <BigScreen teamId={teamId} text="Here we go!" sub="Sit with your team. This game is all about talking it through." />
          {[
            ["🔑", "Find your key, reach the Stage", "Your key is on the opposite island. Then fly to the middle."],
            ["💬", "Talk first, then tap", "Discuss the question or plan your pitch. No rush."],
            ["🥇", "Most points moves first", "Ships move one at a time. You can't land on another ship."],
          ].map(([icon, title, text]) => (
            <div key={title} className="glossy flex items-center gap-3 rounded-2xl p-3">
              <span className="text-3xl">{icon}</span>
              <div>
                <div className="font-display text-lg leading-tight">{title}</div>
                <div className="text-sm font-bold text-white/70">{text}</div>
              </div>
            </div>
          ))}
        </div>
      );

    case "challenge": {
      const q = data.question;
      if (!q) return <BigScreen teamId={teamId} />;
      return (
        <div>
          <p className="mb-2 text-center text-sm font-extrabold text-gold">💬 Discuss with your team first, then tap your team&apos;s answer</p>
          <AnswerPad question={q} sent={view.sent.answer} onAnswer={(i) => client.answer(i)} slideWidth={slideW} />
        </div>
      );
    }

    case "reveal": {
      const rv = data.reveal;
      if (!rv) return <BigScreen teamId={teamId} />;
      return (
        <div className="flex flex-1 flex-col">
          <motion.div initial={{ scale: 0.3, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0.55 }} className="text-center text-7xl">
            {correct === true ? "✅" : correct === false ? "❌" : "⏱️"}
          </motion.div>
          <p className="mt-1 text-center font-display text-3xl">{correct === true ? "Correct!" : correct === false ? "Not quite" : "No answer"}</p>
          <div className="glossy mt-3 rounded-2xl p-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-300">Answer</p>
            <p className="text-lg font-extrabold leading-snug">{rv.correctText}</p>
            <p className="mt-2 text-xs font-extrabold uppercase tracking-widest text-gold">Why</p>
            <p className="text-base font-bold leading-snug text-white/90">{rv.why}</p>
          </div>
          <Earned data={data} teamId={teamId} />
        </div>
      );
    }

    case "vote":
      return <Vote client={client} view={view} data={data} teamId={teamId} />;

    case "resolve": {
      const move = data.moves?.find((m) => m.teamId === teamId);
      const sub = !move
        ? undefined
        : move.docked
          ? `🎤 You reached the Stage ${ORDINAL[move.docked - 1]}! +${move.bonus} points`
          : move.gotKey
            ? "🔑 You found your key! Now head for the Stage."
            : move.blockedAt
              ? "💥 Another ship got there first, so you stopped one hex short."
              : move.stars.length
                ? "⭐ You grabbed a star! +10"
                : move.path.length > 1
                  ? "Your ship is on the move."
                  : "Your ship is holding position.";
      return <BigScreen teamId={teamId} sub={sub} />;
    }

    case "spotReady":
    case "spotSpeak":
    case "spotRate":
    case "spotReveal": {
      const spot = data.spot;
      if (!spot) return <BigScreen teamId={teamId} />;
      const mySlot = spot.teams.indexOf(teamId);
      const speakerTeamId = spot.teams[spot.slot];
      const speakerTeam = data.teams[speakerTeamId];
      const myTeamSpeaks = speakerTeamId === teamId;

      if (phase.kind === "spotReady") {
        if (mySlot >= 0) {
          return (
            <div className="flex flex-1 flex-col">
              <p className="text-center font-display text-3xl text-gold">🎤 Your team pitches {mySlot === 0 ? "FIRST" : "SECOND"}</p>
              <div className="glossy mt-3 rounded-3xl p-4">
                <p className="text-xs font-extrabold uppercase tracking-widest text-white/60">Your topic</p>
                <p className="text-2xl font-extrabold leading-snug">{spot.topics[mySlot]}</p>
              </div>
              <p className="mt-3 text-center text-base font-extrabold">Choose ONE speaker. Plan 25 seconds together:</p>
              <div className="mt-2 grid gap-2">
                {PITCH_RECIPE.map(([label, hint], i) => (
                  <div key={label} className="glossy flex items-center gap-3 rounded-xl px-3 py-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-gold font-display text-ink">{i + 1}</span>
                    <span>
                      <span className="font-display text-lg text-gold">{label}</span> <span className="text-sm font-bold text-white/75">{hint}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-sm font-bold text-white/65">The other teams will mark you on exactly these three.</p>
            </div>
          );
        }
        return (
          <div className="flex flex-1 flex-col justify-center text-center">
            <p className="font-display text-3xl text-gold">🎤 Pitch round</p>
            <p className="mt-2 text-lg font-bold text-white/85">
              {data.teams[spot.teams[0]].name} and {data.teams[spot.teams[1]].name} are preparing a 25-second pitch.
            </p>
            <p className="mt-4 text-base font-extrabold">While you wait, agree as a team: what makes a pitch great?</p>
            <div className="mt-2 grid gap-2 text-left">
              {SPOTLIGHT_CRITERIA.map((c) => (
                <div key={c.key} className="glossy rounded-xl px-3 py-2">
                  <span className="font-display text-lg text-gold">{c.label}</span> <span className="text-sm font-bold text-white/75">— {c.hint}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-bold text-white/65">Marking earns you 2 steps. Marking fairly earns 3.</p>
          </div>
        );
      }

      if (phase.kind === "spotSpeak") {
        if (myTeamSpeaks) {
          return (
            <div className="flex flex-1 flex-col justify-center text-center">
              <motion.p initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.6 }} className="font-display text-5xl text-gold">
                🎤 YOU&apos;RE ON!
              </motion.p>
              <div className="glossy mt-4 rounded-3xl p-5">
                <p className="text-xs font-extrabold uppercase tracking-widest text-white/60">Your topic</p>
                <p className="text-2xl font-extrabold leading-snug">{spot.topics[spot.slot]}</p>
              </div>
              <p className="mt-4 text-lg font-bold text-white/85">Speaker: stand up and talk to the room. Teammates: cheer them on! 📣</p>
            </div>
          );
        }
        return (
          <div className="flex flex-1 flex-col justify-center text-center">
            <p className="text-5xl">👂</p>
            <p className="mt-2 font-display text-3xl">Listen to {speakerTeam.name}</p>
            <p className="mt-2 text-base font-bold text-white/75">&ldquo;{spot.topics[spot.slot]}&rdquo;</p>
            <p className="mt-5 text-sm font-extrabold text-white/65">You&apos;ll mark Hook, Clarity and Confidence in a moment.</p>
          </div>
        );
      }

      if (phase.kind === "spotRate") {
        if (myTeamSpeaks) return <BigScreen teamId={teamId} text="Well done! 👏" sub="The other teams are marking your pitch." />;
        return (
          <div>
            <p className="mb-3 text-center font-display text-2xl">
              Mark <span style={{ color: TEAM_DEFS[speakerTeamId].text }}>{speakerTeam.name}</span>
            </p>
            <RatingStars key={phase.phaseId} sent={view.sent.rating} onRate={(r) => client.rate(speakerTeamId, r)} />
          </div>
        );
      }

      return (
        <div className="grid gap-3">
          {spot.results?.map((res, i) => (
            <Scorecard key={i} team={data.teams[spot.teams[i]].name} res={res} />
          ))}
          <Earned data={data} teamId={teamId} />
        </div>
      );
    }

    case "results":
    case "debrief":
    case "over":
    default: {
      const row = data.results?.ranking.find((r) => r.teamId === teamId);
      const mine = data.results?.personal[myId];
      const over = phase.kind === "over";
      return (
        <div className="flex flex-1 flex-col text-center">
          <p className="font-display text-4xl text-gold">{over ? "Thanks for playing! 🎉" : phase.kind === "debrief" ? "Debrief time" : "Results!"}</p>
          {row && (
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glossy mt-4 rounded-3xl p-5">
              <p className="text-sm font-extrabold uppercase tracking-widest text-white/60">Your team finished</p>
              <p className="font-display text-7xl" style={{ color: TEAM_DEFS[teamId].text }}>
                {ORDINAL[row.rank - 1]}
              </p>
              <p className="text-lg font-extrabold">{row.score} points</p>
              <p className="mt-1 text-sm font-bold text-white/75">
                {row.docked !== null ? `🎤 Reached the Stage ${ORDINAL[row.docked - 1]}` : row.hasKey ? "🔑 Found the key" : "Still looking for the key"}
                {row.stars > 0 ? ` · ⭐ ${row.stars}` : ""}
                {row.pitch !== null ? ` · pitch ${row.pitch.toFixed(1)}★` : ""}
              </p>
              {data.results?.bestPitch === teamId && <p className="stamp mt-2 inline-block rounded-lg border-2 border-gold px-2 font-display text-xl text-gold">BEST PITCH!</p>}
            </motion.div>
          )}
          {mine && (
            <div className="glossy mt-3 grid grid-cols-2 gap-2 rounded-3xl p-4">
              <Stat label="Your answers" value={`${mine.correct}/${mine.answered} right`} />
              <Stat label="Pitches marked" value={String(mine.ratings)} />
            </div>
          )}
          {data.debrief && (
            <div className="glossy mt-3 rounded-3xl p-4 text-left">
              <p className="text-xs font-extrabold uppercase tracking-widest text-gold">Takeaways</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm font-bold text-white/85">
                {data.debrief.takeaways.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-extrabold text-white">{data.debrief.prompt}</p>
            </div>
          )}
          {!row && <LockedIn />}
        </div>
      );
    }
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-2xl text-gold">{value}</div>
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}

function Vote({ client, view, data, teamId }: { client: GameClient; view: ClientView; data: PublicData; teamId: TeamId }) {
  const reach = data.reach?.[teamId] ?? [];
  const team = data.teams[teamId];
  const dest = view.sent.vote ?? null;

  if (team.docked !== null) return <BigScreen teamId={teamId} text="🎤 You're at the Stage!" sub="Keep answering and pitching: every point still counts." />;
  if (!view.tiles) return <BigScreen teamId={teamId} text="Loading map…" />;
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-center font-display text-2xl">
        {team.steps ?? 0} {team.steps === 1 ? "step" : "steps"}
        {team.order !== null && <span className="text-base text-white/70"> · you move {ORDINAL[team.order]}</span>}
      </p>
      <p className="text-center text-sm font-extrabold text-gold">{team.hasKey ? "🔑 Got your key! Head for the 🎤 Stage in the middle." : "First fly to your 🔑 key (the big one in your colour)."}</p>
      <p className="text-center text-xs font-bold text-white/60">Agree with your team, then tap a glowing hex. Dots show your teammates&apos; votes.</p>
      <VoteMap tiles={view.tiles} teams={data.teams} teamId={teamId} reach={reach} tally={view.tally} selected={dest && dest !== "hold" ? dest : null} onSelect={(k) => client.vote(k)} radius={8} className="mx-auto my-1 max-h-[52dvh] min-h-[40dvh] w-full" />
      <button className="btn w-full text-lg text-white" style={{ background: dest === "hold" ? "#7c3aed" : "#334155", outline: dest === "hold" ? "3px solid #ffd54a" : "none" }} onClick={() => client.vote("hold")}>
        ⚓ Stay here{view.tally.hold ? ` · ${view.tally.hold} vote${view.tally.hold > 1 ? "s" : ""}` : ""}
      </button>
      {dest && <p className="mt-2 text-center text-sm font-extrabold text-emerald-300">Vote in ✓ — you can change it until time runs out</p>}
    </div>
  );
}
