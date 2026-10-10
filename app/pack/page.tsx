"use client";

import { GuideDoc } from "@/components/print/GuideDoc";
import { PlanDoc } from "@/components/print/PlanDoc";
import { PrintBar, useJoin } from "@/components/print/PrintBar";
import { SlidesHandout } from "@/components/print/Slides";
import { StudentDoc } from "@/components/print/StudentDoc";
import { useWorkshop } from "@/components/print/workshop";

/**
 * Everything for the Moodle upload as ONE document: cover, workshop plan, slides, facilitator
 * guide with the question bank, and the student handout. Print → Save as PDF.
 */
export default function PackPage() {
  const ctx = useJoin();
  const { get } = useWorkshop();
  return (
    <div className="guide pack min-h-dvh bg-[#d8dbe8] py-4">
      <PrintBar title="Upload pack (one PDF)" here="/pack" hint="A4 portrait, margins: none, background graphics: on. This is the single PDF to upload to Moodle by 10am on the day." />

      <section className="sheet flex flex-col" style={{ fontSize: "11pt", lineHeight: 1.45 }}>
        <div className="mt-[30mm] text-[11pt] font-bold uppercase tracking-[0.2em] text-gray-600">GSOE9010 · Workshop facilitation · preparation materials</div>
        <h1 className="mt-2 text-[40pt] leading-none">Presentation Skills</h1>
        <p className="mt-2 text-[14pt] font-bold">Week 5 topic workshop</p>
        <table className="mt-8">
          <tbody>
            <tr><th style={{ width: "28%" }}>Session</th><td>{get("session")}</td></tr>
            <tr><th>Facilitators</th><td>{[1, 2, 3, 4].map((f) => get(`f${f}`)).join(" · ")}</td></tr>
          </tbody>
        </table>

        <h2 className="mt-8 text-[14pt]">What is in this document</h2>
        <table>
          <thead><tr><th style={{ width: "36%" }}>Section</th><th>What it shows</th></tr></thead>
          <tbody>
            <tr><td><strong>1. Workshop plan</strong> (6 pages)</td><td>The hour minute by minute; who does what; the two suggested activities with our modifications; our original third activity and the facilitation strategies in it; expected questions; our check against the marking rubric; our preparatory research.</td></tr>
            <tr><td><strong>2. Presentation slides</strong></td><td>The slides we will show, two to a page.</td></tr>
            <tr><td><strong>3. Facilitator guide for activity 3</strong></td><td>Rules, run sheet with cues, backup plan, the full question bank with answers and reasons, and the QR poster for the tables.</td></tr>
            <tr><td><strong>4. Student handout</strong></td><td>The one-page guide each table receives.</td></tr>
          </tbody>
        </table>

        <h2 className="mt-8 text-[14pt]">How it maps to the materials criteria</h2>
        <table>
          <thead><tr><th style={{ width: "50%" }}>Criterion</th><th>Where to look</th></tr></thead>
          <tbody>
            <tr><td>Quality and relevance of the materials, including evidence of having researched the topic</td><td>Plan page 6 (research and sources); slides; question bank; student handout</td></tr>
            <tr><td>Evidence of having prepared the two suggested activities, including modifications and personalised input</td><td>Plan pages 2 and 3; slides 3 and 4</td></tr>
            <tr><td>Evidence of having prepared a third original activity, including innovative facilitation strategies</td><td>Plan page 4; facilitator guide; student handout; slides 5 and 6</td></tr>
          </tbody>
        </table>
        <p className="mt-auto text-[9pt] text-gray-600">Activity 3 runs in a web browser. {ctx.origin ? `It is available at ${ctx.origin.replace(/^https?:\/\//, "")}.` : ""}</p>
      </section>

      <PlanDoc />
      <SlidesHandout ctx={ctx} />
      <GuideDoc bare />
      <StudentDoc bare />
    </div>
  );
}
