"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { POINTS } from "@/config/balance";
import { LEARNING_OBJECTIVES, RUBRIC, SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { DUR } from "@/config/timeline";
import { QUESTIONS } from "@/content/questions";
import { SPOTLIGHT_TOPICS } from "@/content/spotlight";
import { normalizeRoomCode } from "@/lib/engine/rng";
import { formatClock, TIMELINE } from "@/lib/engine/timeline";

const at = (id: string) => formatClock(TIMELINE.find((p) => p.id === id)?.startOffsetMs ?? 0);

/** Printable Facilitator Guide (2 pages) + question bank + QR poster. Use the browser's Print → Save as PDF. */
export default function GuidePage() {
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
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
  }, []);

  const url = origin ? (code.length === 4 ? `${origin}/play/${code}` : origin) : "";
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 900, errorCorrectionLevel: "M" }).then(setQr).catch(() => {});
  }, [url]);

  return (
    <div className="guide min-h-dvh bg-[#d8dbe8] py-4">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-sm text-[#151a2e] shadow">
        <strong>Facilitator Guide</strong>
        <label className="flex items-center gap-1">
          Room code for the poster:
          <input value={code} onChange={(e) => setCode(normalizeRoomCode(e.target.value))} maxLength={4} placeholder="none" className="w-20 rounded border border-gray-400 px-2 py-0.5 font-bold uppercase tracking-widest" />
        </label>
        <button onClick={() => window.print()} className="rounded bg-[#151a2e] px-3 py-1 font-bold text-white">
          Print / Save as PDF
        </button>
        <span className="text-gray-600">A4 portrait, margins: none, background graphics: on. Leave the code blank for a poster that links to the home page.</span>
      </div>

      {/* ---------- Page 1: plan, objectives, rules ---------- */}
      <section className="sheet" style={{ fontSize: "9.6pt", lineHeight: 1.34 }}>
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[26pt] leading-none">SPOTLIGHT ISLES</h1>
          <div className="text-right text-[9pt] font-bold">
            Facilitator Guide · page 1 of 2<br />
            GSOE9010 Week 5 — Presentation Skills (FC4)
          </div>
        </div>
        <p className="mt-2">
          <strong>What it is.</strong> A 15-minute team game played on phones with one projector screen. Six teams race their airships from their home island to the <strong>Keynote Stage</strong> in the middle of a small map. Movement is earned by <strong>talking through presentation questions as a team</strong> and by giving a short <strong>team pitch that the other teams mark with a rubric</strong>. It is deliberately unhurried: most of the time is discussion.
        </p>

        <h2 className="mt-3 text-[13pt]">Learning objectives</h2>
        <ol className="ml-5 list-decimal">
          {LEARNING_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>

        <h2 className="mt-3 text-[13pt]">The rules (this is all of them)</h2>
        <ol className="ml-5 list-decimal">
          <li><strong>Goal:</strong> fly to your team&apos;s 🔑 key, then to the 🎤 Keynote Stage. Your key is on the <strong>opposite island</strong>, so every team crosses the map.</li>
          <li><strong>Each round</strong> your team earns <strong>1–3 steps</strong>, then agrees where to fly (majority vote on phones).</li>
          <li><strong>Ships move one at a time, most points first.</strong> You can&apos;t land on a hex another ship is on (you stop one short). Last place gets a 🌬️ tailwind: +1 step.</li>
          <li><strong>The map:</strong> 🌊 water can&apos;t be crossed · ☁ fog costs 2 steps · ⭐ a star is worth {POINTS.star} points to the first team over it.</li>
          <li><strong>Points:</strong> {POINTS.perStep} per step earned · {POINTS.key} for your key · reaching the Stage pays {POINTS.dock.slice(0, 4).join(" / ")} by arrival order. Most points wins.</li>
        </ol>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-[13pt]">Question rounds (1, 3, 5)</h2>
            <p>One scenario about presenting research. The team <strong>discusses for {DUR.challenge} seconds</strong> and everyone taps the answer they agreed on (it can be changed until time runs out).</p>
            <table className="mt-1">
              <thead><tr><th>Share of the team correct</th><th>Steps</th><th>Points</th></tr></thead>
              <tbody>
                <tr><td>80–100%</td><td>3</td><td>30</td></tr>
                <tr><td>50–79%</td><td>2</td><td>20</td></tr>
                <tr><td>1–49%</td><td>1</td><td>10</td></tr>
                <tr><td>Nobody</td><td>1</td><td>0</td></tr>
              </tbody>
            </table>
            <p className="mt-1">There is no speed bonus, and every team always moves at least 1. A team of 1 is as strong as a team of 8.</p>
          </div>
          <div>
            <h2 className="text-[13pt]">Pitch rounds (2, 4, 6)</h2>
            <p>Two teams get a topic and <strong>{DUR.spotReady} seconds to choose a speaker and plan</strong>. Each speaks for {DUR.spotSpeak} seconds. Everyone else gives 1–5 stars for <strong>{SPOTLIGHT_CRITERIA.map((c) => c.label).join(", ")}</strong>. Every team pitches exactly once.</p>
            <table className="mt-1">
              <thead><tr><th>Who</th><th>Steps</th></tr></thead>
              <tbody>
                <tr><td>Pitching team: 4★ or more</td><td>3</td></tr>
                <tr><td>Pitching team: 3★ or more</td><td>2</td></tr>
                <tr><td>Pitching team: below 3★</td><td>1</td></tr>
                <tr><td>Audience team that marked fairly (within 0.5★ of the room)</td><td>3</td></tr>
                <tr><td>Audience team that marked</td><td>2</td></tr>
                <tr><td>Audience team that didn&apos;t mark</td><td>1</td></tr>
              </tbody>
            </table>
            <p className="mt-1">Teams can&apos;t mark themselves. With 5+ teams marking, the highest and lowest are dropped.</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-[13pt]">Where it fits (50-minute workshop)</h2>
            <table>
              <tbody>
                <tr><th>0:00</th><td>Agenda (2 min) — show the QR so people join early</td></tr>
                <tr><th>0:02</th><td>Activity One — Diagrams (15 min)</td></tr>
                <tr><th>0:17</th><td>Activity Two — Elevator Pitch (15 min)</td></tr>
                <tr><th>0:32</th><td><strong>Activity Three — SPOTLIGHT ISLES (15:00)</strong></td></tr>
                <tr><th>0:47</th><td>Closing (3 min) — uses the debrief screen</td></tr>
              </tbody>
            </table>
            <p className="mt-1">Seat each team together: the game only works if they can talk. The clock starts when the host presses START.</p>
          </div>
          <div>
            <h2 className="text-[13pt]">The 15:00 itinerary</h2>
            <table>
              <tbody>
                <tr><th>00:00</th><td>Intro: the rules in three cards ({DUR.intro} s)</td></tr>
                <tr><th>{at("r1-challenge")}</th><td>Round 1 — team question</td></tr>
                <tr><th>{at("r2-ready")}</th><td><strong>Round 2 — pitches:</strong> Teams 1 &amp; 2</td></tr>
                <tr><th>{at("r3-challenge")}</th><td>Round 3 — team question</td></tr>
                <tr><th>{at("r4-ready")}</th><td><strong>Round 4 — pitches:</strong> Teams 3 &amp; 4</td></tr>
                <tr><th>{at("r5-challenge")}</th><td>Round 5 — team question</td></tr>
                <tr><th>{at("r6-ready")}</th><td><strong>Round 6 — pitches:</strong> Teams 5 &amp; 6</td></tr>
                <tr><th>{at("results")}</th><td>Results and podium ({DUR.results} s)</td></tr>
                <tr><th>{at("debrief")}</th><td>Debrief ({DUR.debrief} s) → GAME OVER at 15:00</td></tr>
              </tbody>
            </table>
            <p className="mt-1">After every round: {DUR.vote} s to agree where to fly, then the ships move.</p>
          </div>
        </div>

        <p className="mt-3">
          <strong>Teams:</strong> {TEAM_DEFS.map((t) => `${t.emblem} ${t.name}`).join(" · ")}. Each has its own colour <em>and</em> emblem shape. Rename them to the real project-group names in the lobby (click a name). The map is the same shape for every team, so nobody starts with an advantage.
        </p>
      </section>

      {/* ---------- Page 2: roles, run sheet, checklist ---------- */}
      <section className="sheet" style={{ fontSize: "9.4pt", lineHeight: 1.32 }}>
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[20pt] leading-none">Run sheet</h1>
          <div className="text-right text-[9pt] font-bold">Facilitator Guide · page 2 of 2</div>
        </div>

        <h2 className="mt-3 text-[13pt]">Roles (4 facilitators)</h2>
        <table>
          <thead><tr><th>Role</th><th>Job</th></tr></thead>
          <tbody>
            <tr><td><strong>Game Master (MC)</strong></td><td>On the mic: explains the three rules, reads every question aloud, introduces each pitch, leads the debrief.</td></tr>
            <tr><td><strong>Tech Operator</strong></td><td>Runs <code>/host</code> on the projector laptop, watches connections, ready to switch to Manual Mode.</td></tr>
            <tr><td><strong>Floor Coach A</strong></td><td>Teams 1–3: helps people join, gets quiet members talking, helps pitching teams choose a speaker.</td></tr>
            <tr><td><strong>Floor Coach B</strong></td><td>Teams 4–6: same as Coach A.</td></tr>
          </tbody>
        </table>

        <h2 className="mt-3 text-[13pt]">Live script (key cues)</h2>
        <table>
          <thead><tr><th style={{ width: "15%" }}>When</th><th style={{ width: "11%" }}>Who</th><th>Cue</th></tr></thead>
          <tbody>
            <tr><td>Before START</td><td>Coaches</td><td>&ldquo;Scan the QR, pick your project group&apos;s team, and sit together.&rdquo;</td></tr>
            <tr><td>00:00</td><td>MC</td><td>&ldquo;Welcome to Spotlight Isles! Find your key on the far island, then race to the Keynote Stage. You earn steps by talking through questions and by pitching. Most points moves first.&rdquo;</td></tr>
            <tr><td>Question rounds</td><td>MC</td><td>Read the question aloud. &ldquo;You have 45 seconds. Talk first, tap second. Agree on one answer.&rdquo;</td></tr>
            <tr><td>Question rounds</td><td>Coaches</td><td>Ask a quiet member: &ldquo;Which one would you pick, and why?&rdquo;</td></tr>
            <tr><td>Each reveal</td><td>MC</td><td>Read the &ldquo;why&rdquo; line. It is the teaching point of the round.</td></tr>
            <tr><td>Each vote</td><td>Coaches</td><td>&ldquo;Have you got your key yet? Who moves before you? Agree, then tap together.&rdquo;</td></tr>
            <tr><td>Each move</td><td>MC</td><td>Commentate: &ldquo;Tide moves first… Ember was heading for the same hex and gets bumped!&rdquo;</td></tr>
            <tr><td>{at("r2-ready")}, {at("r4-ready")}, {at("r6-ready")}</td><td>MC</td><td>&ldquo;Pitch round! [Team A] and [Team B], your topic is on your phones. Thirty seconds: choose a speaker and plan a hook, one clear message and a confident finish.&rdquo; Lead applause after each pitch. &ldquo;Everyone else, mark fairly.&rdquo;</td></tr>
            <tr><td>{at("results")}</td><td>MC</td><td>Hype the podium and the Best Pitch award.</td></tr>
            <tr><td>{at("debrief")}</td><td>MC</td><td>Point to the hardest question and the pitch skill to work on. Link them to the objectives.</td></tr>
            <tr><td>15:00</td><td>MC</td><td>&ldquo;Game over! In one sentence: what&apos;s one thing you learned today?&rdquo; → into the Closing.</td></tr>
          </tbody>
        </table>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-[13pt]">Checklist</h2>
            <ul className="ml-4 list-disc">
              <li><strong>1 week before:</strong> deploy; run a bot rehearsal (<code>/dev/bots</code>).</li>
              <li><strong>3 days before:</strong> rehearse with all 4 facilitators on phones; practise the script.</li>
              <li><strong>1 day before:</strong> full 15-minute dry run; print the QR poster (one per table); export this guide as a PDF.</li>
              <li><strong>On the day (15 min early):</strong> test Wi-Fi with several phones; laptop on charge, sleep off, notifications off; projector at 1080p; sound check; open the lobby during the Agenda.</li>
              <li><strong>During:</strong> keep the host tab visible and in front. If it reloads, it resumes on the same clock. Emergency pause: long-press the clock.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-[13pt]">If the Wi-Fi fails: Manual Mode</h2>
            <ol className="ml-4 list-decimal">
              <li>Tick <strong>Manual Mode</strong> in the lobby before START.</li>
              <li>MC reads each question; teams discuss, then answer by <strong>show of hands</strong>.</li>
              <li>When the answer shows, the operator clicks how much of each team got it: None / A few / About half / Most.</li>
              <li>In the vote, click each team (they are listed in move order) and then its destination on the map panel.</li>
              <li>Pitches: click 1–5 stars from the room&apos;s applause.</li>
            </ol>
            <p className="mt-1">Other backups: a facilitator hotspot for the laptop; the printed question bank (next page).</p>
          </div>
        </div>

        <h2 className="mt-3 text-[13pt]">Pitch topics (each team gets a different one)</h2>
        <ol className="ml-5 list-decimal columns-2 gap-6">
          {SPOTLIGHT_TOPICS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>

        <h2 className="mt-3 text-[13pt]">Debrief → Closing</h2>
        <p>The final screen shows how the room did on each question (hardest first), the room&apos;s average stars for Hook, Clarity and Confidence, the pitch skill to work on, and three takeaways. Ask: <em>&ldquo;Tell us one thing you learned, or something you liked about today.&rdquo;</em></p>
        <p className="mt-1">Privacy: only nicknames are collected and nothing is stored after the session.</p>
      </section>

      {/* ---------- Extra: question bank (printed backup) ---------- */}
      <section className="sheet" style={{ fontSize: "9.2pt", lineHeight: 1.3 }}>
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[18pt] leading-none">Question bank</h1>
          <div className="text-right text-[9pt] font-bold">Printed backup · three are drawn per game · ✔ = best answer</div>
        </div>
        <p className="mt-2">Scenarios about presenting research, written for GSOE9010. Each is a judgement call for the team to talk through. Edit them in <code>content/questions.ts</code>.</p>
        <div className="mt-2 columns-2 gap-5">
          {QUESTIONS.map((q) => (
            <div key={q.id} className="mb-3 break-inside-avoid">
              <div>
                <strong>{q.id}</strong> <span className="text-[8pt] uppercase tracking-wider text-gray-600">{RUBRIC[q.criterion].label}</span>
              </div>
              <div className="font-bold">{q.prompt} {q.slide ? <em className="font-normal">(shown with a text-heavy mock slide)</em> : null}</div>
              <ul className="ml-4 list-disc">
                {q.options.map((o, i) => (
                  <li key={i}>{i === q.correct ? <strong>✔ {o}</strong> : o}</li>
                ))}
              </ul>
              <div><em>Why: {q.why}</em></div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- QR poster ---------- */}
      <section className="sheet flex flex-col items-center text-center">
        <h1 className="mt-6 text-[54pt] leading-none">SPOTLIGHT ISLES</h1>
        <p className="mt-2 text-[18pt] font-extrabold">Scan to join your team&apos;s airship crew</p>
        <div className="mt-6 grid h-[130mm] w-[130mm] place-items-center border-[6px] border-[#151a2e] p-3">{qr ? <img src={qr} alt={`QR code for ${url}`} className="h-full w-full" /> : null}</div>
        <p className="mt-5 text-[14pt] font-bold">or open</p>
        <p className="break-all text-[20pt] font-extrabold">{origin.replace(/^https?:\/\//, "") || "your game address"}</p>
        {code.length === 4 ? (
          <>
            <p className="mt-3 text-[14pt] font-bold">and enter room code</p>
            <p className="font-display text-[72pt] leading-none tracking-[0.2em]">{code}</p>
          </>
        ) : (
          <p className="mt-3 text-[14pt] font-bold">and enter the 4-letter code shown on the big screen</p>
        )}
        <div className="mt-auto flex gap-5 pb-4 text-[13pt] font-extrabold">
          {TEAM_DEFS.map((t) => (
            <span key={t.id}>{t.emblem} {t.name}</span>
          ))}
        </div>
        <p className="pb-2 text-[10pt]">1. Scan · 2. Type a nickname · 3. Pick your project group&apos;s team · 4. Sit together and wait for START</p>
      </section>
    </div>
  );
}
