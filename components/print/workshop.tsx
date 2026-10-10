"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * The parts of the workshop only the facilitation group knows (names, the two suggested
 * activities from Moodle, their own modifications and sources). They are typed straight onto the
 * plan or the slides, saved in this browser, and shared between the plan, the slides and the pack.
 * Anything still in [square brackets] has not been filled in yet.
 */
const KEY = "spotlight-isles:workshop";

export const DEFAULTS: Record<string, string> = {
  session: "[Tutorial day, time and room] · [date]",
  f1: "[Facilitator 1]",
  f2: "[Facilitator 2]",
  f3: "[Facilitator 3]",
  f4: "[Facilitator 4]",

  "a1.title": "Activity 1 — Diagrams",
  "a1.outcome": "[Learning outcome from the Moodle instructions, e.g. \"Participants can explain an idea with a simple diagram instead of text.\"]",
  "a1.intro": "[How we introduce it in one or two sentences: the purpose, and what groups will produce.]",
  "a1.steps": "[The steps from the Moodle instructions, in the order we will run them, with minutes for each.]",
  "a1.mods": "[What we changed or added. Suggestion: each group explains its diagram to a neighbouring group in 60 seconds, and the listeners give one thing that worked and one thing to improve.]",
  "a1.summary": "[How we wrap it up: two or three groups share, then we state the key point in one sentence.]",

  "a2.title": "Activity 2 — Elevator Pitch",
  "a2.outcome": "[Learning outcome from the Moodle instructions, e.g. \"Participants can pitch an idea in under a minute with a hook, one message and an ask.\"]",
  "a2.intro": "[How we introduce it in one or two sentences: the purpose, and what groups will produce.]",
  "a2.steps": "[The steps from the Moodle instructions, in the order we will run them, with minutes for each.]",
  "a2.mods": "[What we changed or added. Suggestion: pitches are given standing, to a different group, and the best opening line from each table is written on the board.]",
  "a2.summary": "[How we wrap it up, and how it leads into the game: \"Next you'll pitch for real, and your classmates will mark it.\"]",

  take1: "Open with a hook, say one clear message, and finish with what you want the audience to do or remember.",
  take2: "Slides support you. One idea per slide; talk to the room, not to the screen.",
  take3: "Rehearse out loud with a timer. Pause instead of \"um\", and protect your ending.",

  // Who does what in each part. Every facilitator has a job in every part of the hour.
  "r.intro.1": "Welcomes the room, states the topic and purpose",
  "r.intro.2": "Walks through the agenda",
  "r.intro.3": "Explains the groups and the QR code",
  "r.intro.4": "States the learning outcomes",
  "r.a1.1": "Leads: introduces and gives instructions",
  "r.a1.2": "Coaches groups 1–3, keeps time",
  "r.a1.3": "Coaches groups 4–6",
  "r.a1.4": "Runs the share-back and the summary",
  "r.a2.1": "Coaches groups 1–3",
  "r.a2.2": "Leads: introduces and gives instructions",
  "r.a2.3": "Runs the share-back and the summary",
  "r.a2.4": "Coaches groups 4–6, keeps time",
  "r.a3.1": "Floor coach, groups 1–3; hosts rounds 5–6",
  "r.a3.2": "Floor coach, groups 4–6; hosts rounds 3–4",
  "r.a3.3": "Game host on the mic for the intro and rounds 1–2; reads questions and topics aloud",
  "r.a3.4": "Runs the host screen; ready with Manual Mode; hosts the results",
  "r.end.1": "Take-home message 1",
  "r.end.2": "Take-home message 2",
  "r.end.3": "Take-home message 3",
  "r.end.4": "Reads the debrief screen, asks \"one thing you learned?\", thanks the room",

  "src.1": "[Lecture snippet or reading we took this from]",
  "src.2": "[Lecture snippet or reading we took this from]",
  "src.3": "[Lecture snippet or reading we took this from]",
  "src.4": "[Lecture snippet or reading we took this from]",
  "src.5": "[Lecture snippet or reading we took this from]",
  "src.6": "[Lecture snippet or reading we took this from]",
  research: "[What we watched and read to prepare: the Week 5 lecture snippets, the suggested readings, and anything else. Two or three sentences on what we learned and how it shaped the three activities.]",
  rehearsal: "[When we rehearsed, who was there, how long each part took, and what we changed afterwards.]",
};

type Store = Record<string, string>;
const listeners = new Set<() => void>();
const EMPTY: Store = {};
let cache: Store | null = null;

function read(): Store {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Store): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: edits last until the tab closes */
  }
  for (const cb of Array.from(listeners)) cb();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useWorkshop() {
  const store = useSyncExternalStore(subscribe, read, () => EMPTY);
  const get = (k: string): string => store[k] ?? DEFAULTS[k] ?? "";
  return {
    get,
    set: (k: string, v: string) => write({ ...read(), [k]: v }),
    reset: () => write({}),
    /** Fields still showing their [placeholder]. */
    todo: Object.keys(DEFAULTS).filter((k) => get(k).trim().startsWith("[")).length,
  };
}

/** A piece of text that can be edited in place. Saves when you click away. */
export function Field({ k, className = "", inline = false }: { k: string; className?: string; inline?: boolean }) {
  const { get, set } = useWorkshop();
  const value = get(k);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== value) el.innerText = value;
  }, [value]);
  const todo = value.trim().startsWith("[");
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={`Editable: ${k}`}
      onBlur={(e) => {
        const text = e.currentTarget.innerText.replace(/ /g, " ").trim();
        set(k, text || DEFAULTS[k] || "");
      }}
      className={`field ${todo ? "field-todo" : ""} ${inline ? "" : "block"} ${className}`}
      style={{ whiteSpace: "pre-wrap", outline: "none" }}
    >
      {value}
    </span>
  );
}
