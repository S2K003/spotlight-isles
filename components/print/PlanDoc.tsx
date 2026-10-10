"use client";

import { GOOD_STEPS, GREAT_STEPS, MIN_STEPS } from "@/config/balance";
import { LEARNING_OBJECTIVES, SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { DUR } from "@/config/timeline";
import { QUESTIONS } from "@/content/questions";
import { SPOTLIGHT_TOPICS } from "@/content/spotlight";
import { Field, useWorkshop } from "./workshop";

/** The hour, minute by minute. Three equal activities with a shared introduction and conclusion. */
export const SCHEDULE: { at: string; mins: number; seg: string; key: string; what: string }[] = [
  { at: "0:00", mins: 4, seg: "Introduction", key: "intro", what: "Welcome, topic and purpose, agenda, learning outcomes. Groups scan the QR code so the game lobby fills while we talk." },
  { at: "0:04", mins: 16, seg: "Activity 1", key: "a1", what: "Suggested activity 1 (with our modifications)." },
  { at: "0:20", mins: 16, seg: "Activity 2", key: "a2", what: "Suggested activity 2 (with our modifications)." },
  { at: "0:36", mins: 16, seg: "Activity 3", key: "a3", what: "Spotlight Isles, our original activity: 1 minute to check everyone has joined, then exactly 15:00 on the game clock." },
  { at: "0:52", mins: 6, seg: "Conclusion", key: "end", what: "The game's debrief screen, three take-home messages, \"one thing you learned\", questions." },
];
export const TOTAL_MINUTES = SCHEDULE.reduce((s, r) => s + r.mins, 0);

const Head = ({ title, page }: { title: string; page: string }) => (
  <div className="flex items-end justify-between border-b-4 border-[#151a2e] pb-1">
    <h1 className="text-[20pt] leading-none">{title}</h1>
    <div className="text-right text-[9pt] font-bold">
      Workshop plan · {page}
      <br />
      GSOE9010 Week 5 — Presentation Skills
    </div>
  </div>
);

function ActivitySheet({ id, n, page }: { id: "a1" | "a2"; n: number; page: string }) {
  return (
    <section className="sheet flow" style={{ fontSize: "10pt", lineHeight: 1.38 }}>
      <Head title={`Suggested activity ${n}`} page={page} />
      <h2 className="mt-3 text-[15pt]">
        <Field k={`${id}.title`} />
      </h2>
      <p className="text-[9pt] text-gray-600">16 minutes: about 2 to introduce, 11 for the groups to work, 3 to share back and summarise.</p>
      <table className="mt-2">
        <tbody>
          <tr><th style={{ width: "24%" }}>Learning outcome</th><td><Field k={`${id}.outcome`} /></td></tr>
          <tr><th>Introduction</th><td><Field k={`${id}.intro`} /></td></tr>
          <tr><th>Interactive part: steps and timing</th><td><Field k={`${id}.steps`} /></td></tr>
          <tr><th>Our modifications and personal input</th><td><Field k={`${id}.mods`} /></td></tr>
          <tr><th>Summary</th><td><Field k={`${id}.summary`} /></td></tr>
        </tbody>
      </table>
      <h2 className="mt-3 text-[12pt]">Who does what</h2>
      <table>
        <tbody>
          {[1, 2, 3, 4].map((f) => (
            <tr key={f}>
              <th style={{ width: "24%" }}><Field k={`f${f}`} /></th>
              <td><Field k={`r.${id}.${f}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-3 text-[12pt]">How we keep everyone involved</h2>
      <ul className="ml-4 list-disc">
        <li>Instructions are on the slide <em>and</em> said aloud, then one group repeats them back before we start.</li>
        <li>Two facilitators move between tables the whole time. We use names, and ask quiet members directly: &ldquo;…, what are your thoughts?&rdquo;</li>
        <li>After asking a question we wait. If a table is silent we rephrase it or give an example, rather than answering it ourselves.</li>
        <li>Every idea shared is acknowledged and, where it fits, written up.</li>
      </ul>
    </section>
  );
}

/** The workshop plan for upload: the whole hour, the three activities, strategy, rubric check and research. */
export function PlanDoc() {
  const { get } = useWorkshop();
  const names = [1, 2, 3, 4].map((f) => get(`f${f}`));
  return (
    <>
      {/* ---------- 1: the hour ---------- */}
      <section className="sheet flow" style={{ fontSize: "9.5pt", lineHeight: 1.34 }}>
        <Head title="Workshop plan: Presentation Skills" page="page 1" />
        <table className="mt-2">
          <tbody>
            <tr><th style={{ width: "24%" }}>Session</th><td><Field k="session" /></td></tr>
            <tr>
              <th>Facilitators</th>
              <td>
                <Field k="f1" inline /> · <Field k="f2" inline /> · <Field k="f3" inline /> · <Field k="f4" inline />
              </td>
            </tr>
            <tr><th>Topic</th><td>Presentation skills: structuring a talk, designing slides, delivering it, and handling questions.</td></tr>
            <tr><th>Purpose</th><td>Participants practise the skills from this week&apos;s lecture on each other, in small groups, and leave with three things to do differently in their next presentation.</td></tr>
          </tbody>
        </table>

        <h2 className="mt-3 text-[12pt]">By the end of the hour, participants can</h2>
        <ol className="ml-5 list-decimal">
          {LEARNING_OBJECTIVES.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>

        <h2 className="mt-3 text-[12pt]">Timing ({TOTAL_MINUTES} minutes; the three activities are equal)</h2>
        <table>
          <thead><tr><th style={{ width: "9%" }}>Start</th><th style={{ width: "9%" }}>Min</th><th style={{ width: "17%" }}>Part</th><th>What happens</th></tr></thead>
          <tbody>
            {SCHEDULE.map((r) => (
              <tr key={r.key}>
                <td>{r.at}</td>
                <td>{r.mins}</td>
                <td><strong>{r.key === "a1" || r.key === "a2" ? <Field k={`${r.key}.title`} /> : r.key === "a3" ? "Activity 3 — Spotlight Isles" : r.seg}</strong></td>
                <td>{r.what}</td>
              </tr>
            ))}
            <tr><td>0:{TOTAL_MINUTES}</td><td /><td><strong>End</strong></td><td>Two minutes spare inside the hour for a late start or a slow changeover.</td></tr>
          </tbody>
        </table>
        <p className="mt-1 text-[9pt]">One facilitator keeps time in every part and gives a two-minute and a thirty-second warning. If we are running late we shorten the share-back of an activity, never its summary. The game cannot overrun: it ends by itself at exactly 15:00.</p>

        <h2 className="mt-3 text-[12pt]">Working as a team: everyone has a job in every part</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: "14%" }}>Part</th>
              {names.map((n, i) => (
                <th key={i}>{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE.map((r) => (
              <tr key={r.key}>
                <th>{r.seg}</th>
                {[1, 2, 3, 4].map((f) => (
                  <td key={f}><Field k={`r.${r.key}.${f}`} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[9pt]">The introduction and the conclusion are shared by all of us. The lead changes for each activity, and the game host changes during the game, so nobody presents more than about a quarter of the hour.</p>

        <h2 className="mt-3 text-[12pt]">Materials</h2>
        <p>Slides (this pack) · projector laptop on charge with sound · the game&apos;s web address and QR code · one printed student guide per table · printed QR poster · printed question bank as a backup · markers and paper for activities 1 and 2 · a phone timer · a small prize for the winning group.</p>
      </section>

      <ActivitySheet id="a1" n={1} page="page 2" />
      <ActivitySheet id="a2" n={2} page="page 3" />

      {/* ---------- 4: our original activity ---------- */}
      <section className="sheet flow" style={{ fontSize: "10pt", lineHeight: 1.38 }}>
        <Head title="Our original activity" page="page 4" />
        <h2 className="mt-3 text-[15pt]">Activity 3 — Spotlight Isles</h2>
        <p className="text-[9pt] text-gray-600">16 minutes: 1 to check every group has joined, then exactly 15:00 on the game clock. The full run sheet and rules are in the Facilitator Guide later in this pack.</p>
        <table className="mt-2">
          <tbody>
            <tr>
              <th style={{ width: "24%" }}>Why we made it</th>
              <td>Activities 1 and 2 practise single skills. We wanted one activity where every participant uses all of them together: deciding what good presenting looks like, giving a short talk in front of the room, and judging other people&apos;s talks against criteria, which is what they will do for the rest of this course.</td>
            </tr>
            <tr>
              <th>Learning outcomes</th>
              <td>
                Participants can (1) choose the stronger presenting technique in a realistic situation and explain why; (2) deliver a {DUR.spotSpeak}-second talk with a hook, one clear message and a confident finish; (3) mark a talk fairly against three criteria.
              </td>
            </tr>
            <tr>
              <th>Introduction</th>
              <td>The game opens with a {DUR.intro}-second screen: the goal, three rule cards and the learning outcomes. The host reads them aloud: &ldquo;Get your group to the Keynote Stage. You move every round, and further when you answer or pitch well.&rdquo;</td>
            </tr>
            <tr>
              <th>Interactive part</th>
              <td>
                A team game on phones with one shared screen. Six groups fly an airship across a small map to the &ldquo;Keynote Stage&rdquo;. Six rounds alternate:
                <ul className="ml-4 list-disc">
                  <li><strong>Group question (rounds 1, 3, 5).</strong> A presenting scenario with four options. Groups get {DUR.challenge} seconds to discuss and agree. If half the group or more picks the best answer they move {GOOD_STEPS} steps, otherwise {MIN_STEPS}. The reason is shown and read aloud.</li>
                  <li><strong>Group pitch (rounds 2, 4, 6).</strong> A spin picks two groups that have not pitched yet. Each gets a topic about presenting, {DUR.spotReady} seconds to choose a speaker and prepare, and {DUR.spotSpeak} seconds to speak. The other groups mark {SPOTLIGHT_CRITERIA.map((c) => c.label).join(", ")} from 1 to 5 stars; a good pitch moves {GOOD_STEPS}, a great one {GREAT_STEPS}.</li>
                </ul>
                Every group pitches exactly once, and every group can reach the Stage.
              </td>
            </tr>
            <tr>
              <th>Summary</th>
              <td>The game ends on a debrief screen built from what the room actually did: which question was hardest, the room&apos;s average stars for each pitch criterion, the pitch skill to work on, and three takeaways. We read it out and use it to open the conclusion.</td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt-3 text-[12pt]">Facilitation strategies we are trying</h2>
        <ul className="ml-4 list-disc">
          <li><strong>Discussion before answers.</strong> There is no speed bonus and answers can be changed until time runs out, so the quickest person at the table cannot decide for everyone.</li>
          <li><strong>Everyone speaks, nobody is singled out.</strong> A spin chooses which groups pitch, each group chooses its own speaker, and by the end every group has pitched once.</li>
          <li><strong>Peer assessment with criteria.</strong> Participants mark each other on the same three criteria. Groups cannot mark themselves, and the highest and lowest marks are dropped.</li>
          <li><strong>Nobody is left behind.</strong> Every group moves every round, and group size does not matter: a group of two is as strong as a group of six.</li>
          <li><strong>The debrief comes from the room&apos;s own results,</strong> so the conclusion talks about what this class found hard, not a generic list.</li>
          <li><strong>Phones are the controller, not a distraction.</strong> During pitches the phones say &ldquo;phones down, eyes up&rdquo;. If the Wi-Fi fails, Manual Mode runs the same game by show of hands with no phones at all.</li>
        </ul>

        <h2 className="mt-3 text-[12pt]">Who does what</h2>
        <table>
          <tbody>
            {[1, 2, 3, 4].map((f) => (
              <tr key={f}>
                <th style={{ width: "24%" }}><Field k={`f${f}`} /></th>
                <td><Field k={`r.a3.${f}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[9pt]">Inclusion: every group has a colour and a shape; questions and topics are read aloud as well as shown; the phone screens have a reduced-motion setting; only a nickname is collected.</p>
      </section>

      {/* ---------- 5: strategy and rubric check ---------- */}
      <section className="sheet flow" style={{ fontSize: "9.6pt", lineHeight: 1.36 }}>
        <Head title="How we will facilitate" page="page 5" />

        <h2 className="mt-3 text-[12pt]">Phrases we will use</h2>
        <div className="columns-2 gap-6">
          <ul className="ml-4 list-disc">
            <li>&ldquo;The topic today is presentation skills. The purpose of this activity is…&rdquo;</li>
            <li>&ldquo;We will begin by… then…&rdquo;</li>
            <li>&ldquo;In your experience, what makes a talk hard to follow?&rdquo;</li>
            <li>&ldquo;Can you say a bit more about that?&rdquo;</li>
            <li>&ldquo;Can you show us with an example?&rdquo;</li>
            <li>&ldquo;…, what are your thoughts?&rdquo; (by name)</li>
            <li>&ldquo;Which option did your group nearly pick, and why didn&apos;t you?&rdquo;</li>
            <li>&ldquo;The take-home message from this activity is…&rdquo;</li>
          </ul>
        </div>

        <h2 className="mt-3 text-[12pt]">Questions we expect, and our answers</h2>
        <table>
          <tbody>
            <tr><th style={{ width: "34%" }}>What if my mind goes blank?</th><td>Pause, breathe, look at your keyword card and repeat your last point in other words. A pause feels far longer to you than to the audience.</td></tr>
            <tr><th>How do I stop saying &ldquo;um&rdquo;?</th><td>Swap it for a silent pause. Rehearsing out loud is what removes most of them, because you stop searching for words.</td></tr>
            <tr><th>Is it OK to use notes?</th><td>Yes: keywords on a card, not a script. Reading a script or the slides breaks eye contact and flattens your voice.</td></tr>
            <tr><th>How many slides for five minutes?</th><td>There is no fixed number. Use one idea per slide, and only as many slides as you have ideas you can explain in the time.</td></tr>
            <tr><th>How fast should I speak?</th><td>Slower than feels natural when you are nervous. Rehearse with a timer and build pauses in after key points.</td></tr>
            <tr><th>What if I&apos;m asked something I don&apos;t know?</th><td>Say so, say how you would find out, and offer to follow up. Never bluff.</td></tr>
            <tr><th>How do we split a group presentation?</th><td>Each person owns a section, and you rehearse the handovers. Everyone should be able to answer questions on any part.</td></tr>
          </tbody>
        </table>

        <h2 className="mt-3 text-[12pt]">Our check against the marking rubric</h2>
        <table>
          <thead><tr><th style={{ width: "22%" }}>Criterion</th><th>What we are doing about it</th></tr></thead>
          <tbody>
            <tr><th>Slides and props</th><td>Our own slides for every part (later in this pack), with pictures and few words. The game screens, the printed student guide and the QR poster are the props for activity 3.</td></tr>
            <tr><th>Activities (×3)</th><td>Each activity page lists its introduction, learning outcome, interactive part and summary, and what we changed or added.</td></tr>
            <tr><th>Presentation and manner</th><td>Keyword cards instead of scripts. We rehearse out loud, face the room, and the game host commentates the moves like a sports caster.</td></tr>
            <tr><th>Knowledge of the topic</th><td>Every game question has a reason we can expand on with our own examples, and we have prepared answers to the questions above.</td></tr>
            <tr><th>Engagement with participants</th><td>Two of us are always on the floor at the tables, using names. We adapt on the day: if a table is stuck we rephrase or give an example.</td></tr>
            <tr><th>Time management</th><td>{TOTAL_MINUTES} minutes planned: three activities of 16 minutes, a 4-minute introduction and a 6-minute conclusion. A named timekeeper in each part; the game keeps its own clock.</td></tr>
            <tr><th>Teamwork</th><td>The table on page 1 gives every facilitator a job in every activity. All of us speak in the introduction and the conclusion.</td></tr>
            <tr><th>Participants&apos; engagement</th><td>Small groups throughout. In the game everyone answers, everyone marks, and every group pitches. Phones are only used to tap an answer; the talking and listening happen in the room.</td></tr>
          </tbody>
        </table>

        <h2 className="mt-3 text-[12pt]">If something goes wrong</h2>
        <ul className="ml-4 list-disc">
          <li><strong>Wi-Fi or phones fail:</strong> switch the game to Manual Mode (show of hands) and carry on; the questions are also printed.</li>
          <li><strong>Running late:</strong> cut the share-back in activity 1 or 2 to one group. The game and the conclusion keep their full time.</li>
          <li><strong>A group won&apos;t choose a speaker:</strong> the floor coach offers to stand with them, or the group answers as a pair.</li>
          <li><strong>Fewer than six groups:</strong> empty groups are simply skipped; the game still runs.</li>
        </ul>
      </section>

      {/* ---------- 6: research ---------- */}
      <section className="sheet flow" style={{ fontSize: "9.6pt", lineHeight: 1.36 }}>
        <Head title="Preparatory research" page="page 6" />
        <h2 className="mt-3 text-[12pt]">What we studied</h2>
        <p><Field k="research" /></p>

        <h2 className="mt-3 text-[12pt]">Where each idea in our original activity comes from</h2>
        <table>
          <thead><tr><th style={{ width: "30%" }}>Principle</th><th style={{ width: "34%" }}>Where it appears in the game</th><th>Our source</th></tr></thead>
          <tbody>
            <tr><td>Open with a hook; a few key messages; finish with a take-home message</td><td>Questions P1 and P2; the &ldquo;Hook&rdquo; and &ldquo;Clarity&rdquo; pitch criteria</td><td><Field k="src.1" /></td></tr>
            <tr><td>Slides support the speaker: one idea per slide, little text</td><td>Question P3 (a deliberately bad slide); pitch topic 2</td><td><Field k="src.2" /></td></tr>
            <tr><td>Delivery: voice, pace, pauses, eye contact</td><td>Questions P6 and P9; the &ldquo;Confidence&rdquo; pitch criterion; pitch topic 4</td><td><Field k="src.3" /></td></tr>
            <tr><td>Notes and rehearsal; keeping to time</td><td>Questions P7 and P10; pitch topic 5; the fixed {DUR.spotSpeak}-second pitch</td><td><Field k="src.4" /></td></tr>
            <tr><td>Engaging the audience and handling questions</td><td>Questions P4 and P8; pitch topic 6</td><td><Field k="src.5" /></td></tr>
            <tr><td>Presenting as a team; marking against criteria</td><td>Question P5; peer marking with three criteria in every pitch round</td><td><Field k="src.6" /></td></tr>
          </tbody>
        </table>

        <h2 className="mt-3 text-[12pt]">The content we wrote</h2>
        <p>{QUESTIONS.length} discussion questions (three are drawn each game) and {SPOTLIGHT_TOPICS.length} pitch topics, all on presentation skills. The complete question bank with answers and reasons is in the Facilitator Guide later in this pack. The pitch topics are:</p>
        <ol className="ml-5 list-decimal columns-2 gap-6">
          {SPOTLIGHT_TOPICS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>

        <h2 className="mt-3 text-[12pt]">How we tested the activity</h2>
        <ul className="ml-4 list-disc">
          <li>The game&apos;s length is checked automatically: its phases must add up to exactly 15 minutes or the check fails.</li>
          <li>We ran complete games with 40 simulated players to check the timing, that every group pitches exactly once, and that every group can reach the Stage even if it answers every question wrong.</li>
          <li>The map is the same shape for every group, and scoring uses the share of a group that is right, so group size gives no advantage.</li>
        </ul>
        <h2 className="mt-3 text-[12pt]">Our rehearsal</h2>
        <p><Field k="rehearsal" /></p>
      </section>
    </>
  );
}
