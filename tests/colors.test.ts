import { describe, expect, it } from "vitest";
import { TEAM_DEFS } from "@/config/teams";

/**
 * Colour-blindness check for the six team colours. Each colour is pushed through the
 * Machado, Oliveira & Fernandes (2009) simulation matrices for full protanopia, deuteranopia
 * and tritanopia, and every pair must still be clearly different (CIE76 ΔE in Lab).
 * Teams also carry a unique emblem shape, so colour is never the only cue.
 */
const SIM: Record<string, number[][]> = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function lab(hex: string, m: number[][]): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  const [r, g, b] = m.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function minPairDelta(m: number[][]): { delta: number; pair: string } {
  let best = { delta: Infinity, pair: "" };
  for (let i = 0; i < TEAM_DEFS.length; i++) {
    for (let j = i + 1; j < TEAM_DEFS.length; j++) {
      const a = lab(TEAM_DEFS[i].color, m);
      const b = lab(TEAM_DEFS[j].color, m);
      const delta = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (delta < best.delta) best = { delta, pair: `${TEAM_DEFS[i].name}/${TEAM_DEFS[j].name}` };
    }
  }
  return best;
}

describe("team colours", () => {
  for (const [name, matrix] of Object.entries(SIM)) {
    it(`all six stay distinguishable under ${name}`, () => {
      const worst = minPairDelta(matrix);
      // ΔE ≈ 2 is "just noticeable"; we ask for a wide margin on a projector.
      expect(worst.delta, `closest pair: ${worst.pair}`).toBeGreaterThan(18);
    });
  }

  it("every team has a unique emblem shape as well as a colour", () => {
    expect(new Set(TEAM_DEFS.map((t) => t.shape)).size).toBe(6);
    expect(new Set(TEAM_DEFS.map((t) => t.emblem)).size).toBe(6);
    expect(new Set(TEAM_DEFS.map((t) => t.color)).size).toBe(6);
  });
});
