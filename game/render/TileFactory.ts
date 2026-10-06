import { Container, Graphics, Text } from "pixi.js";
import { TEAM_DEFS, cssToNum } from "@/config/teams";
import type { TeamId, Tile } from "@/lib/engine/types";
import { drawEmblem } from "./emblems";
import { darken, hash2, hexCenter, hexCorners, HEX_SIZE, lighten } from "./layout";
import { tileColors } from "./palette";

export interface TileView {
  tile: Tile;
  key: string;
  cx: number;
  cy: number;
  /** y of the top face centre (where ships and effects sit). */
  top: number;
  root: Container;
  overlay: Graphics;
  decor: Container | null;
  /** A key or star sitting on this tile. */
  token: Container | null;
  tokenKind: string;
  /** Animated bits registered by the decor: called every frame with (time s, dt s). */
  tick: ((t: number, dt: number) => void) | null;
  owner: TeamId | undefined;
}

const CORNERS = hexCorners();

/** Slightly move each shared corner so the grid looks hand-cut; neighbours agree because it hashes world position. */
function jitter(x: number, y: number): { x: number; y: number } {
  return { x: x + (hash2(x, y) - 0.5) * 5, y: y + (hash2(y, x) - 0.5) * 3.2 };
}

function topPoints(cx: number, cy: number, lift: number): number[] {
  const pts: number[] = [];
  for (const c of CORNERS) {
    const j = jitter(cx + c.x, cy + c.y);
    pts.push(j.x - cx, j.y - cy - lift);
  }
  return pts;
}

/** Top face plus the three visible side faces, extruded by the tile's height. */
function drawBody(g: Graphics, tile: Tile, cx: number, cy: number): void {
  const { top, side } = tileColors(tile);
  const h = tile.height;
  const depth = h + 16;
  const pts = topPoints(cx, cy, h);
  const v = hash2(cx * 3.1, cy * 1.7);
  const topColor = v > 0.5 ? lighten(top, (v - 0.5) * 0.16) : darken(top, (0.5 - v) * 0.14);

  // Side faces between corners 0-1 (right), 1-2 (front) and 2-3 (left).
  const shades = [darken(side, 0.18), side, lighten(side, 0.1)];
  for (let i = 0; i < 3; i++) {
    const x0 = pts[i * 2], y0 = pts[i * 2 + 1];
    const x1 = pts[i * 2 + 2], y1 = pts[i * 2 + 3];
    g.poly([x0, y0, x1, y1, x1, y1 + depth, x0, y0 + depth], true).fill({ color: shades[i] });
    // Rock strata line for a carved look.
    g.moveTo(x0, y0 + depth * 0.55).lineTo(x1, y1 + depth * 0.55).stroke({ width: 1.5, color: darken(side, 0.3), alpha: 0.35 });
  }

  g.poly(pts, true).fill({ color: topColor });
  // Rim light on the upper edges, soft dark line on the lower ones.
  g.moveTo(pts[6], pts[7]).lineTo(pts[8], pts[9]).lineTo(pts[10], pts[11]).lineTo(pts[0], pts[1])
    .stroke({ width: 2, color: lighten(topColor, 0.45), alpha: 0.75 });
  g.moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]).lineTo(pts[4], pts[5]).lineTo(pts[6], pts[7])
    .stroke({ width: 1.5, color: darken(topColor, 0.35), alpha: 0.5 });

  // Subtle speckle "noise" on the top face.
  for (let i = 0; i < 6; i++) {
    const a = hash2(cx + i * 7.3, cy - i * 3.1) * Math.PI * 2;
    const r = hash2(cx - i * 2.9, cy + i * 5.7) * HEX_SIZE * 0.62;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.62 - h;
    g.circle(px, py, 1.6 + hash2(px, py) * 1.6).fill({ color: i % 2 ? lighten(topColor, 0.25) : darken(topColor, 0.2), alpha: 0.45 });
  }
}

/* ---------- biome decorations ---------- */

type Tick = (t: number, dt: number) => void;

function decorate(tile: Tile, cx: number, cy: number): { view: Container; tick: Tick | null } | null {
  const seed = hash2(cx * 0.37, cy * 0.91);
  const view = new Container();
  view.y = -tile.height;
  const g = new Graphics();
  view.addChild(g);
  const { accent } = tileColors(tile);
  const phase = seed * 10;

  if (tile.type === "stage") {
    // Keynote Stage: a round dais with a lectern and a pulsing halo.
    const halo = new Graphics().ellipse(0, 0, 40, 25).fill({ color: 0xfff1b8, alpha: 0.5 });
    view.addChildAt(halo, 0);
    g.ellipse(0, 0, 27, 16).fill({ color: 0xfff8dc }).stroke({ width: 2, color: 0xd9a441 });
    g.ellipse(0, -4, 20, 11).fill({ color: 0xffe08a });
    g.roundRect(-5, -26, 10, 22, 2).fill({ color: 0x8a5a1f });
    g.roundRect(-9, -30, 18, 6, 2).fill({ color: 0xc98a2b });
    g.circle(0, -36, 4).fill({ color: 0xffffff });
    return { view, tick: (t) => { halo.alpha = 0.35 + Math.sin(t * 2.2) * 0.2; halo.scale.set(1 + Math.sin(t * 2.2) * 0.06); } };
  }
  if (tile.type === "plaza") {
    g.ellipse(0, 0, 22, 13).stroke({ width: 2, color: 0xcfc6b8, alpha: 0.9 });
    g.ellipse(0, 0, 11, 6.5).stroke({ width: 1.5, color: 0xd8b56a, alpha: 0.9 });
    return { view, tick: null };
  }
  if (tile.type === "water") return null;

  if (seed < 0.3) return null; // leave some land bare so the map can breathe

  switch (tile.region) {
    case "structure": {
      const n = 2 + Math.floor(seed * 2.5);
      const glints: Graphics[] = [];
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 11 + (hash2(cx + i, cy) - 0.5) * 6;
        const hgt = 16 + hash2(cx, cy + i) * 20;
        const c = new Graphics();
        c.poly([x - 4.5, 2, x - 3, -hgt + 5, x, -hgt, x + 3, -hgt + 5, x + 4.5, 2], true).fill({ color: accent, alpha: 0.92 });
        c.poly([x, -hgt, x + 3, -hgt + 5, x + 4.5, 2, x, 2], true).fill({ color: darken(accent, 0.25), alpha: 0.7 });
        view.addChild(c);
        glints.push(c);
      }
      return { view, tick: (t) => glints.forEach((c, i) => (c.alpha = 0.8 + Math.sin(t * 1.6 + phase + i * 1.7) * 0.2)) };
    }
    case "visuals": {
      const cols = [0xff7be5, 0xffd54a, 0x6ee7ff, 0xff8f6b];
      for (let i = 0; i < 5; i++) {
        const x = (hash2(cx + i * 3, cy) - 0.5) * 44;
        const y = (hash2(cx, cy + i * 3) - 0.5) * 22;
        g.rect(x - 0.7, y - 6, 1.4, 6).fill({ color: 0x3f8f3a });
        g.circle(x, y - 7, 3.2).fill({ color: cols[i % 4] });
        g.circle(x, y - 7, 1.2).fill({ color: 0xffffff });
      }
      const prism = new Graphics().poly([0, -18, 9, 0, -9, 0], true).fill({ color: 0xffffff, alpha: 0.75 }).stroke({ width: 1.5, color: accent });
      prism.position.set((seed - 0.5) * 20, -3);
      view.addChild(prism);
      return { view, tick: (t) => { prism.tint = [0xffd6f7, 0xd6f4ff, 0xfff3c4][Math.floor(t * 0.8 + phase) % 3]; } };
    }
    case "delivery": {
      const stalks: Graphics[] = [];
      for (let i = 0; i < 6; i++) {
        const s = new Graphics();
        s.moveTo(0, 0).lineTo(0, -13).stroke({ width: 1.8, color: 0xb98a1e });
        s.ellipse(0, -15, 2.2, 4.5).fill({ color: 0xffe08a });
        s.position.set((hash2(cx + i * 5, cy) - 0.5) * 46, (hash2(cx, cy + i * 5) - 0.5) * 22 + 3);
        view.addChild(s);
        stalks.push(s);
      }
      return { view, tick: (t) => stalks.forEach((s, i) => (s.rotation = Math.sin(t * 1.8 + phase + i * 0.6) * 0.22)) };
    }
    case "engagement": {
      g.ellipse(-4, 2, 17, 8).fill({ color: 0x4fe3d4, alpha: 0.55 });
      g.circle(11, -3, 4).fill({ color: 0xff6f91 }).circle(15, 1, 2.5).fill({ color: 0xff9eb5 });
      // A little palm.
      g.moveTo(-10, 2).quadraticCurveTo(-12, -10, -8, -20).stroke({ width: 2.5, color: 0x8a5a2b });
      const leaves = new Graphics();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.62;
        leaves.moveTo(0, 0).quadraticCurveTo(Math.cos(a) * 9, Math.sin(a) * 9 - 3, Math.cos(a) * 15, Math.sin(a) * 11 + 3).stroke({ width: 2.4, color: 0x2fae6b });
      }
      leaves.position.set(-8, -20);
      view.addChild(leaves);
      return { view, tick: (t) => (leaves.rotation = Math.sin(t * 1.2 + phase) * 0.12) };
    }
    case "timing": {
      const gear = new Graphics();
      const teeth = 8, r0 = 9, r1 = 13;
      const pts: number[] = [];
      for (let i = 0; i < teeth * 2; i++) {
        const a = (Math.PI * i) / teeth;
        const r = i % 2 ? r0 : r1;
        pts.push(Math.cos(a - 0.1) * r, Math.sin(a - 0.1) * r, Math.cos(a + 0.1) * r, Math.sin(a + 0.1) * r);
      }
      gear.poly(pts, true).fill({ color: 0xe0b060 }).stroke({ width: 1.2, color: 0x7d5a2b });
      gear.circle(0, 0, 3.5).fill({ color: 0x6b4a1f });
      const holder = new Container();
      holder.addChild(gear);
      holder.scale.set(1, 0.62);
      holder.position.set((seed - 0.5) * 16, -1);
      view.addChild(holder);
      const dir = seed > 0.6 ? 1 : -1;
      return { view, tick: (_t, dt) => (gear.rotation += dt * 0.7 * dir) };
    }
    case "qa":
    default: {
      for (let i = 0; i < 4; i++) {
        const x = (hash2(cx + i * 4, cy) - 0.5) * 40;
        g.moveTo(x, 4).lineTo(x + 1, -10 - i * 2).stroke({ width: 1.6, color: 0x2d6b4f });
        g.ellipse(x + 1, -12 - i * 2, 1.8, 4).fill({ color: 0x5a3d1e });
      }
      const fly = new Text({ text: "?", style: { fontFamily: "Nunito, sans-serif", fontSize: 15, fill: 0xeaffb0, fontWeight: "900" } });
      fly.anchor.set(0.5);
      const glow = new Graphics().circle(0, 0, 8).fill({ color: 0xd8ff7a, alpha: 0.35 });
      view.addChild(glow, fly);
      return {
        view,
        tick: (t) => {
          const x = Math.sin(t * 0.7 + phase) * 14;
          const y = -22 + Math.cos(t * 0.9 + phase * 2) * 7;
          fly.position.set(x, y);
          glow.position.set(x, y);
          const a = 0.55 + Math.sin(t * 3 + phase) * 0.4;
          fly.alpha = a;
          glow.alpha = a * 0.5;
        },
      };
    }
  }
}

/** A team's key: a golden key on a disc in the team's colour, with its emblem, so each crew can spot its own. */
export function makeKey(teamId: TeamId): Container {
  const def = TEAM_DEFS[teamId];
  const color = cssToNum(def.color);
  const c = new Container();
  const glow = new Graphics().ellipse(0, 4, 26, 13).fill({ color: lighten(color, 0.3), alpha: 0.55 });
  const g = new Graphics();
  g.circle(0, -20, 17).fill({ color }).stroke({ width: 3, color: 0xffffff });
  // Key shape: bow, shaft and two teeth.
  g.circle(-5, -20, 5.5).fill({ color: 0xffe27a }).stroke({ width: 1.5, color: 0x6b4a10 });
  g.circle(-5, -20, 2).fill({ color: darken(color, 0.2) });
  g.rect(0, -21.5, 12, 3).fill({ color: 0xffe27a });
  g.rect(7, -18.5, 2.2, 4).fill({ color: 0xffe27a }).rect(10.5, -18.5, 2.2, 3).fill({ color: 0xffe27a });
  drawEmblem(g, def.shape, 0, -44, 7, 0xffffff);
  drawEmblem(g, def.shape, 0, -44, 5.4, darken(color, 0.1));
  c.addChild(glow, g);
  return c;
}

/** A bonus star. */
export function makeStar(): Container {
  const c = new Container();
  const glow = new Graphics().ellipse(0, 4, 22, 11).fill({ color: 0xfff1a8, alpha: 0.5 });
  const g = new Graphics();
  g.star(0, -16, 5, 15, 7).fill({ color: 0xffd54a }).stroke({ width: 2, color: 0x9a6a00 });
  g.star(-2, -18, 5, 6, 3).fill({ color: 0xfff6c8, alpha: 0.8 });
  c.addChild(glow, g);
  return c;
}
/** Trail overlay: the colour and emblem of the last crew to fly over a tile (decoration only; homes are solid). */
export function drawOverlay(g: Graphics, view: TileView, owner: TeamId | undefined, shielded = false): void {
  g.clear();
  if (owner === undefined) return;
  const def = TEAM_DEFS[owner];
  const color = cssToNum(def.color);
  const pts = topPoints(view.cx, view.cy, view.tile.height);
  g.poly(pts, true).fill({ color, alpha: shielded ? 0.75 : 0.4 }).stroke({ width: 2.5, color: lighten(color, 0.35), alpha: 0.85 });
  drawEmblem(g, def.shape, 0, -view.tile.height + 10, 7.5, darken(color, 0.45), 0.8);
}

export function buildTile(tile: Tile): TileView {
  const { x: cx, y: cy } = hexCenter(tile);
  const root = new Container();
  root.position.set(cx, cy);
  root.zIndex = cy;
  const body = new Graphics();
  drawBody(body, tile, cx, cy);
  root.addChild(body);
  const overlay = new Graphics();
  root.addChild(overlay);
  const view: TileView = {
    tile,
    key: `${tile.q},${tile.r}`,
    cx,
    cy,
    top: cy - tile.height,
    root,
    overlay,
    decor: null,
    token: null,
    tokenKind: "",
    tick: null,
    owner: undefined,
  };
  const d = decorate(tile, cx, cy);
  if (d) {
    view.decor = d.view;
    view.tick = d.tick;
    root.addChild(d.view);
  }
  return view;
}
