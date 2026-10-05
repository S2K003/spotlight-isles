import type { CriterionKey, SlideSpec } from "@/lib/engine/types";

export interface Question {
  id: string;
  criterion: CriterionKey;
  type: "mcq" | "order" | "slide";
  prompt: string;
  /** mcq / slide: the four options. order: the four chips listed in the CORRECT order. */
  options: string[];
  /** mcq / slide: index of the correct option. Ignored for order questions. */
  correct: number;
  why: string;
  slide?: SlideSpec;
}

export interface FinalQuestion {
  id: string;
  statement: string;
  answer: boolean;
  why: string;
}

export const QUESTIONS: Question[] = [
  /* ---------- Structure ---------- */
  {
    id: "S1",
    criterion: "structure",
    type: "mcq",
    prompt: "Which opening is strongest for a 2-minute pitch about a water-purifying straw?",
    options: [
      "\"Hi, I'm Alex, and today I'll be talking about our product.\"",
      "\"Around 2 billion people lack safe drinking water. This straw makes water safe in seconds.\"",
      "\"Let me start with the history of filtration since 1850.\"",
      "\"Sorry, I'm a bit nervous, so bear with me.\"",
    ],
    correct: 1,
    why: "Open with a hook: a striking fact plus a promise. Save introductions for later or skip them.",
  },
  {
    id: "S2",
    criterion: "structure",
    type: "order",
    prompt: "Put this elevator pitch in the most effective order.",
    options: [
      "\"Bridge failures put lives and billions of dollars at risk.\"",
      "\"Our sensor detects tiny cracks months before they become dangerous.\"",
      "\"In our pilot, it flagged every crack the inspectors later confirmed.\"",
      "\"Can we demo it on one of your bridges next month?\"",
    ],
    correct: 0,
    why: "Problem → Solution → Proof → Ask. (The example pitch is fictional.)",
  },
  {
    id: "S3",
    criterion: "structure",
    type: "mcq",
    prompt: "You have 3 minutes and 7 key points. Best move?",
    options: [
      "Speak faster to fit all 7",
      "Pick the 3 that matter most to this audience",
      "Put all 7 on one slide",
      "Skip the conclusion",
    ],
    correct: 1,
    why: "Audiences remember a few clear points. Prioritise ruthlessly.",
  },
  {
    id: "S4",
    criterion: "structure",
    type: "mcq",
    prompt: "What should your final sentence do?",
    options: [
      "\"That's it… any questions?\"",
      "Restate your key message and give a clear call to action",
      "Introduce a brand-new statistic",
      "Apologise for going over time",
    ],
    correct: 1,
    why: "The ending is what people remember. Land the message and tell them what to do next.",
  },

  /* ---------- Visuals ---------- */
  {
    id: "V1",
    criterion: "visuals",
    type: "slide",
    prompt: "What's the BIGGEST problem with this slide?",
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
      "Too much text: the audience reads instead of listening",
      "The title should be in capitals",
      "It needs more colours",
      "It needs a border",
    ],
    correct: 0,
    why: "Slides support you; they shouldn't replace you. Aim for one idea per slide.",
  },
  {
    id: "V2",
    criterion: "visuals",
    type: "mcq",
    prompt: "You want to show how energy use changed over 10 years. Best visual?",
    options: ["Pie chart", "Line chart", "A table of 120 monthly numbers", "Word cloud"],
    correct: 1,
    why: "Line charts show change over time at a glance.",
  },
  {
    id: "V3",
    criterion: "visuals",
    type: "mcq",
    prompt: "Comparing the market share of 3 competitors. Clearest visual?",
    options: ["Simple bar chart", "3D exploding pie chart", "A paragraph of text", "Scatter plot"],
    correct: 0,
    why: "Bars make side-by-side comparison easy; 3D effects distort the proportions.",
  },
  {
    id: "V4",
    criterion: "visuals",
    type: "slide",
    prompt: "What would make this slide readable for everyone?",
    slide: {
      title: "Key Findings",
      kind: "lowcontrast",
      bullets: ["Output rose 18% year on year", "Defects fell by a third", "Payback in 14 months"],
    },
    options: [
      "High contrast, e.g., dark text on a light background",
      "A bigger logo",
      "Adding animation",
      "Using italics",
    ],
    correct: 0,
    why: "Low contrast is hard to read, and red/green is a common colour-blindness problem.",
  },

  /* ---------- Delivery ---------- */
  {
    id: "D1",
    criterion: "delivery",
    type: "mcq",
    prompt: "You keep saying \"um\". Best fix?",
    options: [
      "Talk faster so there's no gap",
      "Replace the \"um\" with a short, silent pause",
      "Memorise the script word-for-word",
      "Apologise each time",
    ],
    correct: 1,
    why: "A pause sounds confident and gives the audience time to think.",
  },
  {
    id: "D2",
    criterion: "delivery",
    type: "mcq",
    prompt: "Where should you look while pitching to 6 judges?",
    options: [
      "At your slides",
      "At one friendly judge only",
      "Share eye contact across all of them, a few seconds each",
      "At the ceiling while you think",
    ],
    correct: 2,
    why: "Spreading eye contact makes everyone feel spoken to.",
  },
  {
    id: "D3",
    criterion: "delivery",
    type: "mcq",
    prompt: "Nervous before speaking. What helps most?",
    options: [
      "Skip rehearsal so you stay fresh",
      "Slow breathing, and rehearse your first 30 seconds until it's automatic",
      "Three coffees",
      "Read straight from your notes",
    ],
    correct: 1,
    why: "A confident start builds momentum, and slow breathing calms your body.",
  },
  {
    id: "D4",
    criterion: "delivery",
    type: "mcq",
    prompt: "Your voice sounds flat. Which technique adds energy?",
    options: [
      "Vary your pace and pitch, and stress key words",
      "Be loud the whole time",
      "Add more slides",
      "Speak only in questions",
    ],
    correct: 0,
    why: "Vocal variety signals what matters and keeps attention.",
  },

  /* ---------- Engagement ---------- */
  {
    id: "E1",
    criterion: "engagement",
    type: "mcq",
    prompt: "Audience: high-school students. Topic: carbon capture. Best hook?",
    options: [
      "\"Carbon capture uses amine-based solvent absorption.\"",
      "\"Imagine the air in this room is a bank account, and we're deep in debt. Here's how we pay it back.\"",
      "\"Let me show you 40 equations.\"",
      "\"This topic is a bit boring, but…\"",
    ],
    correct: 1,
    why: "Use analogies matched to the audience. Lead with meaning, not jargon.",
  },
  {
    id: "E2",
    criterion: "engagement",
    type: "mcq",
    prompt: "What makes a statistic stick?",
    options: [
      "Reading it to 4 decimal places",
      "Comparing it to something familiar (\"that's three Olympic pools every minute\")",
      "Putting it in a footnote",
      "Saying it very quickly",
    ],
    correct: 1,
    why: "Concrete comparisons make numbers memorable.",
  },
  {
    id: "E3",
    criterion: "engagement",
    type: "mcq",
    prompt: "Half the room is on their phones mid-talk. You should…",
    options: [
      "Keep going exactly as planned",
      "Ask the audience a quick question or a show of hands",
      "Tell them off",
      "End early",
    ],
    correct: 1,
    why: "Interaction resets attention.",
  },
  {
    id: "E4",
    criterion: "engagement",
    type: "mcq",
    prompt: "Why tell a short story in a technical pitch?",
    options: [
      "It fills time",
      "People remember stories and connect emotionally to the problem",
      "It replaces the need for evidence",
      "Judges require it",
    ],
    correct: 1,
    why: "Stories create connection, and evidence then backs them up.",
  },

  /* ---------- Timing ---------- */
  {
    id: "T1",
    criterion: "timing",
    type: "mcq",
    prompt: "At a natural speaking pace, roughly how many words fit in a 2-minute pitch?",
    options: ["About 50", "About 250–300", "About 600", "About 1,000"],
    correct: 1,
    why: "People typically speak around 120–160 words a minute. Write your script to fit.",
  },
  {
    id: "T2",
    criterion: "timing",
    type: "mcq",
    prompt: "You're at 1:45 of a 2:00 pitch with 3 slides left. Best move?",
    options: [
      "Rush through all 3",
      "Jump to your conclusion and call to action",
      "Ask for 5 more minutes",
      "Stop mid-sentence",
    ],
    correct: 1,
    why: "Always protect your ending.",
  },
  {
    id: "T3",
    criterion: "timing",
    type: "mcq",
    prompt: "The best way to make sure you finish on time?",
    options: [
      "Rehearse out loud with a timer, at least twice",
      "Rehearse silently in your head",
      "Plan to improvise",
      "Add extra backup slides",
    ],
    correct: 0,
    why: "Speaking out loud takes longer than reading silently. Only a timed run tells the truth.",
  },
  {
    id: "T4",
    criterion: "timing",
    type: "mcq",
    prompt: "A good time split for a 2-minute pitch?",
    options: [
      "90 s background, 30 s solution",
      "About 15 s hook, 30 s problem, 45 s solution, 30 s proof + ask",
      "2 minutes of Q&A",
      "100 s about your team",
    ],
    correct: 1,
    why: "Spend most of the time on the problem and solution, but keep the hook and the ask.",
  },

  /* ---------- Q&A ---------- */
  {
    id: "Q1",
    criterion: "qa",
    type: "mcq",
    prompt: "A judge asks something you don't know. Best response?",
    options: [
      "Make up a confident answer",
      "\"Great question. I don't know yet, but here's how we'd find out, and I'll follow up.\"",
      "Ignore it",
      "\"That's not really relevant.\"",
    ],
    correct: 1,
    why: "Honesty plus a plan builds credibility.",
  },
  {
    id: "Q2",
    criterion: "qa",
    type: "mcq",
    prompt: "A question is long and confusing. First step?",
    options: [
      "Answer whatever you think they meant",
      "Briefly rephrase it back to check you understood",
      "Ask them to repeat it three times",
      "Move on to the next question",
    ],
    correct: 1,
    why: "Rephrasing confirms the question and buys you thinking time.",
  },
  {
    id: "Q3",
    criterion: "qa",
    type: "mcq",
    prompt: "A hostile question challenges your data. Best approach?",
    options: [
      "Get defensive",
      "Stay calm, acknowledge the concern, and answer with evidence",
      "Laugh it off",
      "\"Just read the report.\"",
    ],
    correct: 1,
    why: "Calm, evidence-based answers win over the room.",
  },
  {
    id: "Q4",
    criterion: "qa",
    type: "mcq",
    prompt: "How can you prepare for Q&A?",
    options: [
      "Hope nobody asks anything",
      "Predict the 5 toughest questions and prepare short answers",
      "Run long so there's no time for questions",
      "Memorise your slides",
    ],
    correct: 1,
    why: "Most questions are predictable, so prepare for them.",
  },
];

export const FINAL_POOL: FinalQuestion[] = [
  {
    id: "F1",
    statement: "Reading your slides word-for-word keeps the audience engaged.",
    answer: false,
    why: "The audience can read faster than you can speak. Talk to them, not to the slide.",
  },
  {
    id: "F2",
    statement: "A well-placed pause can make your key point more powerful.",
    answer: true,
    why: "Silence gives a key point room to land.",
  },
  {
    id: "F3",
    statement: "Each slide should have one clear message.",
    answer: true,
    why: "One idea per slide keeps the audience with you.",
  },
  {
    id: "F4",
    statement: "\"So… yeah, that's it\" is a strong way to finish.",
    answer: false,
    why: "Finish by restating your message and making a clear ask.",
  },
  {
    id: "F5",
    statement: "You should adapt your pitch to who's listening.",
    answer: true,
    why: "The same idea needs a different pitch for different audiences.",
  },
  {
    id: "F6",
    statement: "More animations always make slides better.",
    answer: false,
    why: "Animation should direct attention, not decorate.",
  },
];

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
export const FINAL_BY_ID: Record<string, FinalQuestion> = Object.fromEntries(FINAL_POOL.map((q) => [q.id, q]));
