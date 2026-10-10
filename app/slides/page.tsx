"use client";

import { useEffect, useState } from "react";
import { useJoin } from "@/components/print/PrintBar";
import { ScaledSlide, SLIDE_H, SLIDE_W, SLIDES } from "@/components/print/Slides";
import { useWorkshop } from "@/components/print/workshop";

/**
 * The slide deck for the whole hour. Arrow keys, space or a click move between slides; F goes
 * full screen. Click any highlighted text to type your own. Printing gives one slide per page.
 */
export default function SlidesPage() {
  const ctx = useJoin();
  const { todo } = useWorkshop();
  const [i, setI] = useState(0);
  const [size, setSize] = useState({ w: SLIDE_W, h: SLIDE_H });

  useEffect(() => {
    const fit = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't steal keys while someone is typing into a slide.
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) setI((n) => Math.min(SLIDES.length - 1, n + 1));
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) setI((n) => Math.max(0, n - 1));
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(SLIDES.length - 1);
      else if (e.key.toLowerCase() === "f") void document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const width = Math.min(size.w, (size.h * SLIDE_W) / SLIDE_H);
  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 0; } }"}</style>

      <div className="no-print fixed inset-0 grid place-items-center bg-black">
        <ScaledSlide index={i} width={width} ctx={ctx} />
        <div className="fixed bottom-2 right-3 flex items-center gap-2 text-sm font-bold text-white/70">
          {todo > 0 && <span className="rounded bg-[#fff3b0] px-2 text-[#151a2e]">{todo} to fill in</span>}
          <a href="/pack" className="underline">
            Pack
          </a>
          <button className="underline" onClick={() => window.print()}>
            Print
          </button>
          <button className="rounded bg-white/15 px-2" onClick={() => setI((n) => Math.max(0, n - 1))} aria-label="Previous slide">
            ‹
          </button>
          <span className="tabular-nums">
            {i + 1} / {SLIDES.length}
          </span>
          <button className="rounded bg-white/15 px-2" onClick={() => setI((n) => Math.min(SLIDES.length - 1, n + 1))} aria-label="Next slide">
            ›
          </button>
        </div>
      </div>

      {/* Print: every slide, one per landscape page. */}
      <div className="hidden print:block">
        {SLIDES.map((_, n) => (
          <div key={n} className="slide-page">
            <ScaledSlide index={n} width={1122} ctx={ctx} />
          </div>
        ))}
      </div>
    </>
  );
}
