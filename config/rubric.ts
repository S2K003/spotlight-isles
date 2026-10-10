import type { CriterionKey } from "@/lib/engine/types";

/**
 * Region names and criterion keys. If the course has an official presentation
 * rubric, rename `label` / `region` here to match it exactly.
 * The order matters: region i is the wedge around team i's home corner.
 */
export const CRITERIA: CriterionKey[] = ["structure", "visuals", "delivery", "engagement", "timing", "qa"];

export interface RubricEntry {
  label: string;
  region: string;
  icon: string;
  /** Top-face colour of the biome (hex number for Pixi) and a CSS colour for the UI. */
  tile: number;
  side: number;
  accent: number;
  css: string;
  height: number;
  blurb: string;
}

export const RUBRIC: Record<CriterionKey, RubricEntry> = {
  structure: {
    label: "Structure",
    region: "Structure Peaks",
    icon: "🏔️",
    tile: 0x7b8aa6,
    side: 0x4a5670,
    accent: 0x7fd4ff,
    css: "#7fb4ff",
    height: 20,
    blurb: "Hook → problem → solution → proof → ask",
  },
  visuals: {
    label: "Visuals",
    region: "Visual Valley",
    icon: "🎨",
    tile: 0x8fd16a,
    side: 0x4f8a43,
    accent: 0xff7be5,
    css: "#ff7be5",
    height: 11,
    blurb: "One idea per slide, high contrast, right chart",
  },
  delivery: {
    label: "Delivery",
    region: "Delivery Plains",
    icon: "🌾",
    tile: 0xf0c85a,
    side: 0xb58a2c,
    accent: 0xfff2b0,
    css: "#f6c84c",
    height: 9,
    blurb: "Voice, pace, pauses and eye contact",
  },
  engagement: {
    label: "Engagement",
    region: "Engagement Coast",
    icon: "🏖️",
    tile: 0xf7b89a,
    side: 0xc97f63,
    accent: 0x4fe3d4,
    css: "#ff9d7a",
    height: 6,
    blurb: "Stories, analogies and audience interaction",
  },
  timing: {
    label: "Timing",
    region: "Time Fortress",
    icon: "⚙️",
    tile: 0xc79a55,
    side: 0x7d5a2b,
    accent: 0xffd98a,
    css: "#d9a85c",
    height: 15,
    blurb: "Rehearse with a timer, protect your ending",
  },
  qa: {
    label: "Q&A",
    region: "Q&A Bayou",
    icon: "❓",
    tile: 0x4fa39a,
    side: 0x2c6b66,
    accent: 0xb8ffe9,
    css: "#5fd6c4",
    height: 5,
    blurb: "Listen, rephrase, answer with evidence",
  },
};

export const SPOTLIGHT_CRITERIA = [
  { key: "hook", label: "Hook", maps: "Engagement", hint: "Did the opening grab you?" },
  { key: "clarity", label: "Clarity", maps: "Structure", hint: "Was the message easy to follow?" },
  { key: "confidence", label: "Confidence", maps: "Delivery", hint: "Voice, pace and eye contact" },
] as const;

export const OBJECTIVES_SHORT = ["Recognise strong presentations", "Pitch as a team", "Mark fairly with a rubric", "Decide together"];

export const LEARNING_OBJECTIVES = [
  "Recognise what makes a presentation strong: structure, slides, delivery and handling questions.",
  "Practise a short oral pitch as a team, with a hook, clarity and confidence.",
  "Practise assessing presentations against a rubric, fairly and consistently.",
  "Make team decisions through discussion and clear communication.",
];
