"use client";

import confetti from "canvas-confetti";
import { motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CARD_INFO } from "@/config/balance";
import { RUBRIC, SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { Airship, Emblem } from "@/components/shared/Emblem";
import { useRemaining } from "@/components/shared/useCountdown";
import { formatClock } from "@/lib/engine/timeline";
import type { CardId, PhaseKind, PublicData, SpeakerResult, TeamId } from "@/lib/engine/types";
import { GameClient, type ClientView } from "@/lib/net/client";
import { AnswerPad, CardRow, LockedIn, OrderPad, RatingStars } from "./Inputs";
import { Join, Waiting } from "./Lobby";
import { VoteMap } from "./VoteMap";

const PHASE_TITLE: Record<PhaseKind | "lobby", string> = {
  lobby: "Lobby",
  intro: "Get ready",
  challenge: "Challenge",
  reveal: "Answer",
  vote: "Team vote",
  resolve: "Ships moving",
  spotReady: "Spotlight",
  spotSpeak: "Spotlight",
  spotRate: "Rate the pitch",
  spotReveal: "Scorecard",
  finalBanner: "Final Showdown",
  finalQ: "Final Showdown",
  finalReveal: "Final Showdown",
  finalFlood: "Final Showdown",
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
        <button
          onClick={toggleReduce}
          className="fixed bottom-1.5 right-2 z-50 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white/60"
          aria-pressed={reduce}
        >
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
        <circle cx="28" cy="28" r={R} fill="none" stroke={frac < 0.25 ? "#ef4444" : "#ffd54a"} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
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
        <div className="min-w-0 flex-1 leading-tight text-[#0b1026]">
          <div className="truncate font-display text-xl">{team?.name ?? def.name}</div>
          <div className="truncate text-xs font-extrabold opacity-75">
            {view.me.name} · {team?.score ?? 0} pts · <GlobalClock view={view} />
          </div>
        </div>
        <div className="text-right leading-tight text-[#0b1026]">
          <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-75">{data.round > 0 && data.round <= data.totalRounds ? `Round ${data.round}/${data.totalRounds}` : " "}</div>
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
      {sub && <p className="mt-2 text-base font-bold text-white/70">{sub}</p>}
    </div>
  );
}

function MpLine({ data, teamId }: { data: PublicData; teamId: TeamId }) {
  const r = data.teamResults?.[teamId];
  if (!r) return null;
  const mods = r.mods.map((m) => (m.kind === "hook" ? "🪝 +1" : m.kind === "swamp" ? "🫧 −1" : "📢 −1")).join("  ");
  return (
    <div className="glossy mt-4 rounded-2xl p-4 text-center">
      {r.stageFright ? (
        <>
          <p className="font-display text-3xl text-sky-300">😰 STAGE FRIGHT</p>
          <p className="font-bold text-white/75">Nobody on your team got it. Your ship can&apos;t move this round.</p>
        </>
      ) : (
        <>
          {!r.speaker && r.fairJudge === undefined && (
            <p className="font-bold text-white/80">
              Your team: {r.correct}/{r.members} correct
            </p>
          )}
          {r.speaker && <p className="font-bold text-white/80">Your speaker earned it!</p>}
          {r.fairJudge && <p className="font-bold text-emerald-300">⚖️ Fair Judge bonus +1</p>}
          <p className="font-display text-4xl text-gold">→ {r.mp} MP</p>
          {r.quickDraw && <p className="stamp mt-1 inline-block rounded-lg border-2 border-gold px-2 font-display text-xl text-gold">QUICK DRAW! +1</p>}
          {mods && <p className="mt-1 text-sm font-extrabold text-white/70">{mods}</p>}
        </>
      )}
    </div>
  );
}

function Scorecard({ name, team, res }: { name: string; team: string; res: SpeakerResult }) {
  return (
    <div className="glossy rounded-2xl p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-xl">{name}</span>
        <span className="text-xs font-extrabold text-white/60">{team}</span>
      </div>
      {res.overall === null ? (
        <p className="py-2 text-center font-bold text-white/60">No ratings received</p>
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
          <p className="mt-2 text-center font-display text-2xl text-gold">{res.overall.toFixed(1)} ★ overall</p>
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
  const isReveal = phase.kind === "reveal" || phase.kind === "finalReveal";
  const correct = isReveal ? data.reveal?.playerCorrect[myId] : undefined;
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
          <BigScreen teamId={teamId} text="Here we go!" sub="Watch the big screen for how to play" />
          {[
            ["🧠", "Answer the challenge", "Everyone answers. More correct = more movement."],
            ["🗳️", "Vote where to fly", "Majority decides. Every hex you cross becomes yours."],
            ["🎤", "Spotlight rounds", "One of you pitches for 20 seconds. Everyone else marks it."],
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

    case "challenge":
    case "finalQ": {
      const q = data.question;
      if (!q) return <BigScreen teamId={teamId} />;
      return (
        <div>
          {data.criterion && (
            <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-widest" style={{ color: RUBRIC[data.criterion].css }}>
              {RUBRIC[data.criterion].icon} {RUBRIC[data.criterion].label}
            </p>
          )}
          {phase.kind === "finalQ" && <p className="mb-2 text-center font-display text-xl text-gold">True or false? ({(data.final?.qIndex ?? 0) + 1}/3)</p>}
          {q.type === "order" ? (
            <OrderPad key={q.id} question={q} sent={view.sent.answer as number[] | undefined} onAnswer={(o) => client.answer(o)} />
          ) : (
            <AnswerPad question={q} sent={view.sent.answer as number | undefined} onAnswer={(i) => client.answer(i)} slideWidth={slideW} />
          )}
        </div>
      );
    }

    case "reveal":
    case "finalReveal": {
      const rv = data.reveal;
      if (!rv) return <BigScreen teamId={teamId} />;
      const passed = data.final?.perQ[data.final.perQ.length - 1]?.passed[teamId];
      const claim = data.final?.bottom3.includes(teamId) ? 3 : 2;
      return (
        <div className="flex flex-1 flex-col">
          <motion.div initial={{ scale: 0.3, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0.55 }} className="text-center text-8xl">
            {correct === true ? "✅" : correct === false ? "❌" : "⏱️"}
          </motion.div>
          <p className="mt-1 text-center font-display text-3xl">{correct === true ? "Correct!" : correct === false ? "Not quite" : "No answer"}</p>
          <div className="glossy mt-3 rounded-2xl p-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-300">Answer</p>
            <p className="text-lg font-extrabold leading-snug">{rv.correctText}</p>
            <p className="mt-2 text-xs font-extrabold uppercase tracking-widest text-gold">Why</p>
            <p className="text-base font-bold leading-snug text-white/90">{rv.why}</p>
          </div>
          {phase.kind === "reveal" ? (
            <MpLine data={data} teamId={teamId} />
          ) : (
            <div className="glossy mt-4 rounded-2xl p-4 text-center font-display text-2xl">
              {passed ? <span className="text-gold">Your team claims {claim} tiles! 🌊</span> : <span className="text-white/70">No tiles this time</span>}
            </div>
          )}
        </div>
      );
    }

    case "vote":
      return <Vote client={client} view={view} data={data} teamId={teamId} />;

    case "resolve": {
      const move = data.moves?.[teamId];
      const sub = move?.clashAt
        ? "💥 CLASH! Your ship was bounced back."
        : move?.pickup
          ? `🎁 You found ${CARD_INFO[move.pickup].icon} ${CARD_INFO[move.pickup].name}!`
          : move && move.path.length > 1
            ? `You painted ${move.painted.length} tile${move.painted.length === 1 ? "" : "s"}.`
            : "Your ship is holding position.";
      return <BigScreen teamId={teamId} sub={sub} />;
    }

    case "spotReady":
    case "spotSpeak":
    case "spotRate":
    case "spotReveal": {
      const spot = data.spot;
      if (!spot) return <BigScreen teamId={teamId} />;
      const slot = spot.slot;
      const speaker = spot.speakers[slot];
      const speakerTeam = spot.teams[slot];
      const iSpeak = speaker.id === myId;
      const mySlot = spot.speakers.findIndex((s) => s.id === myId);
      const myTeamSpeaks = speakerTeam === teamId;

      if (phase.kind === "spotReady") {
        return (
          <div className="flex flex-1 flex-col justify-center text-center">
            <p className="font-display text-4xl text-gold">🎤 SPOTLIGHT ROUND</p>
            {mySlot >= 0 ? (
              <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="glossy mt-4 rounded-3xl border-gold p-5">
                <p className="font-display text-3xl">It&apos;s YOU, {view.me.name}!</p>
                <p className="mt-1 text-lg font-bold text-white/80">You speak {mySlot === 0 ? "FIRST — get ready now" : "SECOND"}. 20 seconds, out loud, to the room.</p>
              </motion.div>
            ) : (
              <p className="mt-4 text-lg font-bold text-white/80">
                {spot.speakers[0].name} and {spot.speakers[1].name} are about to pitch. You&apos;ll mark them on Hook, Clarity and Confidence.
              </p>
            )}
          </div>
        );
      }

      if (phase.kind === "spotSpeak") {
        if (iSpeak) {
          return (
            <div className="flex flex-1 flex-col justify-center text-center">
              <motion.p initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.6 }} className="font-display text-6xl text-gold">
                🎤 YOU&apos;RE ON!
              </motion.p>
              <div className="glossy mt-4 rounded-3xl p-5">
                <p className="text-xs font-extrabold uppercase tracking-widest text-white/60">Your topic</p>
                <p className="text-2xl font-extrabold leading-snug">{spot.topic}</p>
                <p className="mt-3 text-xs font-extrabold uppercase tracking-widest text-gold">Twist</p>
                <p className="text-xl font-extrabold">{spot.twist}</p>
              </div>
              <p className="mt-4 text-lg font-bold text-white/80">Stand up and speak to the room!</p>
            </div>
          );
        }
        if (myTeamSpeaks) return <BigScreen teamId={teamId} text="Your team is speaking — cheer them on! 📣" sub={`${speaker.name} has 20 seconds.`} />;
        return (
          <div className="flex flex-1 flex-col justify-center text-center">
            <p className="text-5xl">👂</p>
            <p className="mt-2 font-display text-3xl">Listen to {speaker.name}</p>
            <p className="mt-2 text-base font-bold text-white/70">&ldquo;{spot.topic}&rdquo;</p>
            <div className="mt-5 grid gap-2">
              {SPOTLIGHT_CRITERIA.map((c) => (
                <div key={c.key} className="glossy rounded-xl px-3 py-2 text-left">
                  <span className="font-display text-lg text-gold">{c.label}</span> <span className="text-sm font-bold text-white/70">— {c.hint}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm font-extrabold text-white/60">You&apos;ll rate in a moment. Be fair!</p>
          </div>
        );
      }

      if (phase.kind === "spotRate") {
        if (myTeamSpeaks) return <BigScreen teamId={teamId} text="Your team is speaking — cheer them on! 📣" sub="The other teams are marking the pitch." />;
        return (
          <div>
            <p className="mb-3 text-center font-display text-2xl">
              Rate <span className="text-gold">{speaker.name}</span>
            </p>
            <RatingStars key={phase.phaseId} sent={view.sent.rating} onRate={(r) => client.rate(speakerTeam, r)} />
          </div>
        );
      }

      return (
        <div className="grid gap-3">
          {spot.results?.map((res, i) => (
            <Scorecard key={i} name={spot.speakers[i].name} team={data.teams[spot.teams[i]].name} res={res} />
          ))}
          <MpLine data={data} teamId={teamId} />
        </div>
      );
    }

    case "finalBanner":
      return <BigScreen teamId={teamId} text="🌙 FINAL SHOWDOWN" sub="3 rapid-fire true/false questions. Each one your team gets right floods more territory." />;
    case "finalFlood":
      return <BigScreen teamId={teamId} text="🌊 Territory flood!" sub={data.final?.stageWinner === teamId ? "YOUR TEAM TAKES THE KEYNOTE STAGE! +100" : "Watch the Keynote Stage…"} />;

    case "results":
    case "debrief":
    case "over":
    default: {
      const row = data.results?.ranking.find((r) => r.teamId === teamId);
      const mine = data.results?.personal[myId];
      const award = data.results?.awards.filter((a) => a.playerId === myId) ?? [];
      const over = phase.kind === "over";
      return (
        <div className="flex flex-1 flex-col text-center">
          <p className="font-display text-4xl text-gold">{over ? "Thanks for playing! 🎉" : phase.kind === "debrief" ? "Debrief time" : "Results!"}</p>
          {row && (
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glossy mt-4 rounded-3xl p-5">
              <p className="text-sm font-extrabold uppercase tracking-widest text-white/60">Your team finished</p>
              <p className="font-display text-7xl" style={{ color: TEAM_DEFS[teamId].text }}>
                {["1st", "2nd", "3rd", "4th", "5th", "6th"][row.rank - 1]}
              </p>
              <p className="text-lg font-extrabold">
                {row.score} points · {row.tiles} tiles
              </p>
              {(row.mastery.length > 0 || row.stage) && (
                <p className="mt-1 text-sm font-bold text-white/75">
                  {row.stage ? "🎤 Keynote Stage  " : ""}
                  {row.mastery.map((m) => `${RUBRIC[m].icon} ${RUBRIC[m].label}`).join("  ")}
                </p>
              )}
            </motion.div>
          )}
          {mine && (
            <div className="glossy mt-3 grid grid-cols-3 gap-2 rounded-3xl p-4">
              <Stat label="Correct" value={`${mine.correct}/${mine.answered}`} />
              <Stat label="Avg speed" value={mine.avgMs !== null ? `${(mine.avgMs / 1000).toFixed(1)}s` : "—"} />
              <Stat label={mine.spotlight !== null ? "Your pitch" : "Pitches rated"} value={mine.spotlight !== null ? `${mine.spotlight.toFixed(1)}★` : String(mine.ratings)} />
            </div>
          )}
          {award.map((a) => (
            <div key={a.key} className="stamp mt-3 rounded-2xl border-2 border-gold bg-gold/15 p-3 font-display text-2xl text-gold">
              {a.icon} You won {a.title}!
            </div>
          ))}
          {data.debrief && (
            <div className="glossy mt-3 rounded-3xl p-4 text-left">
              {data.debrief.strongest && (
                <p className="font-bold">
                  🏆 Room&apos;s strongest skill: <span className="text-gold">{RUBRIC[data.debrief.strongest].label}</span>
                </p>
              )}
              {data.debrief.weakest && (
                <p className="font-bold">
                  🎯 Skill to work on: <span className="text-gold">{RUBRIC[data.debrief.weakest].label}</span>
                </p>
              )}
              <p className="mt-2 text-sm font-bold text-white/75">{data.debrief.prompt}</p>
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
  const r = data.teamResults?.[teamId];
  const dest = view.sent.vote?.dest ?? null;
  const card: CardId | "none" = view.sent.vote?.card ?? "none";
  const send = (d: string, c: CardId | "none") => client.vote(d, c);

  if (!view.tiles) return <BigScreen teamId={teamId} text="Loading map…" />;
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-center font-display text-2xl">
        {r?.stageFright || !reach.length ? (
          <span className="text-sky-300">😰 Stage Fright — no movement this round</span>
        ) : (
          <>
            Where to? <span className="text-gold">{r?.mp ?? 0} MP</span>
          </>
        )}
      </p>
      <p className="text-center text-xs font-bold text-white/60">Tap a glowing hex. Dots are your teammates&apos; votes — majority wins.</p>
      <VoteMap
        tiles={view.tiles}
        teams={data.teams}
        teamId={teamId}
        reach={reach}
        tally={view.tally}
        selected={dest && dest !== "hold" ? dest : null}
        onSelect={(k) => send(k, card)}
        className="mx-auto my-1 max-h-[50dvh] min-h-[38dvh] w-full"
      />
      <button
        className="btn w-full text-lg text-white"
        style={{ background: dest === "hold" ? "#7c3aed" : "#334155", outline: dest === "hold" ? "3px solid #ffd54a" : "none" }}
        onClick={() => send("hold", card)}
      >
        ⚓ Hold position{view.tally.hold ? ` · ${view.tally.hold} vote${view.tally.hold > 1 ? "s" : ""}` : ""}
      </button>
      <CardRow cards={team.cards} selected={card} onSelect={(c) => send(dest ?? "hold", c)} />
      {dest && <p className="mt-2 text-center text-sm font-extrabold text-emerald-300">Vote in ✓ — you can change it until time runs out</p>}
    </div>
  );
}
