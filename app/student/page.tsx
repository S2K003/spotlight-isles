"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { GOOD_STEPS, GREAT_STEPS, MIN_STEPS, POINTS } from "@/config/balance";
import { SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { DUR } from "@/config/timeline";
import { PITCH_RECIPE, SPOTLIGHT_TOPICS } from "@/content/spotlight";
import { normalizeRoomCode } from "@/lib/engine/rng";

/** What each star rating means, so groups mark the same way. */
const STAR_SCALE: [string, string][] = [
  ["5", "excellent"],
  ["4", "good"],
  ["3", "OK"],
  ["2", "weak"],
  ["1", "not there yet"],
];

/** Printable one-page Student Guide. Use the browser's Print → Save as PDF. */
export default function StudentGuidePage() {
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setCode(normalizeRoomCode(new URLSearchParams(window.location.search).get("code") ?? ""));
  }, []);

  // A QR code is only printed when a room code is given; otherwise students scan the big screen.
  const url = origin && code.length === 4 ? `${origin}/play/${code}` : "";
  useEffect(() => {
    if (!url) {
      setQr("");
      return;
    }
    QRCode.toDataURL(url, { margin: 1, width: 500, errorCorrectionLevel: "M" }).then(setQr).catch(() => {});
  }, [url]);

  return (
    <div className="guide min-h-dvh bg-[#d8dbe8] py-4">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-sm text-[#151a2e] shadow">
        <strong>Student Guide</strong>
        <label className="flex items-center gap-1">
          Room code (optional, adds a QR):
          <input value={code} onChange={(e) => setCode(normalizeRoomCode(e.target.value))} maxLength={4} placeholder="none" className="w-20 rounded border border-gray-400 px-2 py-0.5 font-bold uppercase tracking-widest" />
        </label>
        <button onClick={() => window.print()} className="rounded bg-[#151a2e] px-3 py-1 font-bold text-white">
          Print / Save as PDF
        </button>
        <a href="/guide" className="underline">
          Facilitator guide
        </a>
        <span className="text-gray-600">A4 portrait, margins: none, background graphics: on.</span>
      </div>

      <section className="sheet" style={{ fontSize: "9.1pt", lineHeight: 1.3 }}>
        <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
          <h1 className="text-[26pt] leading-none">SPOTLIGHT ISLES</h1>
          <div className="text-right text-[9pt] font-bold">
            Student Guide<br />
            GSOE9010 Week 5 — Presentation Skills
          </div>
        </div>

        <p className="mt-2">
          <strong>What you&apos;ll do.</strong> A 15-minute game played in your project group, on your phones, with one big screen. Your group flies an airship across a small map by <strong>talking through questions about presenting</strong> and by giving <strong>one 40-second group pitch</strong>. No preparation or app is needed: just a phone with a browser.
        </p>

        <div className="mt-2 grid grid-cols-[1fr_auto] gap-4">
          <div>
            <h2 className="text-[13pt]">Join in 4 steps</h2>
            <ol className="ml-5 list-decimal">
              <li><strong>Scan the QR code</strong> on the big screen{qr ? " (or the one on this page)" : ""}, or open the web address shown and type the 4-letter room code.</li>
              <li>Type a <strong>nickname</strong>.</li>
              <li>Pick your <strong>group number</strong> ({TEAM_DEFS[0].name} to {TEAM_DEFS[5].name}). Each group has its own colour and symbol.</li>
              <li><strong>Sit with your group.</strong> The game only works if you can talk to each other.</li>
            </ol>
            <p className="mt-1">If your phone drops out, open the link again: you go straight back into your group.</p>
          </div>
          {qr && (
            <div className="text-center">
              <img src={qr} alt={`QR code for ${url}`} className="h-[34mm] w-[34mm] border-2 border-[#151a2e]" />
              <div className="font-display text-[16pt] leading-none tracking-[0.15em]">{code}</div>
            </div>
          )}
        </div>

        <h2 className="mt-2 text-[13pt]">The goal</h2>
        <div className="mt-1 flex items-center justify-center gap-2 rounded-lg border-2 border-[#151a2e] bg-[#eef1fb] px-3 py-2 text-center font-bold">
          <span className="rounded bg-white px-2 py-1">🏝️ Your home island</span>
          <span className="text-[14pt]">→</span>
          <span className="rounded bg-white px-2 py-1">🔑 Your key<br /><span className="text-[8pt] font-normal">on the opposite island</span></span>
          <span className="text-[14pt]">→</span>
          <span className="rounded bg-white px-2 py-1">🎤 The Keynote Stage<br /><span className="text-[8pt] font-normal">in the middle</span></span>
        </div>
        <p className="mt-1">Reach the Stage as early as you can. Every group can get there. The group with the most points at the end wins.</p>

        <h2 className="mt-2 text-[13pt]">The rules (all five)</h2>
        <ol className="ml-5 list-decimal">
          <li><strong>Every round, every group moves {MIN_STEPS} steps.</strong> Do well and you move {GOOD_STEPS}.</li>
          <li><strong>Moving takes one tap.</strong> Your phone shows the best hex in green: tap <strong>GO</strong>. You can pick a different hex (for example to grab a ⭐). If your group doesn&apos;t choose in time, your ship flies the best route by itself.</li>
          <li><strong>The group with the most points moves first.</strong> Ships never block each other.</li>
          <li><strong>The map:</strong> 🌊 water can&apos;t be crossed, so fly around it. A ⭐ gives {POINTS.star} points to the first ship over it.</li>
          <li><strong>You need your own 🔑 key</strong> before you can land on the Stage. Your phone shows where it is.</li>
        </ol>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-[13pt]">Question rounds (1, 3 and 5)</h2>
            <p>A scenario about presenting research appears with four options.</p>
            <ol className="ml-5 list-decimal">
              <li><strong>Talk first</strong> ({DUR.challenge} seconds). Say which option you&apos;d pick and why.</li>
              <li><strong>Agree on one answer,</strong> then everyone taps it. You can change your tap until time runs out.</li>
              <li>If <strong>half your group or more</strong> picks the best answer, you move {GOOD_STEPS} steps. Otherwise {MIN_STEPS}.</li>
            </ol>
            <p className="mt-1">There is no prize for being fast, so take the time to discuss.</p>
          </div>
          <div>
            <h2 className="text-[13pt]">Pitch rounds (2, 4 and 6)</h2>
            <p>A <strong>spin</strong> on the big screen picks two groups that haven&apos;t pitched yet. <strong>Every group pitches exactly once.</strong></p>
            <ol className="ml-5 list-decimal">
              <li>Your <strong>topic</strong> appears on the big screen and your phones.</li>
              <li><strong>{DUR.spotReady} seconds to prepare:</strong> choose one speaker and plan together.</li>
              <li><strong>{DUR.spotSpeak} seconds to speak,</strong> out loud, to the room.</li>
              <li>The other groups give you 1–5 stars.</li>
            </ol>
            <p className="mt-1">4★ or more: move {GREAT_STEPS}. 3★ or more: move {GOOD_STEPS}. Otherwise: move {MIN_STEPS}.</p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-[13pt]">Plan your {DUR.spotSpeak}-second pitch</h2>
            <table>
              <tbody>
                {PITCH_RECIPE.map(([label, hint], i) => (
                  <tr key={label}>
                    <th style={{ width: "30%" }}>{i + 1}. {label}</th>
                    <td>{hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="ml-4 mt-1 list-disc">
              <li>Open with the problem or a question, not with your name.</li>
              <li>Say <strong>one</strong> main thing. About 90–100 words is plenty.</li>
              <li>Pause instead of saying &ldquo;um&rdquo;. Look at the room.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-[13pt]">When you mark another group</h2>
            <p>Give 1–5 stars for each of these. Marking earns your group {POINTS.mark} points. You can&apos;t mark your own group.</p>
            <table className="mt-1">
              <tbody>
                {SPOTLIGHT_CRITERIA.map((c) => (
                  <tr key={c.key}>
                    <th style={{ width: "30%" }}>{c.label}</th>
                    <td>{c.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1">
              <strong>Stars:</strong> {STAR_SCALE.map(([n, text]) => `${n}★ ${text}`).join(" · ")}. Mark the pitch, not the person.
            </p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-[13pt]">Pitch topics you might get</h2>
            <ol className="ml-5 list-decimal">
              {SPOTLIGHT_TOPICS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <p className="mt-1">Each group gets a different one.</p>
          </div>
          <div>
            <h2 className="text-[13pt]">How points add up</h2>
            <table>
              <tbody>
                <tr><th>Each step you earn</th><td>{POINTS.perStep}</td></tr>
                <tr><th>Marking the pitches · your key · each ⭐</th><td>{POINTS.mark} each</td></tr>
                <tr><th>Reaching the Stage 1st / 2nd / 3rd / 4th</th><td>{POINTS.dock.slice(0, 4).join(" / ")}</td></tr>
              </tbody>
            </table>
            <p className="mt-1"><strong>At the end</strong> the big screen shows which questions the room found hardest and which pitch skill to work on, and you&apos;ll be asked for one thing you learned.</p>
          </div>
        </div>

        <p className="mt-2 border-t border-[#c9cfe3] pt-1 text-[8.2pt]">
          <strong>Good to know.</strong> The game lasts exactly 15 minutes. Only your nickname is collected, and nothing is stored after the session. Your phone stays silent; sound comes from the big screen.
        </p>
      </section>
    </div>
  );
}
