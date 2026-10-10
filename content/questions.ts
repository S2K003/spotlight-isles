import type { CriterionKey, SlideSpec } from "@/lib/engine/types";

export interface Question {
  id: string;
  criterion: CriterionKey;
  type: "mcq" | "slide";
  prompt: string;
  options: string[];
  /** Index of the correct option. */
  correct: number;
  why: string;
  slide?: SlideSpec;
}

/**
 * Group-discussion scenarios on PRESENTATION SKILLS (GSOE9010 Week 5). Three are drawn per game.
 * Each is a judgement call worth talking through as a group rather than a fact to recall, and
 * together they cover the things a presenter is marked on: structure, slides, voice and pace,
 * eye contact, notes, timing, teamwork, engaging the audience and handling questions.
 */
export const QUESTIONS: Question[] = [
  {
    id: "P1",
    criterion: "structure",
    type: "mcq",
    prompt: "You're opening a 5-minute presentation to your classmates. Which opening works best?",
    options: [
      "\"Hi everyone, my name is Sam, and today I'm going to talk about my topic.\"",
      "\"Have you ever sat through a talk and remembered nothing? Here are three ways to make sure that isn't yours.\"",
      "\"Sorry, I didn't have much time to prepare, so bear with me.\"",
      "\"Before I start, let me read you the outline on this slide.\"",
    ],
    correct: 1,
    why: "Open with a hook (a question, a problem or a surprising fact) and tell the audience what they will get. Names, outlines and apologies don't earn attention.",
  },
  {
    id: "P2",
    criterion: "structure",
    type: "mcq",
    prompt: "You have 5 minutes and ten good points you could make. What's the best plan?",
    options: [
      "Speak faster so all ten fit",
      "Pick the three that matter most to this audience and say them clearly",
      "Put all ten on one slide so nothing is left out",
      "Cover as many as you can and stop when time runs out",
    ],
    correct: 1,
    why: "Audiences remember a few clear messages, not a list. Choose for the audience, signpost each point, and finish with a take-home message.",
  },
  {
    id: "P3",
    criterion: "visuals",
    type: "slide",
    prompt: "Your group made this slide. What should you change first?",
    slide: {
      title: "Results",
      kind: "textwall",
      bullets: [
        "The first experimental run produced an efficiency of 43.2% under nominal conditions",
        "The second run, after recalibrating the inlet sensor, improved this to 47.9%",
        "Ambient temperature varied between 19.4 and 23.8 degrees during the testing window",
        "A total of 14 samples were discarded owing to contamination in the holding tank",
        "The control group showed no statistically significant change over the same period",
        "Costs per unit fell from $12.40 to $9.15 once the second supplier was onboarded",
        "Team members logged a combined 312 hours across design, build and test phases",
        "Stakeholder feedback was broadly positive, with some concerns about maintenance",
        "Further work is recommended to validate these findings at a larger scale",
      ],
    },
    options: [
      "Show one key message with one clear picture or graph, and say the rest out loud",
      "Make the font smaller so it all fits more neatly",
      "Add animations so the bullets appear one by one",
      "Split it into three slides with the same text",
    ],
    correct: 0,
    why: "Slides support the speaker; they don't replace them. If the audience is reading, they aren't listening. One idea per slide.",
  },
  {
    id: "P4",
    criterion: "qa",
    type: "mcq",
    prompt: "After your presentation, someone asks a question you can't answer. What's the best response?",
    options: [
      "\"That's not really part of my topic.\"",
      "Give a confident answer even though you're not sure",
      "\"Good question. I don't know yet, but here's how I'd find out, and I'll get back to you.\"",
      "Look at your teammates and wait for someone else to answer",
    ],
    correct: 2,
    why: "Being honest and saying how you would find out builds trust. Bluffing or brushing the question off loses it.",
  },
  {
    id: "P5",
    criterion: "delivery",
    type: "mcq",
    prompt: "Your group of four has a 5-minute group presentation. What's the best way to share it?",
    options: [
      "The most confident speaker presents everything",
      "Everyone takes turns saying one sentence each",
      "Each person owns one section, with rehearsed handovers between speakers",
      "Decide who says what on the day so it sounds natural",
    ],
    correct: 2,
    why: "Clear ownership plus practised handovers looks like a team. Rehearse the transitions as much as the content.",
  },
  {
    id: "P6",
    criterion: "delivery",
    type: "mcq",
    prompt: "You're presenting to a room of twenty people. Where should you look?",
    options: [
      "At your slides, so you don't lose your place",
      "At the one friendly face in the front row",
      "Around the whole room, holding eye contact with different people for a sentence at a time",
      "Just above everyone's heads, at the back wall",
    ],
    correct: 2,
    why: "Sharing eye contact around the room makes everyone feel spoken to, and lets you see whether people are following.",
  },
  {
    id: "P7",
    criterion: "timing",
    type: "mcq",
    prompt: "You're 30 seconds from the time limit and still have two slides and your conclusion to go. What do you do?",
    options: [
      "Speak twice as fast and cover everything",
      "Skip to your conclusion and take-home message",
      "Keep going and hope you're allowed to run over",
      "Stop where you are when the time is up",
    ],
    correct: 1,
    why: "Always protect your ending: the conclusion is what people remember. Rehearsing out loud with a timer stops this happening.",
  },
  {
    id: "P8",
    criterion: "engagement",
    type: "mcq",
    prompt: "Halfway through your presentation, the audience looks lost. What's the best move?",
    options: [
      "Carry on exactly as planned so you stay on script",
      "Repeat the same explanation, but louder",
      "Pause, explain it again with a simple everyday example, and check people are with you",
      "Apologise and skip that part entirely",
    ],
    correct: 2,
    why: "Read the room and adapt. A different explanation or an example brings people back; saying the same thing again doesn't.",
  },
  {
    id: "P9",
    criterion: "delivery",
    type: "mcq",
    prompt: "A friend tells you that you say \"um\" a lot and sound flat when you present. What's the best fix?",
    options: [
      "Talk faster so there are no gaps to fill",
      "Memorise the whole talk word for word",
      "Replace each \"um\" with a short pause, and vary your pace and volume on the key words",
      "Keep your voice at one steady level so you sound calm",
    ],
    correct: 2,
    why: "A pause sounds confident and gives the audience time to think. Changing pace, pitch and volume tells them what matters.",
  },
  {
    id: "P10",
    criterion: "delivery",
    type: "mcq",
    prompt: "What's the best way to use notes when you present?",
    options: [
      "Write out the full script and read it so nothing is missed",
      "Read the text off your slides",
      "Use a few keywords on a card, rehearse out loud, and look up when you speak",
      "Use no notes at all and make it up as you go",
    ],
    correct: 2,
    why: "Keywords keep you on track while you talk to the audience. Reading a script or the slides breaks eye contact and sounds flat.",
  },
];

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
