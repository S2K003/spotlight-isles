import { Container, Graphics, Text } from "pixi.js";
import { TEAM_DEFS, cssToNum } from "@/config/teams";
import type { TeamId } from "@/lib/engine/types";
import { drawEmblem } from "./emblems";
import { darken, lighten } from "./layout";

/** One team's airship, drawn entirely in code: balloon, gondola, propeller, emblem and status badges. */
export class Ship {
  readonly view = new Container();
  readonly color: number;
  private body = new Container();
  private shadow = new Graphics();
  private prop = new Graphics();
  private ring = new Graphics();
  private badge = new Container();
  private badgeBg = new Graphics();
  private badgeText: Text;
  private phase: number;
  private fright = false;
  private progress = -1;
  /** Extra offset applied on top of the hover bob (used for bounces). */
  kick = { x: 0, y: 0 };
  spin = 1;

  constructor(readonly teamId: TeamId, font: string) {
    const def = TEAM_DEFS[teamId];
    this.color = cssToNum(def.color);
    this.phase = teamId * 1.3;
    const c = this.color;

    this.shadow.ellipse(0, 0, 20, 9).fill({ color: 0x000000, alpha: 0.28 });
    this.view.addChild(this.shadow, this.ring, this.body);

    const g = new Graphics();
    // Ropes and gondola.
    g.moveTo(-13, -30).lineTo(-8, -14).moveTo(13, -30).lineTo(8, -14).stroke({ width: 1.5, color: 0x5a4028 });
    g.roundRect(-11, -16, 22, 10, 4).fill({ color: 0x9b6a3c }).stroke({ width: 1.5, color: 0x5a3a1c });
    g.rect(-11, -13, 22, 2).fill({ color: lighten(c, 0.2) });
    // Tail fin.
    g.poly([-26, -44, -38, -54, -38, -34], true).fill({ color: darken(c, 0.2) });
    // Balloon with banding and a highlight.
    g.ellipse(0, -44, 28, 18).fill({ color: c }).stroke({ width: 2, color: darken(c, 0.35) });
    g.ellipse(0, -44, 14, 18).stroke({ width: 1.5, color: darken(c, 0.25), alpha: 0.6 });
    g.ellipse(-9, -51, 11, 5).fill({ color: 0xffffff, alpha: 0.35 });
    // Emblem disc.
    g.circle(0, -44, 10.5).fill({ color: 0xffffff, alpha: 0.95 }).stroke({ width: 1.5, color: darken(c, 0.4) });
    drawEmblem(g, def.shape, 0, -44, 7, darken(c, 0.35));
    this.body.addChild(g);

    this.prop.roundRect(-1.5, -9, 3, 18, 1.5).fill({ color: 0xf2f2f2 });
    this.prop.position.set(-39, -44);
    this.body.addChild(this.prop);

    this.badgeText = new Text({ text: "", style: { fontFamily: font, fontSize: 20, fill: 0xffffff, stroke: { color: 0x10131f, width: 4 } } });
    this.badgeText.anchor.set(0.5);
    this.badge.addChild(this.badgeBg, this.badgeText);
    this.badge.position.set(0, -78);
    this.badge.visible = false;
    this.view.addChild(this.badge);
  }

  setBadge(text: string | null, fright = false): void {
    this.fright = fright;
    if (text === null) {
      this.badge.visible = false;
      return;
    }
    this.badge.visible = true;
    this.badgeText.text = text;
    const w = Math.max(44, this.badgeText.width + 18);
    this.badgeBg.clear().roundRect(-w / 2, -15, w, 30, 15).fill({ color: fright ? 0x4b5563 : darken(this.color, 0.25), alpha: 0.95 }).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
  }

  /** 0..1 fraction of the team that has voted, or −1 to hide the ring. */
  setProgress(p: number): void {
    if (p === this.progress) return;
    this.progress = p;
    this.ring.clear();
    if (p < 0) return;
    this.ring.ellipse(0, 0, 30, 17).stroke({ width: 4, color: 0x000000, alpha: 0.3 });
    if (p > 0) {
      const steps = Math.max(2, Math.round(40 * p));
      for (let i = 0; i <= steps; i++) {
        const a = -Math.PI / 2 + Math.PI * 2 * p * (i / steps);
        const x = Math.cos(a) * 30, y = Math.sin(a) * 17;
        if (i === 0) this.ring.moveTo(x, y);
        else this.ring.lineTo(x, y);
      }
      this.ring.stroke({ width: 4, color: 0xffffff, alpha: 0.95 });
    }
  }

  update(t: number, dt: number): void {
    const bob = Math.sin(t * 1.7 + this.phase) * 4;
    const shake = this.fright ? Math.sin(t * 38) * 2.5 : 0;
    this.body.position.set(this.kick.x + shake, -18 + bob + this.kick.y);
    this.body.rotation = Math.sin(t * 1.1 + this.phase) * 0.04;
    this.prop.rotation += dt * 22 * this.spin;
    this.prop.scale.x = 0.35 + Math.abs(Math.sin(this.prop.rotation)) * 0.65;
    this.shadow.scale.set(1 - bob * 0.012);
  }
}
