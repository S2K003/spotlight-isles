"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { GOOD_STEPS, GREAT_STEPS, MIN_STEPS, POINTS } from "@/config/balance";
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
        <a href="/student" className="underline">
          Student guide
        </a>
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
      <section className="sheet" style={{ fontSize: "10pt", lineHeight: 1.36 }}>
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[26pt] leading-none">SPOTLIGHT ISLES</h1>
          <div className="text-right text-[9pt] font-bold">
            Facilitator Guide · page 1 of 2<br />
            GSOE9010 Week 5 — Presentation Skills (FC4)
          </div>
        </div>
        <p className="mt-2">
          <strong>What it is.</strong> A 15-minute team game played on phones with one projector screen. Six groups fly their airships from their home island to the <strong>Keynote Stage</strong> in the middle of a small map. They move by <strong>talking through presentation questions as a group</strong> and by giving a <strong>40-second group pitch that the other groups mark</strong>. Every group pitches once and every group can reach the Stage.
        </p>

        <h2 className="mt-3 text-[13pt]">Learning objectives</h2>
        <ol className="ml-5 list-decimal">
          {LEARNING_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>

        <h2 className="mt-3 text-[13pt]">The rules (this is all of them)</h2>
        <ol className="ml-5 list-decimal">
          <li><strong>The goal:</strong> fly to your group&apos;s 🔑 key (it is on the opposite island), then to the 🎤 Keynote Stage in the middle.</li>
          <li><strong>Every round every group moves {MIN_STEPS} steps.</strong> Get the question right or give a good pitch and you move <strong>{GOOD_STEPS}</strong> (a great pitch: {GREAT_STEPS}).</li>
          <li><strong>Moving is one tap.</strong> The phone shows the best hex in green; tap GO. A group that doesn&apos;t choose still flies the best route.</li>
          <li><strong>The group with the most points moves first.</strong> Ships never block each other. Moving first only matters for ⭐ stars ({POINTS.star} points to the first ship over one) and for arriving first.</li>
          <li><strong>Points:</strong> {POINTS.perStep} per step earned · {POINTS.key} for your key · reaching the Stage pays {POINTS.dock.slice(0, 4).join(" / ")}… by arrival order. Most points wins.</li>
        </ol>
        <p className="mt-1">Water can&apos;t be crossed, so the route bends. The map is the same shape for every group, and the route is 11–12 steps, so <strong>a group that keeps tapping GO always reaches the Stage by the last round</strong>; groups that answer and pitch well get there sooner.</p>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-[13pt]">Question rounds (1, 3, 5)</h2>
            <p>One scenario about presenting research. The group <strong>discusses for {DUR.challenge} seconds</strong> and everyone taps the answer they agreed on (it can be changed until time runs out).</p>
            <table className="mt-1">
              <thead><tr><th>Result</th><th>Steps</th></tr></thead>
              <tbody>
                <tr><td>Half the group or more chose the best answer</td><td>{GOOD_STEPS}</td></tr>
                <tr><td>Fewer than half</td><td>{MIN_STEPS}</td></tr>
              </tbody>
            </table>
            <p className="mt-1">There is no speed bonus. A group of 1 is as strong as a group of 8.</p>
          </div>
          <div>
            <h2 className="text-[13pt]">Pitch rounds (2, 4, 6)</h2>
            <p>A <strong>spin</strong> picks two groups that haven&apos;t pitched yet. Each gets a <strong>topic on the big screen</strong>, {DUR.spotReady} seconds to choose a speaker and prepare, then <strong>{DUR.spotSpeak} seconds to speak</strong>. The others give 1–5 stars for {SPOTLIGHT_CRITERIA.map((c) => c.label).join(", ")}.</p>
            <table className="mt-1">
              <thead><tr><th>Who</th><th>Steps</th></tr></thead>
              <tbody>
                <tr><td>Pitching group: 4★ or more</td><td>{GREAT_STEPS}</td></tr>
                <tr><td>Pitching group: 3★ or more</td><td>{GOOD_STEPS}</td></tr>
                <tr><td>Pitching group: below 3★</td><td>{MIN_STEPS}</td></tr>
                <tr><td>Every other group (+{POINTS.mark} points for marking)</td><td>{MIN_STEPS}</td></tr>
              </tbody>
            </table>
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
            <p className="mt-1">Seat each group together: the game only works if they can talk. The clock starts when the host presses START and always ends at exactly 15:00.</p>
          </div>
          <div>
            <h2 className="text-[13pt]">The 15:00 itinerary</h2>
            <table>
              <tbody>
                <tr><th>00:00</th><td>Intro: the rules in three cards ({DUR.intro} s)</td></tr>
                <tr><th>{at("r1-challenge")}</th><td>Round 1 — group question</td></tr>
                <tr><th>{at("r2-ready")}</th><td><strong>Round 2 — spin + two pitches</strong></td></tr>
                <tr><th>{at("r3-challenge")}</th><td>Round 3 — group question</td></tr>
                <tr><th>{at("r4-ready")}</th><td><strong>Round 4 — spin + two pitches</strong></td></tr>
                <tr><th>{at("r5-challenge")}</th><td>Round 5 — group question</td></tr>
                <tr><th>{at("r6-ready")}</th><td><strong>Round 6 — the last two groups pitch</strong></td></tr>
                <tr><th>{at("results")}</th><td>Results and podium ({DUR.results} s)</td></tr>
                <tr><th>{at("debrief")}</th><td>Debrief ({DUR.debrief} s) → GAME OVER at 15:00</td></tr>
              </tbody>
            </table>
            <p className="mt-1">After every round: {DUR.vote} s to tap GO, then the ships fly.</p>
          </div>
        </div>

        <p className="mt-3">
          <strong>Groups:</strong> {TEAM_DEFS.map((t) => `${t.emblem} ${t.name}`).join(" · ")}. Each has its own colour <em>and</em> emblem shape. You can rename a group in the lobby by clicking its name.
        </p>
      </section>

      {/* ---------- Page 2: roles, run sheet, checklist ---------- */}
      <section className="sheet" style={{ fontSize: "9.6pt", lineHeight: 1.33 }}>
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[20pt] leading-none">Run sheet</h1>
          <div className="text-right text-[9pt] font-bold">Facilitator Guide · page 2 of 2</div>
        </div>

        <h2 className="mt-3 text-[13pt]">Roles (4 facilitators)</h2>
        <table>
          <thead><tr><th>Role</th><th>Job</th></tr></thead>
          <tbody>
            <tr><td><strong>Game Master (MC)</strong></td><td>On the mic: explains the goal, reads every question and pitch topic aloud, introduces each pitch, leads the debrief.</td></tr>
            <tr><td><strong>Tech Operator</strong></td><td>Runs <code>/host</code> on the projector laptop, watches connections, ready to switch to Manual Mode.</td></tr>
            <tr><td><strong>Floor Coach A</strong></td><td>Groups 1–3: helps people join, gets quiet members talking, helps pitching groups choose a speaker.</td></tr>
            <tr><td><strong>Floor Coach B</strong></td><td>Groups 4–6: same as Coach A.</td></tr>
          </tbody>
        </table>

        <h2 className="mt-3 text-[13pt]">Live script (key cues)</h2>
        <table>
          <thead><tr><th style={{ width: "15%" }}>When</th><th style={{ width: "11%" }}>Who</th><th>Cue</th></tr></thead>
          <tbody>
            <tr><td>Before START</td><td>Coaches</td><td>&ldquo;Scan the QR, pick your group number, and sit together.&rdquo;</td></tr>
            <tr><td>00:00</td><td>MC</td><td>&ldquo;Welcome to Spotlight Isles! Your goal: get your key from the far island, then reach the Keynote Stage. You move every round, and further when you answer or pitch well.&rdquo;</td></tr>
            <tr><td>Question rounds</td><td>MC</td><td>Read the question aloud. &ldquo;You have 45 seconds. Talk first, tap second. Agree on one answer.&rdquo;</td></tr>
            <tr><td>Question rounds</td><td>Coaches</td><td>Ask a quiet member: &ldquo;Which one would you pick, and why?&rdquo;</td></tr>
            <tr><td>Each reveal</td><td>MC</td><td>Read the &ldquo;why&rdquo; line. It is the teaching point of the round.</td></tr>
            <tr><td>Each move</td><td>MC</td><td>&ldquo;Tap GO on your phone!&rdquo; Then commentate: &ldquo;Group 3 has its key… Group 5 reaches the Stage first!&rdquo;</td></tr>
            <tr><td>{at("r2-ready")}, {at("r4-ready")}, {at("r6-ready")}</td><td>MC</td><td>&ldquo;Spin time! … Group X and Group Y, here are your topics.&rdquo; Read both topics aloud. &ldquo;You have 48 seconds: choose a speaker, plan a hook, one clear message and a confident finish.&rdquo;</td></tr>
            <tr><td>Each pitch</td><td>MC</td><td>&ldquo;Group X, 40 seconds, go!&rdquo; Lead applause at the end. &ldquo;Everyone else: mark it now.&rdquo;</td></tr>
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
              <li>MC reads each question; groups discuss, then answer by <strong>show of hands</strong>.</li>
              <li>When the answer shows, click for each group: &ldquo;half or more got it&rdquo; or &ldquo;fewer than half&rdquo;.</li>
              <li>Ships fly the best route by themselves. Click a destination only if a group asks for a different hex.</li>
              <li>Pitches: the spin and topics work the same. Click 1–5 stars from the room&apos;s applause.</li>
            </ol>
            <p className="mt-1">Other backups: a facilitator hotspot for the laptop; the printed question bank (next page).</p>
          </div>
        </div>

        <h2 className="mt-3 text-[13pt]">Pitch topics (each group gets a different one, shown on the big screen)</h2>
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
        <p className="mt-2">Scenarios about presenting research, written for GSOE9010. Each is a judgement call for the group to talk through. Edit them in <code>content/questions.ts</code>.</p>
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
        <p className="mt-2 text-[18pt] font-extrabold">Scan to join your group&apos;s airship crew</p>
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
        <p className="pb-2 text-[10pt]">1. Scan · 2. Type a nickname · 3. Pick your group · 4. Sit together and wait for START</p>
      </section>
    </div>
  );
}
