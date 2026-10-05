"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CARD_INFO } from "@/config/balance";
import { CRITERIA, LEARNING_OBJECTIVES, RUBRIC } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { FINAL_POOL, QUESTIONS } from "@/content/questions";
import { SPOTLIGHT_TOPICS, SPOTLIGHT_TWISTS } from "@/content/spotlight";
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
      <section className="sheet">
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[26pt] leading-none">SPOTLIGHT ISLES</h1>
          <div className="text-right text-[9pt] font-bold">
            Facilitator Guide · page 1 of 2<br />
            GSOE9010 Week 5 — Presentation Skills (FC4)
          </div>
        </div>
        <p className="mt-2">
          <strong>What it is.</strong> A 15-minute, 6-team, real-time strategy game played on phones with one projector screen. Each island region is a <strong>presentation marking criterion</strong>. Teams answer a presentation-skills challenge to earn movement, vote on where their airship flies, and paint territory. Three <strong>Spotlight rounds</strong> put two players on the spot for a live 20-second pitch, which every other team <strong>marks with a rubric</strong>. The game ends at exactly 15:00 with a data-driven debrief that feeds the Closing.
        </p>

        <h2 className="mt-2 text-[11pt]">Learning objectives</h2>
        <ol className="ml-5 list-decimal">
          {LEARNING_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <h2 className="text-[11pt]">Where it fits (50-minute workshop)</h2>
            <table>
              <tbody>
                <tr><th>0:00</th><td>Agenda (2 min) — show the QR so people join early</td></tr>
                <tr><th>0:02</th><td>Activity One — Diagrams (15 min)</td></tr>
                <tr><th>0:17</th><td>Activity Two — Elevator Pitch (15 min, prep cut to 10)</td></tr>
                <tr><th>0:32</th><td><strong>Activity Three — SPOTLIGHT ISLES (15:00)</strong></td></tr>
                <tr><th>0:47</th><td>Closing (3 min) — uses the debrief screen</td></tr>
              </tbody>
            </table>
            <p className="mt-1 text-[7.8pt]">The lobby is open beforehand and does not count. The clock starts when the host presses START.</p>
          </div>
          <div>
            <h2 className="text-[11pt]">The 15:00 itinerary</h2>
            <table>
              <tbody>
                <tr><th>00:00</th><td>Intro + how to play (40 s)</td></tr>
                <tr><th>{at("r1-challenge")}</th><td>Rounds 1–2: Structure, Visuals</td></tr>
                <tr><th>{at("r3-ready")}</th><td><strong>Round 3 SPOTLIGHT</strong> — Teams 1 &amp; 2</td></tr>
                <tr><th>{at("r4-challenge")}</th><td>Rounds 4–5: Delivery, Engagement</td></tr>
                <tr><th>{at("r6-ready")}</th><td><strong>Round 6 SPOTLIGHT</strong> — Teams 3 &amp; 4</td></tr>
                <tr><th>{at("r7-challenge")}</th><td>Rounds 7–8: Timing, Q&amp;A</td></tr>
                <tr><th>{at("r9-ready")}</th><td><strong>Round 9 SPOTLIGHT</strong> — Teams 5 &amp; 6</td></tr>
                <tr><th>{at("r10-challenge")}</th><td>Rounds 10–12: the room&apos;s weakest criteria</td></tr>
                <tr><th>{at("final-banner")}</th><td>Final Showdown: Keynote Stage (75 s)</td></tr>
                <tr><th>{at("results")}</th><td>Results ceremony (60 s)</td></tr>
                <tr><th>{at("debrief")}</th><td>Debrief (50 s) → GAME OVER at 15:00</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="mt-2 text-[11pt]">Rules in brief</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p><strong>Standard round (46 s):</strong> Challenge 20 → Reveal 6 → Team Vote 12 → Move 8.</p>
            <table className="mt-1">
              <thead><tr><th>Team accuracy</th><th>Movement points</th></tr></thead>
              <tbody>
                <tr><td>0% (or nobody answered)</td><td>0 — STAGE FRIGHT</td></tr>
                <tr><td>1–49%</td><td>1</td></tr>
                <tr><td>50–79%</td><td>2</td></tr>
                <tr><td>80–100%</td><td>3</td></tr>
                <tr><td>Fastest team with ≥50%</td><td>+1 Quick Draw</td></tr>
              </tbody>
            </table>
            <p className="mt-1">Accuracy = correct ÷ connected members, so a team of 1 is as strong as a team of 8. The team&apos;s <strong>majority vote</strong> picks the destination. Every hex crossed is painted. Two teams on the same hex = <strong>CLASH</strong>: the better round score wins it, the other stops one hex short.</p>
            <p className="mt-1"><strong>Score</strong> = tiles × 10 + 50 per region mastered (most tiles, min. 5) + 100 for the Keynote Stage.</p>
          </div>
          <div>
            <p><strong>Spotlight round (87 s):</strong> Ready 5 → Speaker A 20 → Rate 8 → Speaker B 20 → Rate 8 → Scorecards 6 → Vote 12 → Move 8.</p>
            <p className="mt-1">Raters give 1–5 stars for <strong>Hook, Clarity, Confidence</strong>. No self-team rating; with 5+ teams rating, the highest and lowest team averages are dropped. Speakers earn 1–4 MP (≥4.2 → 4, ≥3.5 → 3, ≥2.5 → 2, else 1). Other teams get 2 MP, +1 <strong>Fair Judge</strong> if within 0.5 of the room average for both speakers.</p>
            <table className="mt-1">
              <thead><tr><th>Tile / card</th><th>Effect</th></tr></thead>
              <tbody>
                <tr><td>Filler-Word Fog ☁</td><td>Costs 2 MP to enter</td></tr>
                <tr><td>Death-by-PowerPoint Swamp</td><td>End here: −1 MP next round</td></tr>
                <tr><td>Water / other homes</td><td>Impassable</td></tr>
                <tr><td>Treasure chest 🎁</td><td>Land here: one power card (hold 2)</td></tr>
                {Object.values(CARD_INFO).map((c) => (
                  <tr key={c.name}><td>{c.icon} {c.name}</td><td>{c.text}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="mt-2 text-[11pt]">The map: six regions, six criteria, six teams</h2>
        <table>
          <thead><tr><th>Region</th><th>Criterion</th><th>What the questions teach</th><th>Home team</th></tr></thead>
          <tbody>
            {CRITERIA.map((c, i) => (
              <tr key={c}>
                <td>{RUBRIC[c].icon} {RUBRIC[c].region}</td>
                <td><strong>{RUBRIC[c].label}</strong></td>
                <td>{RUBRIC[c].blurb}</td>
                <td>{TEAM_DEFS[i].emblem} {TEAM_DEFS[i].name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[7.8pt]">Teams are identified by colour <em>and</em> emblem shape. Rename the six teams to the real project-group names in the lobby (click a name).</p>
      </section>

      {/* ---------- Page 2: roles, run sheet, checklist ---------- */}
      <section className="sheet">
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[20pt] leading-none">Run sheet</h1>
          <div className="text-right text-[9pt] font-bold">Facilitator Guide · page 2 of 2</div>
        </div>

        <h2 className="mt-2 text-[11pt]">Roles (4 facilitators)</h2>
        <table>
          <thead><tr><th>Role</th><th>Job</th></tr></thead>
          <tbody>
            <tr><td><strong>Game Master (MC)</strong></td><td>On the mic: narrates, builds hype, reads every challenge aloud (accessibility), hosts the Spotlight moments, leads the debrief.</td></tr>
            <tr><td><strong>Tech Operator</strong></td><td>Runs <code>/host</code> on the projector laptop, watches connections, handles reconnects, ready to switch to Manual Mode.</td></tr>
            <tr><td><strong>Floor Coach A</strong></td><td>Teams 1–3: helps people join, pushes discussion during votes, cheers the speakers.</td></tr>
            <tr><td><strong>Floor Coach B</strong></td><td>Teams 4–6: same as Coach A.</td></tr>
          </tbody>
        </table>

        <h2 className="mt-2 text-[11pt]">Live script (key cues)</h2>
        <table>
          <thead><tr><th style={{ width: "13%" }}>Clock</th><th style={{ width: "11%" }}>Who</th><th>Cue</th></tr></thead>
          <tbody>
            <tr><td>Before START</td><td>Coaches</td><td>&ldquo;Scan the QR on the screen, pick your project group&apos;s team, and wait on the cloud.&rdquo;</td></tr>
            <tr><td>00:00</td><td>MC</td><td>&ldquo;Welcome to Spotlight Isles! Every region is a presentation marking criterion. Win challenges to move further, and your team votes on where to go. We finish at exactly 15:00.&rdquo;</td></tr>
            <tr><td>Each Challenge</td><td>MC</td><td>Reads the question aloud and counts down the last 5 seconds.</td></tr>
            <tr><td>Each Vote</td><td>Coaches</td><td>&ldquo;Talk to your team, decide fast, tap together!&rdquo;</td></tr>
            <tr><td>Each Move</td><td>MC</td><td>Sports-caster commentary: &ldquo;TIDE and EMBER are going for the same tile… CLASH!&rdquo;</td></tr>
            <tr><td>{at("r3-ready")}, {at("r6-ready")}, {at("r9-ready")}</td><td>MC</td><td>&ldquo;Lights up on… [name]! Twenty seconds, make us care!&rdquo; Lead applause after each speaker. &ldquo;Mark them fairly: Hook, Clarity, Confidence.&rdquo;</td></tr>
            <tr><td>{at("final-banner")}</td><td>MC</td><td>&ldquo;Night falls… FINAL SHOWDOWN for the Keynote Stage!&rdquo;</td></tr>
            <tr><td>{at("results")}</td><td>MC</td><td>Hype the podium and read the four award winners.</td></tr>
            <tr><td>{at("debrief")}</td><td>MC</td><td>Read the strongest and weakest skill from the debrief and link them to the objectives.</td></tr>
            <tr><td>15:00</td><td>MC</td><td>&ldquo;Game over! Now, in one sentence: what&apos;s one thing you learned today?&rdquo; → into the Closing.</td></tr>
          </tbody>
        </table>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <h2 className="text-[11pt]">Checklist</h2>
            <ul className="ml-4 list-disc">
              <li><strong>1 week before:</strong> deploy; run a full bot rehearsal (<code>/dev/bots</code>).</li>
              <li><strong>3 days before:</strong> rehearse with all 4 facilitators on phones; practise the script; time it.</li>
              <li><strong>1 day before:</strong> full 15-minute dry run; print the QR poster (one per table); export this guide as a PDF.</li>
              <li><strong>On the day (15 min early):</strong> test Wi-Fi with several phones; laptop on charge, sleep off, notifications off; projector at 1080p; sound check; open the lobby during the Agenda.</li>
              <li><strong>During:</strong> keep the host tab visible and in front. If it reloads, it resumes on the same clock.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-[11pt]">If the Wi-Fi fails: Manual Mode</h2>
            <ol className="ml-4 list-decimal">
              <li>Tick <strong>Manual Mode</strong> in the lobby (or keep playing; it can be switched on before START).</li>
              <li>MC reads each question; teams answer by <strong>show of hands</strong>.</li>
              <li>Operator clicks each team&apos;s accuracy band (0 / 1–49 / 50–79 / 80+) and the ⚡ Quick Draw team.</li>
              <li>In the vote, pick each team and click its destination on the map panel.</li>
              <li>Spotlight: a volunteer speaks; click 1–5 stars from the room&apos;s applause.</li>
              <li>Final: click TRUE/FALSE for each team&apos;s hands.</li>
            </ol>
            <p className="mt-1 text-[7.8pt]">Other backups: a facilitator hotspot for the laptop; the printed question bank (next page). Emergency pause: long-press the clock.</p>
          </div>
        </div>

        <h2 className="mt-2 text-[11pt]">Spotlight prompts</h2>
        <p><strong>Topics:</strong> {SPOTLIGHT_TOPICS.join(" · ")}</p>
        <p className="mt-1"><strong>Twists:</strong> {SPOTLIGHT_TWISTS.join(" · ")}</p>

        <h2 className="mt-2 text-[11pt]">Debrief → Closing</h2>
        <p>The final screen shows a radar of room-wide accuracy per criterion, the Spotlight averages, the strongest skill, the skill to work on, and three takeaways taken from the questions the room got most wrong. Ask: <em>&ldquo;Tell us one thing you learned, or something you liked about today.&rdquo;</em></p>
        <p className="mt-1 text-[7.8pt]">Privacy: only nicknames are collected and nothing is stored after the session.</p>
      </section>

      {/* ---------- Extra: question bank (printed backup) ---------- */}
      <section className="sheet" style={{ fontSize: "7.5pt", lineHeight: 1.2 }}>
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[18pt] leading-none">Question bank (mapped to criteria)</h1>
          <div className="text-right text-[9pt] font-bold">Printed backup · ✔ = correct answer</div>
        </div>
        <div className="mt-2 columns-2 gap-4">
          {CRITERIA.map((c) => (
            <div key={c} className="mb-2 break-inside-avoid-column">
              <h3 className="text-[11pt]">{RUBRIC[c].icon} {RUBRIC[c].label}</h3>
              {QUESTIONS.filter((q) => q.criterion === c).map((q) => (
                <div key={q.id} className="mb-1 break-inside-avoid">
                  <strong>{q.id}.</strong> {q.prompt} {q.slide ? <em>(shown with a mock slide: “{q.slide.title}”)</em> : null}
                  {q.type === "order" ? (
                    <div>✔ Order: {q.options.map((o, i) => `(${i + 1}) ${o}`).join(" → ")}</div>
                  ) : (
                    <div>{q.options.map((o, i) => <span key={i}>{i === q.correct ? <strong>✔ {o}</strong> : o}{i < q.options.length - 1 ? " · " : ""}</span>)}</div>
                  )}
                  <div><em>Why: {q.why}</em></div>
                </div>
              ))}
            </div>
          ))}
          <div className="break-inside-avoid-column">
            <h3 className="text-[11pt]">🌙 Final Showdown (true / false, 3 drawn at random)</h3>
            {FINAL_POOL.map((q) => (
              <div key={q.id} className="mb-0.5">
                <strong>{q.id}.</strong> {q.statement} → <strong>{q.answer ? "True" : "False"}</strong>. <em>{q.why}</em>
              </div>
            ))}
          </div>
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
        <div className="mt-auto flex gap-5 pb-4 text-[11pt] font-extrabold">
          {TEAM_DEFS.map((t) => (
            <span key={t.id}>{t.emblem} {t.name}</span>
          ))}
        </div>
        <p className="pb-2 text-[10pt]">1. Scan · 2. Type a nickname · 3. Pick your project group&apos;s team · 4. Wait for START</p>
      </section>
    </div>
  );
}
