"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LEARNING_OBJECTIVES } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { normalizeRoomCode } from "@/lib/engine/rng";
import { Emblem } from "@/components/shared/Emblem";

export default function Landing() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const ready = code.length === 4;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="sky sky-dawn" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0b1026] to-transparent" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center px-5 pb-8 pt-12">
        <div className="bob flex gap-2">
          {TEAM_DEFS.map((t) => (
            <Emblem key={t.id} teamId={t.id} size={34} />
          ))}
        </div>
        <h1 className="title-stroke mt-5 text-center font-display text-6xl leading-none text-gold">
          SPOTLIGHT
          <br />
          ISLES
        </h1>
        <p className="mt-3 text-center text-lg font-bold text-white/90">Six airship crews race to the Keynote Stage. Talk it through, pitch it well, fly first.</p>

        <form
          className="glossy mt-8 w-full rounded-3xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) router.push(`/play/${code}`);
          }}
        >
          <label htmlFor="code" className="block text-center text-sm font-extrabold uppercase tracking-widest text-white/70">
            Room code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={4}
            placeholder="ABCD"
            className="mt-2 w-full rounded-2xl border-2 border-white/25 bg-black/30 py-3 text-center font-display text-5xl tracking-[0.35em] text-white outline-none placeholder:text-white/20 focus:border-gold"
          />
          <button type="submit" disabled={!ready} className="btn mt-4 w-full bg-gold text-2xl text-ink">
            JOIN GAME
          </button>
        </form>

        <Link href="/host" className="btn mt-4 flex w-full items-center justify-center bg-white/15 text-lg text-white">
          Host a game (projector)
        </Link>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-bold text-white/70">
          <Link href="/pack" className="underline">
            Workshop pack
          </Link>
          <Link href="/slides" className="underline">
            Slides
          </Link>
          <Link href="/student" className="underline">
            Student guide
          </Link>
          <Link href="/guide" className="underline">
            Facilitator guide
          </Link>
          <Link href="/dev/bots" className="underline">
            Bot simulator
          </Link>
        </div>

        <ul className="mt-8 space-y-2 text-sm text-white/80">
          {LEARNING_OBJECTIVES.map((o) => (
            <li key={o} className="flex gap-2">
              <span className="text-gold">★</span>
              {o}
            </li>
          ))}
        </ul>
        <p className="mt-auto pt-8 text-center text-xs text-white/55">
          Privacy: only the nickname you type is collected. No accounts, no tracking, and nothing is stored after the session.
        </p>
      </div>
    </main>
  );
}
