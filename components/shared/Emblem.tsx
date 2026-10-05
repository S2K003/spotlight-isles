import { TEAM_DEFS } from "@/config/teams";
import { emblemSvgPoints } from "@/game/render/emblems";

/** A team's emblem on a coloured disc. Shape + colour together identify the team (colour-blind friendly). */
export function Emblem({ teamId, size = 32, className = "" }: { teamId: number; size?: number; className?: string }) {
  const def = TEAM_DEFS[teamId];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label={`${def.name} emblem`}>
      <circle cx="20" cy="20" r="18.5" fill={def.color} stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
      <ellipse cx="15" cy="12" rx="9" ry="5" fill="rgba(255,255,255,0.3)" />
      <polygon points={emblemSvgPoints(def.shape, 20, 20, 11)} fill="rgba(10,14,35,0.82)" />
    </svg>
  );
}

/** A small code-drawn airship for the phone waiting room and "look at the big screen" moments. */
export function Airship({ teamId, size = 140 }: { teamId: number; size?: number }) {
  const def = TEAM_DEFS[teamId];
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 150 120" aria-hidden>
      <polygon points="20,48 2,30 2,66" fill={def.color} opacity="0.75" />
      <line x1="48" y1="76" x2="58" y2="96" stroke="#5a4028" strokeWidth="3" />
      <line x1="102" y1="76" x2="92" y2="96" stroke="#5a4028" strokeWidth="3" />
      <rect x="52" y="94" width="46" height="20" rx="8" fill="#9b6a3c" stroke="#5a3a1c" strokeWidth="3" />
      <ellipse cx="75" cy="48" rx="58" ry="36" fill={def.color} stroke="rgba(0,0,0,0.35)" strokeWidth="4" />
      <ellipse cx="75" cy="48" rx="28" ry="36" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="3" />
      <ellipse cx="56" cy="32" rx="24" ry="10" fill="rgba(255,255,255,0.35)" />
      <circle cx="75" cy="48" r="20" fill="#fff" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
      <polygon points={emblemSvgPoints(def.shape, 75, 48, 13)} fill="rgba(10,14,35,0.85)" />
    </svg>
  );
}
