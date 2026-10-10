"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { normalizeRoomCode } from "@/lib/engine/rng";
import { useWorkshop } from "./workshop";

/** The room code (from ?code= or the lobby open in this browser), the site address and a join QR. */
export function useJoin(): { code: string; origin: string; qr: string } {
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
    let c = normalizeRoomCode(new URLSearchParams(window.location.search).get("code") ?? "");
    if (!c) {
      try {
        c = JSON.parse(localStorage.getItem("spotlight-isles:host") ?? "{}").roomCode ?? "";
      } catch {
        /* ignore */
      }
    }
    setCode(c);
  }, []);
  useEffect(() => {
    if (!origin || code.length !== 4) return;
    QRCode.toDataURL(`${origin}/play/${code}`, { margin: 1, width: 500, errorCorrectionLevel: "M" }).then(setQr).catch(() => {});
  }, [origin, code]);
  return { code, origin, qr };
}

const LINKS: [string, string][] = [
  ["/pack", "Everything in one PDF"],
  ["/plan", "Workshop plan"],
  ["/slides", "Slides"],
  ["/guide", "Facilitator guide"],
  ["/student", "Student guide"],
];

/** Screen-only toolbar for the plan, slides and pack pages: print button, links, and what is still to fill in. */
export function PrintBar({ title, hint, here }: { title: string; hint: string; here: string }) {
  const { todo, reset } = useWorkshop();
  return (
    <div className="no-print mx-auto mb-4 max-w-[210mm] rounded-xl bg-white p-3 text-sm text-[#151a2e] shadow">
      <div className="flex flex-wrap items-center gap-3">
        <strong>{title}</strong>
        <button onClick={() => window.print()} className="rounded bg-[#151a2e] px-3 py-1 font-bold text-white">
          Print / Save as PDF
        </button>
        {LINKS.filter(([href]) => href !== here).map(([href, label]) => (
          <a key={href} href={href} className="underline">
            {label}
          </a>
        ))}
      </div>
      <p className="mt-1 text-gray-700">{hint}</p>
      <p className="mt-1">
        {todo > 0 ? (
          <span className="rounded bg-[#fff3b0] px-1 font-bold">
            {todo} highlighted {todo === 1 ? "box is" : "boxes are"} still to fill in.
          </span>
        ) : (
          <span className="font-bold text-emerald-700">Every box is filled in.</span>
        )}{" "}
        Click any highlighted or underlined text to type over it. It is saved in this browser and shared between the plan, the slides and the pack.{" "}
        <button
          className="underline"
          onClick={() => {
            if (window.confirm("Clear everything you typed and go back to the placeholders?")) reset();
          }}
        >
          Start again
        </button>
      </p>
    </div>
  );
}
