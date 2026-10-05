"use client";

import { useParams } from "next/navigation";
import PlayApp from "@/components/play/PlayApp";
import { normalizeRoomCode } from "@/lib/engine/rng";

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(String(params.code ?? ""));
  if (code.length !== 4) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="font-display text-3xl text-gold">That room code doesn&apos;t look right</p>
          <a href="/" className="btn mt-4 inline-flex items-center bg-gold px-6 text-ink">
            Enter a code
          </a>
        </div>
      </div>
    );
  }
  return <PlayApp code={code} />;
}
