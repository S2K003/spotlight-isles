import { Container, Graphics, Sprite, Texture, type Renderer } from "pixi.js";

interface P {
  s: Sprite;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  spin: number;
  a0: number;
}

export interface BurstOpts {
  count?: number;
  speed?: number;
  life?: number;
  gravity?: number;
  size?: number;
  grow?: number;
  spread?: number;
  angle?: number;
  square?: boolean;
  alpha?: number;
  up?: number;
}

/** Lightweight pooled-sprite particle system for splashes, sparks, fireflies, fog wisps and confetti. */
export class Particles {
  readonly view = new Container();
  private live: P[] = [];
  private pool: Sprite[] = [];
  private dot: Texture;
  private square: Texture;
  private cap: number;

  constructor(renderer: Renderer, cap = 900) {
    this.cap = cap;
    const g = new Graphics();
    g.circle(16, 16, 16).fill({ color: 0xffffff, alpha: 0.25 });
    g.circle(16, 16, 11).fill({ color: 0xffffff, alpha: 0.5 });
    g.circle(16, 16, 6).fill({ color: 0xffffff, alpha: 1 });
    this.dot = renderer.generateTexture(g);
    g.destroy();
    const q = new Graphics();
    q.rect(0, 0, 12, 8).fill({ color: 0xffffff });
    this.square = renderer.generateTexture(q);
    q.destroy();
  }

  setCap(n: number): void {
    this.cap = n;
  }

  emit(x: number, y: number, color: number, o: BurstOpts = {}): void {
    const count = o.count ?? 10;
    for (let i = 0; i < count; i++) {
      if (this.live.length >= this.cap) return;
      const s = this.pool.pop() ?? new Sprite();
      s.texture = o.square ? this.square : this.dot;
      s.anchor.set(0.5);
      s.tint = color;
      s.position.set(x, y);
      const a = (o.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = (o.speed ?? 120) * (0.4 + Math.random() * 0.8);
      const size = (o.size ?? 0.3) * (0.6 + Math.random() * 0.8);
      s.scale.set(size);
      s.alpha = o.alpha ?? 1;
      s.rotation = Math.random() * 6.28;
      s.visible = true;
      this.view.addChild(s);
      this.live.push({
        s,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (o.up ?? 0),
        g: o.gravity ?? 260,
        life: 0,
        max: (o.life ?? 0.7) * (0.7 + Math.random() * 0.6),
        s0: size,
        s1: size * (o.grow ?? 0.2),
        spin: o.square ? (Math.random() - 0.5) * 12 : 0,
        a0: o.alpha ?? 1,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        p.s.visible = false;
        this.view.removeChild(p.s);
        this.pool.push(p.s);
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
        continue;
      }
      p.vy += p.g * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      p.s.scale.set(p.s0 + (p.s1 - p.s0) * t);
      p.s.alpha = p.a0 * (1 - t * t);
    }
  }

  get count(): number {
    return this.live.length;
  }
}
