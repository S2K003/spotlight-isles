"use client";

import { useMemo } from "react";
import { TEAM_DEFS } from "@/config/teams";
import { emblemSvgPoints } from "@/game/render/emblems";
import { hexCenter, hexPoints } from "@/game/render/layout";
import { tileColors, toCss } from "@/game/render/palette";
import { distance } from "@/lib/engine/hex";
import type { ReachItem, TeamPublic, Tile } from "@/lib/engine/types";

const SIZE = 30;
const SQ = 0.9;

interface Props {
  tiles: Tile[];
  teams: TeamPublic[];
  teamId: number;
  reach: ReachItem[];
  /** destination → votes from my team */
  tally: Record<string, number>;
  selected: string | null;
  onSelect: (key: string) => void;
  /** Projector (Manual Mode) uses a wider view. */
  radius?: number;
  className?: string;
}

/** Zoomed mini-map centred on the team's ship. Reachable hexes are highlighted and tappable. */
export function VoteMap({ tiles, teams, teamId, reach, tally, selected, onSelect, radius, className }: Props) {
  const me = teams[teamId];
  const reachMap = useMemo(() => new Map(reach.map((r) => [r.key, r.cost])), [reach]);

  const { shown, box } = useMemo(() => {
    const far = reach.reduce((m, r) => {
      const [q, rr] = r.key.split(",").map(Number);
      return Math.max(m, distance({ q, r: rr }, me.pos));
    }, 0);
    const rad = radius ?? Math.max(2, Math.min(6, far + 1));
    const list = tiles.filter((t) => distance(t, me.pos) <= rad);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const t of list) {
      const c = hexCenter(t, SIZE, SQ);
      x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x);
      y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
    }
    return { shown: list, box: `${x0 - SIZE - 4} ${y0 - SIZE - 4} ${x1 - x0 + SIZE * 2 + 8} ${y1 - y0 + SIZE * 2 + 8}` };
  }, [tiles, reach, me.pos, radius]);

  const shipAt = new Map(teams.map((t) => [`${t.pos.q},${t.pos.r}`, t]));

  return (
    <svg viewBox={box} className={className} role="group" aria-label="Choose where your airship goes">
      {shown.map((t) => {
        const k = `${t.q},${t.r}`;
        const c = hexCenter(t, SIZE, SQ);
        const cost = reachMap.get(k);
        const can = cost !== undefined;
        const isSel = selected === k;
        const col = tileColors(t);
        const owner = t.owner !== undefined ? TEAM_DEFS[t.owner] : null;
        const ship = shipAt.get(k);
        const votes = tally[k] ?? 0;
        return (
          <g
            key={k}
            opacity={can || ship?.id === teamId ? 1 : 0.42}
            onClick={can ? () => onSelect(k) : undefined}
            style={{ cursor: can ? "pointer" : "default" }}
            role={can ? "button" : undefined}
            aria-label={can ? `Move to hex ${k}, cost ${cost}` : undefined}
          >
            <polygon points={hexPoints(c.x, c.y, SIZE - 1.5, SQ)} fill={toCss(col.top)} stroke={toCss(col.side)} strokeWidth="2" />
            {owner && <polygon points={hexPoints(c.x, c.y, SIZE - 7, SQ)} fill={owner.color} fillOpacity="0.72" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />}
            {owner && !ship && <polygon points={emblemSvgPoints(owner.shape, c.x, c.y + 9, 5)} fill="rgba(0,0,0,0.5)" />}
            {t.type === "water" && <path d={`M${c.x - 12} ${c.y} q6 -6 12 0 t12 0`} stroke="#dff5ff" strokeWidth="2.5" fill="none" />}
            {t.type === "fog" && <text x={c.x} y={c.y + 5} textAnchor="middle" fontSize="15">☁️</text>}
            {t.type === "swamp" && <text x={c.x} y={c.y + 5} textAnchor="middle" fontSize="14">🫧</text>}
            {t.type === "stage" && <text x={c.x} y={c.y + 6} textAnchor="middle" fontSize="18">🎤</text>}
            {t.chest && <text x={c.x} y={c.y + 6} textAnchor="middle" fontSize="17">🎁</text>}
            {can && (
              <polygon
                points={hexPoints(c.x, c.y, SIZE - 3, SQ)}
                fill={isSel ? "rgba(255,213,74,0.45)" : "rgba(255,255,255,0.14)"}
                stroke={isSel ? "#ffd54a" : "#ffffff"}
                strokeWidth={isSel ? 4.5 : 2.5}
                strokeDasharray={isSel ? undefined : "5 4"}
              />
            )}
            {can && t.type === "fog" && (
              <text x={c.x + 14} y={c.y - 10} textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" stroke="#111" strokeWidth="2.5" paintOrder="stroke">2 MP</text>
            )}
            {ship && (
              <g>
                <circle cx={c.x} cy={c.y - 2} r={ship.id === teamId ? 14 : 11} fill={TEAM_DEFS[ship.id].color} stroke={ship.id === teamId ? "#fff" : "rgba(0,0,0,0.5)"} strokeWidth={ship.id === teamId ? 3 : 2} />
                <polygon points={emblemSvgPoints(TEAM_DEFS[ship.id].shape, c.x, c.y - 2, ship.id === teamId ? 8 : 6)} fill="rgba(10,14,35,0.85)" />
              </g>
            )}
            {votes > 0 && (
              <g>
                {Array.from({ length: Math.min(votes, 5) }, (_, i) => (
                  <circle key={i} cx={c.x - (Math.min(votes, 5) - 1) * 4 + i * 8} cy={c.y + 15} r="3.6" fill="#fff" stroke="#111" strokeWidth="1.2" />
                ))}
                {votes > 5 && (
                  <text x={c.x + 24} y={c.y + 19} fontSize="10" fontWeight="900" fill="#fff" stroke="#111" strokeWidth="2.5" paintOrder="stroke">+{votes - 5}</text>
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
