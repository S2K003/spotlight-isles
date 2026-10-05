import gsap from "gsap";
import { Application, Container, DisplacementFilter, Graphics, Sprite, Texture } from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters";
import { TEAM_DEFS, cssToNum } from "@/config/teams";
import type { FinalClaim, MoveResult, TeamId, TeamPublic, Tile } from "@/lib/engine/types";
import { darken, hexCenter, hexCorners, HEX_SIZE, lighten, mix } from "./layout";
import { Particles } from "./Particles";
import { Ship } from "./Ships";
import { Clouds, LIGHT, Spotlights, type TimeOfDay } from "./Sky";
import { buildTile, drawOverlay, makeChest, type TileView } from "./TileFactory";

export type RenderEvent = "step" | "paint" | "clash" | "chest" | "micdrop" | "card" | "flood" | "stage" | "firework";
export type CameraMode = "lobby" | "intro" | "play" | "action" | "final";

export interface RendererOpts {
  lowFx?: boolean;
  font?: string;
  onEvent?: (e: RenderEvent, teamId?: number) => void;
}

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const MAP_W = HEX_SIZE * 1.5 * 12 + HEX_SIZE * 2 + 40;
const MAP_H = 760;
const MAP_CY = -8;

/** The projector scene: pseudo-3D hex archipelago, ships, particles, clouds, camera and all move animations. */
export class MapRenderer {
  private app!: Application;
  private world = new Container();
  private under = new Graphics();
  private waterLayer = new Container();
  private tileLayer = new Container();
  private shipLayer = new Container();
  private fxLayer = new Container();
  private particles!: Particles;
  private clouds = new Clouds();
  private spotlights = new Spotlights();
  private views = new Map<string, TileView>();
  private tickers: TileView[] = [];
  private chests: TileView[] = [];
  private swamps: TileView[] = [];
  private ships: Ship[] = [];
  private shipMoving: boolean[] = [false, false, false, false, false, false];
  private fright: boolean[] = [false, false, false, false, false, false];
  private ctx = gsap.context(() => {});
  private dispSprite: Sprite | null = null;
  private bloom: AdvancedBloomFilter | null = null;
  private t = 0;
  private destroyed = false;
  private insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private cam = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1, shake: 0 };
  private mode: CameraMode = "lobby";
  private tint = { from: LIGHT.dawn.tint, to: LIGHT.dawn.tint, k: 1 };
  private busyUntil = 0;
  private pendingTiles: Tile[] | null = null;
  private pendingTeams: TeamPublic[] | null = null;
  private mapSig = "";
  private lowFx: boolean;
  private slowFrames = 0;
  private fireworks: { color: number; until: number; next: number } | null = null;
  private opts: RendererOpts;

  private constructor(opts: RendererOpts) {
    this.opts = opts;
    this.lowFx = !!opts.lowFx;
  }

  static async create(host: HTMLElement, opts: RendererOpts = {}): Promise<MapRenderer> {
    const r = new MapRenderer(opts);
    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
      powerPreference: "high-performance",
    });
    r.app = app;
    host.appendChild(app.canvas);
    app.canvas.style.position = "absolute";
    app.canvas.style.inset = "0";
    r.build();
    return r;
  }

  private build(): void {
    const { app } = this;
    this.particles = new Particles(app.renderer, this.lowFx ? 350 : 900);
    this.tileLayer.sortableChildren = true;
    this.shipLayer.sortableChildren = true;
    this.world.addChild(this.under, this.waterLayer, this.tileLayer, this.shipLayer, this.particles.view, this.fxLayer);
    app.stage.addChild(this.clouds.back, this.world, this.spotlights.view, this.clouds.front);

    const font = this.opts.font ?? "sans-serif";
    for (const def of TEAM_DEFS) {
      const ship = new Ship(def.id, font);
      this.ships.push(ship);
      this.shipLayer.addChild(ship.view);
    }

    if (!this.lowFx) this.enableFx();
    app.ticker.add((ticker) => this.update(Math.min(0.05, ticker.deltaMS / 1000), ticker.deltaMS));
    this.layout();
    app.renderer.on("resize", () => this.layout());
  }

  private enableFx(): void {
    try {
      // Displacement map for the animated water.
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g2 = c.getContext("2d")!;
      g2.fillStyle = "rgb(128,128,128)";
      g2.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * 128, y = Math.random() * 128, rad = 10 + Math.random() * 26;
        const grad = g2.createRadialGradient(x, y, 0, x, y, rad);
        const v = () => 70 + Math.floor(Math.random() * 116);
        grad.addColorStop(0, `rgba(${v()},${v()},128,0.55)`);
        grad.addColorStop(1, "rgba(128,128,128,0)");
        g2.fillStyle = grad;
        g2.fillRect(0, 0, 128, 128);
      }
      const tex = Texture.from(c);
      tex.source.addressMode = "repeat";
      this.dispSprite = new Sprite(tex);
      this.dispSprite.scale.set(3);
      this.dispSprite.renderable = false;
      this.world.addChildAt(this.dispSprite, 0);
      this.waterLayer.filters = [new DisplacementFilter({ sprite: this.dispSprite, scale: 14 })];

      this.bloom = new AdvancedBloomFilter({ threshold: 0.8, bloomScale: 0.42, brightness: 1, blur: 5, quality: 4 });
      this.world.filters = [this.bloom];
    } catch {
      this.disableFx();
    }
  }

  private disableFx(): void {
    this.lowFx = true;
    this.world.filters = [];
    this.waterLayer.filters = [];
    this.bloom = null;
    this.particles?.setCap(350);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ctx.kill();
    try {
      this.app.destroy({ removeView: true }, { children: true, texture: true });
    } catch {
      /* already gone */
    }
  }

  private emit(e: RenderEvent, teamId?: number): void {
    this.opts.onEvent?.(e, teamId);
  }

  private later(seconds: number, fn: () => void): void {
    this.ctx.add(() => gsap.delayedCall(seconds, () => !this.destroyed && fn()));
  }

  private tween(target: object, vars: gsap.TweenVars): void {
    this.ctx.add(() => gsap.to(target, vars));
  }

  /* ---------- layout + camera ---------- */

  setInsets(insets: Insets): void {
    this.insets = insets;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.spotlights.show(mode === "final");
  }

  private layout(): void {
    const w = this.app.screen.width, h = this.app.screen.height;
    this.clouds.layout(w, h);
    this.spotlights.layout(w, h);
  }

  private updateCamera(dt: number): void {
    const w = this.app.screen.width, h = this.app.screen.height;
    const k = Math.min(w / 1920, h / 1080);
    // Insets are given in 1920×1080 design pixels; the HUD is letterboxed, so add its offset.
    const ox = (w - 1920 * k) / 2, oy = (h - 1080 * k) / 2;
    const il = ox + this.insets.left * k, ir = ox + this.insets.right * k, it = oy + this.insets.top * k, ib = oy + this.insets.bottom * k;
    const aw = Math.max(200, w - il - ir), ah = Math.max(200, h - it - ib);
    const fit = Math.min(aw / MAP_W, ah / MAP_H);

    let tz = 1, tx = 0, ty = MAP_CY;
    const drift = this.t * 0.25;
    if (this.mode === "lobby") {
      tz = 0.9;
      tx = Math.sin(drift * 0.6) * 30;
    } else if (this.mode === "intro") {
      // Fly over the archipelago: one slow lap around the map.
      tz = 1.55;
      tx = Math.cos(this.t * 0.17) * 250;
      ty = Math.sin(this.t * 0.17) * 150;
    } else if (this.mode === "action") {
      tz = this.cam.tz;
      tx = this.cam.tx;
      ty = this.cam.ty;
    } else if (this.mode === "final") {
      tz = 1.06 + Math.sin(this.t * 0.3) * 0.04;
    }
    tx += Math.sin(drift) * 7;
    ty += Math.cos(drift * 0.8) * 4;

    const ease = Math.min(1, dt * 2.2);
    this.cam.x += (tx - this.cam.x) * ease;
    this.cam.y += (ty - this.cam.y) * ease;
    this.cam.zoom += (tz - this.cam.zoom) * ease;
    this.cam.shake = Math.max(0, this.cam.shake - dt * 30);

    const z = fit * this.cam.zoom;
    const sx = (Math.random() - 0.5) * this.cam.shake, sy = (Math.random() - 0.5) * this.cam.shake;
    this.world.scale.set(z);
    this.world.rotation = this.mode === "final" ? Math.sin(this.t * 0.16) * 0.045 : this.world.rotation * (1 - ease);
    this.world.position.set(il + aw / 2 - this.cam.x * z + sx, it + ah / 2 - this.cam.y * z + sy);
  }

  shake(amount = 14): void {
    this.cam.shake = Math.max(this.cam.shake, amount);
  }

  setTimeOfDay(tod: TimeOfDay, instant = false): void {
    const look = LIGHT[tod];
    this.tint = { from: instant ? look.tint : this.currentTint(), to: look.tint, k: instant ? 1 : 0 };
    this.clouds.setLook(look.cloud, look.cloudAlpha);
  }

  private currentTint(): number {
    return mix(this.tint.from, this.tint.to, this.tint.k);
  }

  /* ---------- tiles ---------- */

  /** Show a tile set. While a move animation is playing the new state is held back until it finishes. */
  syncTiles(tiles: Tile[], force = false): void {
    if (!force && performance.now() < this.busyUntil) {
      this.pendingTiles = tiles;
      return;
    }
    const sig = tiles.map((t) => t.type[0] + t.height).join("");
    if (sig !== this.mapSig) this.rebuild(tiles, sig);
    for (const tile of tiles) {
      const v = this.views.get(`${tile.q},${tile.r}`);
      if (!v) continue;
      this.setOwner(v, tile.owner);
      this.setChest(v, !!tile.chest);
    }
  }

  private rebuild(tiles: Tile[], sig: string): void {
    this.mapSig = sig;
    for (const v of this.views.values()) v.root.destroy({ children: true });
    this.views.clear();
    this.tickers = [];
    this.chests = [];
    this.swamps = [];
    this.under.clear();

    const corners = hexCorners();
    // Soft drop shadow, then the rocky underside of the floating islands.
    this.under.ellipse(0, 250, 470, 150).fill({ color: 0x0a1030, alpha: 0.16 });
    for (const pass of [{ dy: 62, s: 0.74, c: 0x1c2038 }, { dy: 36, s: 0.9, c: 0x2c3150 }]) {
      for (const tile of tiles) {
        if (tile.type === "water") continue;
        const { x, y } = hexCenter(tile);
        const pts: number[] = [];
        for (const c of corners) pts.push(x * pass.s + c.x * pass.s, y * pass.s + pass.dy + c.y * pass.s);
        this.under.poly(pts, true).fill({ color: pass.c });
      }
    }

    for (const tile of tiles) {
      const v = buildTile(tile);
      v.overlay.pivot.set(0, -tile.height);
      v.overlay.position.set(0, -tile.height);
      this.views.set(v.key, v);
      (tile.type === "water" ? this.waterLayer : this.tileLayer).addChild(v.root);
      if (v.tick) this.tickers.push(v);
      if (tile.type === "swamp") this.swamps.push(v);
      if (tile.type === "water") {
        const shine = new Graphics();
        shine.moveTo(-18, -2).lineTo(-4, -2).moveTo(4, 6).lineTo(20, 6).moveTo(-10, 12).lineTo(2, 12).stroke({ width: 2, color: 0xdff5ff, alpha: 0.7 });
        v.root.addChild(shine);
        v.tick = (t) => { shine.x = Math.sin(t * 0.8 + v.cx * 0.05) * 6; shine.alpha = 0.5 + Math.sin(t * 1.3 + v.cy * 0.1) * 0.4; };
        this.tickers.push(v);
      }
    }
  }

  private setOwner(v: TileView, owner: TeamId | undefined, shielded = false): void {
    if (v.owner === owner && !shielded) return;
    v.owner = owner;
    drawOverlay(v.overlay, v, owner, shielded);
  }

  private setChest(v: TileView, on: boolean): void {
    if (on && !v.chest) {
      v.chest = makeChest();
      v.chest.y = -v.tile.height - 2;
      v.root.addChild(v.chest);
      this.chests.push(v);
      v.chest.scale.set(0);
      this.tween(v.chest.scale, { x: 1, y: 1, duration: 0.5, ease: "back.out(2.5)" });
    } else if (!on && v.chest) {
      v.chest.destroy({ children: true });
      v.chest = null;
      this.chests = this.chests.filter((c) => c !== v);
    }
  }

  private top(key: string): { x: number; y: number } | null {
    const v = this.views.get(key);
    return v ? { x: v.cx, y: v.top } : null;
  }

  /** Flip a tile to a team with a splash. */
  private paint(key: string, teamId: TeamId, big = false): void {
    const v = this.views.get(key);
    if (!v) return;
    this.setOwner(v, teamId);
    const color = cssToNum(TEAM_DEFS[teamId].color);
    v.overlay.scale.set(0.2);
    this.tween(v.overlay.scale, { x: 1, y: 1, duration: 0.38, ease: "back.out(2.2)" });
    this.particles.emit(v.cx, v.top, color, { count: big ? 16 : 10, speed: 150, life: 0.55, size: 0.3, up: 60 });
    this.particles.emit(v.cx, v.top, lighten(color, 0.5), { count: 4, speed: 80, life: 0.4, size: 0.2 });
    this.emit("paint", teamId);
  }

  /* ---------- ships ---------- */

  syncTeams(teams: TeamPublic[], force = false): void {
    if (!force && performance.now() < this.busyUntil) {
      this.pendingTeams = teams;
      return;
    }
    for (const team of teams) {
      const p = this.top(`${team.pos.q},${team.pos.r}`) ?? { x: hexCenter(team.pos).x, y: hexCenter(team.pos).y };
      const ship = this.ships[team.id];
      ship.view.position.set(p.x, p.y);
      ship.view.zIndex = p.y;
    }
  }

  /** MP badges over each ship (null hides them). */
  setBadges(mp: (number | null)[] | null, fright?: boolean[]): void {
    this.ships.forEach((ship, i) => {
      const v = mp?.[i];
      const isFright = !!fright?.[i];
      this.fright[i] = isFright;
      ship.setBadge(v === null || v === undefined ? null : isFright ? "STAGE FRIGHT" : `${v} MP`, isFright);
    });
  }

  /** Per-team "votes in" ring (0..1), or null to hide. Rivals' choices stay hidden. */
  setVoteProgress(p: number[] | null): void {
    this.ships.forEach((ship, i) => ship.setProgress(p ? p[i] : -1));
  }

  /* ---------- move resolution ---------- */

  /**
   * Animate one round's resolution: all ships move at once, one hex per step, painting as they
   * go; then clashes, card effects and chest pickups. Returns the animation length in ms.
   */
  playResolution(moves: MoveResult[], tilesAfter: Tile[], teamsAfter: TeamPublic[], durationMs: number): number {
    const maxSteps = Math.max(1, ...moves.map((m) => m.path.length - 1));
    const step = Math.max(0.03, Math.min(0.28, (durationMs / 1000) * 0.5 / maxSteps));
    const quick = step < 0.2;
    const travel = maxSteps * step;
    const total = Math.min(durationMs / 1000 - 0.05, travel + (quick ? step * 4 : 1.6));
    this.busyUntil = performance.now() + total * 1000;
    this.pendingTiles = tilesAfter;
    this.pendingTeams = teamsAfter;

    // Zoom slightly toward the action.
    const movers = moves.filter((m) => m.path.length > 1);
    if (movers.length) {
      let sx = 0, sy = 0;
      for (const m of movers) {
        const end = hexCenter(m.path[m.path.length - 1]);
        sx += end.x; sy += end.y;
      }
      this.cam.tx = (sx / movers.length) * 0.35;
      this.cam.ty = (sy / movers.length) * 0.35 + MAP_CY;
      this.cam.tz = 1.1;
      this.mode = "action";
    }

    for (const m of moves) {
      const ship = this.ships[m.teamId];
      const color = ship.color;
      const origin = this.top(`${m.path[0].q},${m.path[0].r}`);
      if (!origin) continue;

      // Card effects fire first.
      for (const fx of m.cardFx) {
        if (fx.card === "hook") {
          this.particles.emit(origin.x, origin.y - 50, 0xffd54a, { count: 22, speed: 160, life: 0.8, size: 0.32, gravity: -80 });
          this.emit("card", m.teamId);
        } else if (fx.card === "rehearsed") {
          for (const v of this.views.values()) {
            if (v.owner !== m.teamId) continue;
            drawOverlay(v.overlay, v, m.teamId, true);
            this.later(total, () => drawOverlay(v.overlay, v, v.owner, false));
          }
          this.emit("card", m.teamId);
        } else if (fx.card === "heckler") {
          const target = this.ships[fx.target].view;
          for (let i = 0; i < 6; i++) {
            this.later(i * 0.06, () => {
              const k = i / 5;
              this.particles.emit(origin.x + (target.x - origin.x) * k, origin.y - 40 + (target.y - origin.y) * k, 0xff5a5a, { count: 5, speed: 60, life: 0.5, size: 0.3 });
            });
          }
          this.later(0.36, () => { this.kick(this.ships[fx.target], 0, -10); });
          this.emit("card", m.teamId);
        }
      }

      if (m.path.length > 1) {
        this.shipMoving[m.teamId] = true;
        ship.spin = 2.4;
        m.path.slice(1).forEach((h, i) => {
          const p = this.top(`${h.q},${h.r}`);
          if (!p) return;
          const k = `${h.q},${h.r}`;
          this.tween(ship.view, {
            x: p.x,
            y: p.y,
            duration: step,
            delay: i * step,
            ease: "sine.inOut",
            onComplete: () => {
              ship.view.zIndex = p.y;
              if (m.painted.includes(k)) this.paint(k, m.teamId);
              this.emit("step", m.teamId);
            },
          });
        });
      }

      const arrive = (m.path.length - 1) * step;
      this.later(arrive + 0.01, () => {
        this.shipMoving[m.teamId] = false;
        ship.spin = 1;
        const end = m.path[m.path.length - 1];
        const endKey = `${end.q},${end.r}`;
        const here = this.top(endKey);
        if (!here) return;

        if (m.clashAt) {
          const at = this.top(`${m.clashAt.q},${m.clashAt.r}`);
          if (at) {
            // Lunge at the contested tile, flash, and bounce back.
            const dx = (at.x - here.x) * 0.55, dy = (at.y - here.y) * 0.55;
            this.tween(ship.kick, { x: dx, y: dy, duration: quick ? step : 0.16, ease: "power2.in", yoyo: true, repeat: 1 });
            this.later(quick ? step : 0.16, () => {
              this.particles.emit(here.x + dx, here.y + dy - 30, 0xfff2a8, { count: 26, speed: 280, life: 0.5, size: 0.28, gravity: 200 });
              this.particles.emit(here.x + dx, here.y + dy - 30, color, { count: 12, speed: 180, life: 0.6, size: 0.3 });
              this.flash(here.x + dx, here.y + dy - 30, 0xffffff);
              this.shake(16);
              this.cam.tz = 1.22;
              this.later(0.35, () => (this.cam.tz = 1.1));
              this.emit("clash", m.teamId);
            });
          }
        }

        const mic = m.cardFx.find((f) => f.card === "micdrop");
        if (mic && mic.card === "micdrop") {
          this.ring(here.x, here.y, color, 150);
          this.shake(10);
          mic.tiles.forEach((k, i) => this.later(0.08 + i * 0.05, () => this.paint(k, m.teamId, true)));
          this.emit("micdrop", m.teamId);
        }

        if (m.pickup) {
          const v = this.views.get(endKey);
          if (v) this.setChest(v, false);
          this.particles.emit(here.x, here.y - 10, 0xffe27a, { count: 30, speed: 220, life: 0.9, size: 0.3, up: 120 });
          this.particles.emit(here.x, here.y - 10, 0xffffff, { count: 10, speed: 120, life: 0.6, size: 0.2, up: 160 });
          this.emit("chest", m.teamId);
        }
        if (m.swamp) this.particles.emit(here.x, here.y, 0x7c8f3a, { count: 14, speed: 70, life: 0.9, size: 0.34, gravity: 40 });
      });
    }

    this.later(total, () => this.finishAnimation());
    return total * 1000;
  }

  private finishAnimation(): void {
    this.busyUntil = 0;
    if (this.mode === "action") this.mode = "play";
    this.shipMoving.fill(false);
    for (const s of this.ships) { s.kick.x = 0; s.kick.y = 0; s.spin = 1; }
    if (this.pendingTiles) this.syncTiles(this.pendingTiles, true);
    if (this.pendingTeams) this.syncTeams(this.pendingTeams, true);
    this.pendingTiles = null;
    this.pendingTeams = null;
  }

  private kick(ship: Ship, x: number, y: number): void {
    this.tween(ship.kick, { x, y, duration: 0.1, yoyo: true, repeat: 3, ease: "sine.inOut" });
  }

  private flash(x: number, y: number, color: number): void {
    const g = new Graphics().circle(0, 0, 60).fill({ color, alpha: 0.85 });
    g.position.set(x, y);
    g.scale.set(0.2);
    this.fxLayer.addChild(g);
    this.tween(g.scale, { x: 1.6, y: 1.6, duration: 0.3, ease: "power2.out" });
    this.tween(g, { alpha: 0, duration: 0.3, ease: "power2.out", onComplete: () => g.destroy() });
  }

  private ring(x: number, y: number, color: number, radius: number): void {
    const g = new Graphics().ellipse(0, 0, radius, radius * 0.62).stroke({ width: 10, color: lighten(color, 0.4), alpha: 0.95 });
    g.position.set(x, y);
    g.scale.set(0.05);
    this.fxLayer.addChild(g);
    this.tween(g.scale, { x: 1, y: 1, duration: 0.55, ease: "power2.out" });
    this.tween(g, { alpha: 0, duration: 0.55, ease: "power1.in", onComplete: () => g.destroy() });
  }

  /* ---------- final showdown ---------- */

  /** Territory floods out in three waves, then the Keynote Stage is captured with fireworks. */
  playFlood(claims: FinalClaim[], stageWinner: TeamId | null, tilesAfter: Tile[], teamsAfter: TeamPublic[], durationMs: number): void {
    const dur = durationMs / 1000;
    this.busyUntil = performance.now() + dur * 0.8 * 1000;
    this.pendingTiles = tilesAfter;
    this.pendingTeams = teamsAfter;
    const waves = Math.max(1, ...claims.map((c) => c.wave + 1));
    const waveLen = (dur * 0.55) / waves;
    for (let w = 0; w < waves; w++) {
      const inWave = claims.filter((c) => c.wave === w);
      this.later(w * waveLen + 0.2, () => this.emit("flood"));
      inWave.forEach((c, i) => {
        this.later(w * waveLen + 0.2 + (i / Math.max(1, inWave.length)) * waveLen * 0.8, () => this.paint(c.key, c.teamId, true));
      });
    }
    this.later(dur * 0.62, () => {
      if (stageWinner === null) return;
      const stage = this.views.get("0,0");
      const color = cssToNum(TEAM_DEFS[stageWinner].color);
      if (stage) {
        this.setOwner(stage, stageWinner);
        this.ring(stage.cx, stage.top, color, 260);
        this.flash(stage.cx, stage.top - 20, lighten(color, 0.5));
        this.particles.emit(stage.cx, stage.top - 20, color, { count: 60, speed: 340, life: 1.2, size: 0.4, up: 200 });
      }
      this.shake(20);
      this.emit("stage", stageWinner);
      this.fireworks = { color, until: this.t + dur * 0.36, next: this.t };
    });
    this.later(dur * 0.8, () => this.finishAnimation());
  }

  /** Celebration fireworks in a team's colour (results ceremony). */
  celebrate(teamId: TeamId, seconds: number): void {
    this.fireworks = { color: cssToNum(TEAM_DEFS[teamId].color), until: this.t + seconds, next: this.t };
  }

  /* ---------- frame ---------- */

  private update(dt: number, rawMs: number): void {
    if (this.destroyed) return;
    this.t += dt;
    const t = this.t;

    // Fall back to low effects if the machine can't hold the frame rate.
    if (!this.lowFx) {
      this.slowFrames = rawMs > 28 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
      if (this.slowFrames > 150) this.disableFx();
    }

    if (this.tint.k < 1) {
      this.tint.k = Math.min(1, this.tint.k + dt / 4);
      this.world.tint = this.currentTint();
    } else if (this.world.tint !== this.tint.to) {
      this.world.tint = this.tint.to;
    }

    for (const v of this.tickers) v.tick!(t, dt);
    for (const v of this.chests) {
      if (!v.chest) continue;
      v.chest.y = -v.tile.height - 4 + Math.sin(t * 2.4 + v.cx) * 2.5;
      if (Math.random() < dt * 0.9) this.particles.emit(v.cx + (Math.random() - 0.5) * 24, v.top - 12, 0xffe89a, { count: 1, speed: 20, life: 0.8, size: 0.14, gravity: -50 });
    }
    for (const v of this.swamps) {
      if (Math.random() < dt * 0.5) this.particles.emit(v.cx + (Math.random() - 0.5) * 30, v.top + 2, 0x9fb86a, { count: 1, speed: 8, life: 1.1, size: 0.16, gravity: -26, grow: 1.8, alpha: 0.7 });
    }

    this.ships.forEach((ship, i) => {
      ship.update(t, dt);
      if (this.shipMoving[i] && Math.random() < dt * 40) {
        this.particles.emit(ship.view.x + ship.kick.x, ship.view.y - 6, lighten(ship.color, 0.25), { count: 1, speed: 14, life: 0.7, size: 0.26, gravity: 0, grow: 0.1, alpha: 0.85 });
      }
      if (this.fright[i] && Math.random() < dt * 5) {
        this.particles.emit(ship.view.x + (Math.random() - 0.5) * 40, ship.view.y - 66, 0x9fdcff, { count: 1, speed: 10, life: 0.6, size: 0.2, gravity: 320, spread: 0.4, angle: Math.PI / 2 });
      }
    });

    if (this.fireworks) {
      if (t > this.fireworks.until) this.fireworks = null;
      else if (t >= this.fireworks.next) {
        this.fireworks.next = t + 0.22 + Math.random() * 0.25;
        const x = (Math.random() - 0.5) * 760, y = -160 - Math.random() * 260;
        const c = Math.random() < 0.65 ? this.fireworks.color : [0xffffff, 0xffe27a, darken(this.fireworks.color, 0.2)][Math.floor(Math.random() * 3)];
        this.particles.emit(x, y, c, { count: this.lowFx ? 22 : 40, speed: 260, life: 1.1, size: 0.3, gravity: 140 });
        this.emit("firework");
      }
    }

    if (this.dispSprite) {
      this.dispSprite.x = (t * 22) % 384;
      this.dispSprite.y = (t * 13) % 384;
    }
    this.particles.update(dt);
    this.clouds.update(dt, t);
    this.spotlights.update(dt, t);
    this.updateCamera(dt);
  }

  get hasMap(): boolean {
    return this.views.size > 0;
  }

  get fps(): number {
    return this.app?.ticker.FPS ?? 0;
  }

  get effects(): "full" | "low" {
    return this.lowFx ? "low" : "full";
  }
}
