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
 * Team-discussion scenarios about presenting research, written for GSOE9010 (research skills for
 * engineering coursework students). Three are drawn per game. Each is a judgement call worth
 * talking through as a team rather than a fact to recall. The example projects are fictional.
 */
export const QUESTIONS: Question[] = [
  {
    id: "P1",
    criterion: "structure",
    type: "mcq",
    prompt: "Your team has 2 minutes to pitch your research project to a panel from outside your field. Which opening works best?",
    options: [
      "\"Our project investigates multi-objective optimisation of piezoelectric sensor arrays.\"",
      "\"Bridges are checked by eye, and small cracks get missed. We ask: can a low-cost sensor catch them earlier?\"",
      "\"First, let us introduce our four team members and our timeline.\"",
      "\"Sorry, we're still finishing the slides, so bear with us.\"",
    ],
    correct: 1,
    why: "Open with the problem and your research question in plain words. Jargon, introductions and apologies can wait.",
  },
  {
    id: "P2",
    criterion: "structure",
    type: "mcq",
    prompt: "You have 3 minutes to present a literature review of 20 papers. What's the best plan?",
    options: [
      "Give each paper 9 seconds, in the order you read them",
      "Group the papers into 2–3 themes, then show the gap your project fills",
      "Put the full reference list on screen and talk through it",
      "Skip the literature and go straight to your method",
    ],
    correct: 1,
    why: "A literature review is an argument, not a list. Themes lead the audience to the gap, and the gap justifies your project.",
  },
  {
    id: "P3",
    criterion: "visuals",
    type: "slide",
    prompt: "Your team made this results slide. What should you change first?",
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
      "Show one key finding with one clear graph, and say the rest out loud",
      "Make the font smaller so it all fits more neatly",
      "Add animations so the bullets appear one by one",
      "Split it into three slides with the same text",
    ],
    correct: 0,
    why: "Slides support you; they don't replace you. One finding, one graph, and the audience listens instead of reading.",
  },
  {
    id: "P4",
    criterion: "qa",
    type: "mcq",
    prompt: "After your presentation, a panel member points out a limitation of your method that your team hadn't considered. Best response?",
    options: [
      "\"That's outside the scope of our project.\"",
      "Give a confident answer even though you're not sure",
      "\"Good point. That could affect our results in this way, and here is how we could check it.\"",
      "Look at your teammates and wait for someone else to answer",
    ],
    correct: 2,
    why: "Acknowledging a limitation and saying how you would test it shows research maturity. Bluffing or deflecting costs credibility.",
  },
  {
    id: "P5",
    criterion: "delivery",
    type: "mcq",
    prompt: "Your team of four has a 5-minute group presentation. What's the best way to share it?",
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
    criterion: "visuals",
    type: "mcq",
    prompt: "You want to show a graph from a journal paper on your slide. What must you do?",
    options: [
      "Nothing, because it's only a presentation and not a written report",
      "Redraw it in different colours so it counts as your own",
      "Cite the source on the slide and explain what the graph shows",
      "Mention the authors only if someone asks",
    ],
    correct: 2,
    why: "Academic integrity applies to slides too. Cite the source where the figure appears, and interpret it for the audience.",
  },
  {
    id: "P7",
    criterion: "timing",
    type: "mcq",
    prompt: "You're 30 seconds from the time limit and still have your method details and your conclusion to go. What do you do?",
    options: [
      "Speak twice as fast and cover both",
      "Skip to your conclusion and key message",
      "Keep going and hope the panel lets you run over",
      "Stop where you are when the time is up",
    ],
    correct: 1,
    why: "Always protect your ending. The audience remembers your conclusion, and details can come out in Q&A.",
  },
  {
    id: "P8",
    criterion: "engagement",
    type: "mcq",
    prompt: "Halfway through explaining your methodology, the audience looks lost. What's the best move?",
    options: [
      "Carry on exactly as planned so you stay on script",
      "Repeat the same explanation, but louder",
      "Pause, give a simple everyday example, then continue",
      "Apologise and skip the methodology entirely",
    ],
    correct: 2,
    why: "Read the room. A quick analogy or example brings people back, and it shows you understand your own method.",
  },
];

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
