import { Container, Graphics } from "pixi.js";

export type TimeOfDay = "dawn" | "day" | "sunset" | "night";

/** World light tint and cloud colour for each time of day (the sky gradient itself is CSS, behind the canvas). */
export const LIGHT: Record<TimeOfDay, { tint: number; cloud: number; cloudAlpha: number }> = {
  dawn: { tint: 0xffe1d2, cloud: 0xffd9e6, cloudAlpha: 0.75 },
  day: { tint: 0xffffff, cloud: 0xffffff, cloudAlpha: 0.8 },
  sunset: { tint: 0xffd0a0, cloud: 0xffc48f, cloudAlpha: 0.75 },
  night: { tint: 0x8d9bdc, cloud: 0x5868a8, cloudAlpha: 0.5 },
};

interface Cloud {
  g: Graphics;
  speed: number;
  y: number;
}

/** Drifting cloud layers with parallax, drawn under and in front of the islands. */
export class Clouds {
  readonly back = new Container();
  readonly front = new Container();
  private clouds: Cloud[] = [];
  private w = 1920;
  private h = 1080;

  constructor() {
    for (let i = 0; i < 12; i++) {
      const isFront = i >= 9;
      const g = new Graphics();
      const s = isFront ? 1.7 : 0.6 + (i % 4) * 0.25;
      for (let k = 0; k < 5; k++) {
        g.ellipse((k - 2) * 46 * s, Math.sin(k * 1.9 + i) * 10 * s, (58 - Math.abs(k - 2) * 9) * s, (24 - Math.abs(k - 2) * 4) * s).fill({ color: 0xffffff, alpha: isFront ? 0.16 : 0.5 });
      }
      (isFront ? this.front : this.back).addChild(g);
      this.clouds.push({ g, speed: (isFront ? 26 : 6 + (i % 4) * 5) * (i % 2 ? 1 : 0.8), y: 0 });
    }
    this.layout(this.w, this.h);
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.clouds.forEach((c, i) => {
      const isFront = i >= 9;
      c.y = isFront ? h * (0.72 + (i - 9) * 0.1) : h * (0.12 + ((i * 37) % 80) / 100);
      c.g.position.set(((i * 271) % 1000) / 1000 * (w + 600) - 300, c.y);
    });
  }

  setLook(color: number, alpha: number): void {
    this.back.tint = color;
    this.front.tint = color;
    this.back.alpha = alpha;
  }

  update(dt: number, t: number): void {
    for (const c of this.clouds) {
      c.g.x += c.speed * dt;
      c.g.y = c.y + Math.sin(t * 0.2 + c.speed) * 6;
      if (c.g.x > this.w + 320) c.g.x = -320;
    }
  }
}

/** Sweeping stage spotlights for the Final Showdown. */
export class Spotlights {
  readonly view = new Container();
  private beams: { g: Graphics; base: number; speed: number; amp: number }[] = [];
  private target = 0;

  constructor() {
    this.view.alpha = 0;
    this.view.blendMode = "add";
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      g.poly([0, 0, -150, -1500, 150, -1500], true).fill({ color: i % 2 ? 0xfff0b0 : 0xbfd8ff, alpha: 0.16 });
      g.poly([0, 0, -60, -1500, 60, -1500], true).fill({ color: 0xffffff, alpha: 0.1 });
      this.view.addChild(g);
      this.beams.push({ g, base: (i - 1.5) * 0.28, speed: 0.5 + i * 0.13, amp: 0.38 });
    }
  }

  layout(w: number, h: number): void {
    this.beams.forEach((b, i) => b.g.position.set(w * (0.12 + i * 0.25), h + 40));
  }

  show(on: boolean): void {
    this.target = on ? 1 : 0;
  }

  update(dt: number, t: number): void {
    this.view.alpha += (this.target - this.view.alpha) * Math.min(1, dt * 1.5);
    this.view.visible = this.view.alpha > 0.01;
    if (!this.view.visible) return;
    for (const b of this.beams) b.g.rotation = b.base + Math.sin(t * b.speed + b.base * 9) * b.amp;
  }
}
