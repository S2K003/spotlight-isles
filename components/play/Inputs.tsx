"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { SPOTLIGHT_CRITERIA } from "@/config/rubric";
import { MockSlide } from "@/components/shared/MockSlide";
import type { PublicQuestion, Rating } from "@/lib/engine/types";

const OPTION_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981"];
const LETTERS = ["A", "B", "C", "D"];

export function LockedIn() {
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glossy mt-4 rounded-2xl px-4 py-3 text-center text-lg font-extrabold text-emerald-300">
      Locked in ✓ <span className="block text-sm font-bold text-white/70">waiting for other teams</span>
    </motion.div>
  );
}

/** Big tap-friendly answer buttons for multiple choice, slide and true/false questions. */
export function AnswerPad({ question, sent, onAnswer, slideWidth }: { question: PublicQuestion; sent: number | undefined; onAnswer: (i: number) => void; slideWidth: number }) {
  const tf = false;
  return (
    <div>
      {question.slide && (
        <div className="mb-3 flex justify-center">
          <MockSlide slide={question.slide} width={slideWidth} />
        </div>
      )}
      <p className="mb-3 text-center text-xl font-extrabold leading-snug">{question.prompt}</p>
      <div className={tf ? "grid grid-cols-2 gap-3" : "grid gap-2.5"}>
        {question.options.map((opt, i) => {
          const chosen = sent === i;
          const color = tf ? (i === 0 ? "#10b981" : "#ef4444") : OPTION_COLORS[i];
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.96 }}
              onClick={() => onAnswer(i)}
              className="btn flex items-center gap-3 px-3 py-2.5 text-left text-[17px] leading-tight text-white"
              style={{
                background: color,
                opacity: sent !== undefined && !chosen ? 0.45 : 1,
                outline: chosen ? "4px solid #fff" : "none",
                minHeight: tf ? 120 : 60,
                justifyContent: tf ? "center" : "flex-start",
                fontSize: tf ? 30 : undefined,
              }}
            >
              {!tf && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/25 font-display text-xl">{LETTERS[i]}</span>}
              <span>{tf ? (i === 0 ? "✔ TRUE" : "✘ FALSE") : opt}</span>
            </motion.button>
          );
        })}
      </div>
      {sent !== undefined && (
        <p className="mt-3 text-center text-sm font-extrabold text-emerald-300">Answer in ✓ — still talking? You can change it until time runs out.</p>
      )}
    </div>
  );
}

/** Three 1–5 star rows: Hook, Clarity, Confidence. Sends as soon as all three are set. */
export function RatingStars({ sent, onRate }: { sent: Rating | undefined; onRate: (r: Rating) => void }) {
  const [draft, setDraft] = useState<Partial<Rating>>(sent ?? {});
  const set = (key: keyof Rating, v: number) => {
    const next = { ...draft, [key]: v };
    setDraft(next);
    if (next.hook && next.clarity && next.confidence) onRate(next as Rating);
  };
  return (
    <div className="grid gap-3">
      {SPOTLIGHT_CRITERIA.map((c) => (
        <div key={c.key} className="glossy rounded-2xl p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl">{c.label}</span>
            <span className="text-xs font-bold text-white/60">{c.hint}</span>
          </div>
          <div className="mt-1 flex justify-between" role="radiogroup" aria-label={c.label}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = (draft[c.key] ?? 0) >= n;
              return (
                <motion.button
                  key={n}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => set(c.key, n)}
                  role="radio"
                  aria-checked={draft[c.key] === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  className="grid h-14 w-14 place-items-center text-[40px] leading-none"
                  style={{ color: on ? "#ffd54a" : "rgba(255,255,255,0.22)", filter: on ? "drop-shadow(0 0 6px rgba(255,213,74,.7))" : "none" }}
                >
                  ★
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
      <p className={`text-center text-sm font-extrabold ${sent ? "text-emerald-300" : "text-white/60"}`}>
        {sent ? "Rating sent ✓ (you can still change it)" : "Rate all three to send"}
      </p>
    </div>
  );
}
