import type { Graphics } from "pixi.js";
import type { TeamDef } from "@/config/teams";

type Shape = TeamDef["shape"];

/** Unit-size outline (roughly −1..1) for each team emblem, shared by Pixi and SVG. */
export function emblemPath(shape: Shape): number[] {
  switch (shape) {
    case "star": {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 1 : 0.45;
        const a = -Math.PI / 2 + (Math.PI / 5) * i;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      return pts;
    }
    case "bolt":
      return [0.25, -1, -0.65, 0.15, -0.05, 0.15, -0.3, 1, 0.65, -0.2, 0.05, -0.2];
    case "wave":
      return [-1, -0.1, -0.5, -0.6, 0, -0.1, 0.5, -0.6, 1, -0.1, 1, 0.5, 0.5, 0, 0, 0.5, -0.5, 0, -1, 0.5];
    case "triangle":
      return [0, -0.95, 0.95, 0.75, -0.95, 0.75];
    case "diamond":
      return [0, -1, 0.8, 0, 0, 1, -0.8, 0];
    case "circle":
    default: {
      const pts: number[] = [];
      for (let i = 0; i < 20; i++) {
        const a = (Math.PI * 2 * i) / 20;
        pts.push(Math.cos(a) * 0.85, Math.sin(a) * 0.85);
      }
      return pts;
    }
  }
}

export function drawEmblem(g: Graphics, shape: Shape, x: number, y: number, size: number, color: number, alpha = 1): void {
  const pts = emblemPath(shape).map((v, i) => (i % 2 === 0 ? x + v * size : y + v * size));
  g.poly(pts, true).fill({ color, alpha });
}

export function emblemSvgPoints(shape: Shape, x: number, y: number, size: number): string {
  const p = emblemPath(shape);
  const out: string[] = [];
  for (let i = 0; i < p.length; i += 2) out.push(`${(x + p[i] * size).toFixed(1)},${(y + p[i + 1] * size).toFixed(1)}`);
  return out.join(" ");
}
