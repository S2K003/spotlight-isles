import gsap from "gsap";
import { Application, Container, DisplacementFilter, Graphics, Sprite, Texture } from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters";
import { MAP_RADIUS } from "@/config/balance";
import { TEAM_DEFS, cssToNum } from "@/config/teams";
import type { MoveResult, TeamId, TeamPublic, Tile } from "@/lib/engine/types";
import { darken, hexCenter, hexCorners, HEX_SIZE, lighten, mix } from "./layout";
import { Particles } from "./Particles";
import { Ship } from "./Ships";
import { Clouds, LIGHT, type TimeOfDay } from "./Sky";
import { buildTile, drawOverlay, makeKey, makeStar, type TileView } from "./TileFactory";

export type RenderEvent = "step" | "key" | "star" | "dock" | "turn" | "firework";
export type CameraMode = "lobby" | "intro" | "play" | "action";

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

const MAP_W = HEX_SIZE * 1.5 * MAP_RADIUS * 2 + HEX_SIZE * 2 + 60;
const MAP_H = HEX_SIZE * Math.sqrt(3) * 0.64 * MAP_RADIUS * 2 + 190;
const MAP_CY = -12;

/** The projector scene: pseudo-3D hex islands, ships, tokens, particles, clouds, camera and the move animations. */
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
  private views = new Map<string, TileView>();
  private tickers: TileView[] = [];
  private tokens: TileView[] = [];
  private ships: Ship[] = [];
  private shipMoving: boolean[] = [false, false, false, false, false, false];
  private homes = new Map<string, TeamId>();
  private ctx = gsap.context(() => {});
  private dispSprite: Sprite | null = null;
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
    app.stage.addChild(this.clouds.back, this.world, this.clouds.front);

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
      this.world.filters = [new AdvancedBloomFilter({ threshold: 0.8, bloomScale: 0.42, brightness: 1, blur: 5, quality: 4 })];
    } catch {
      this.disableFx();
    }
  }

  private disableFx(): void {
    this.lowFx = true;
    this.world.filters = [];
    this.waterLayer.filters = [];
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
  }

  private layout(): void {
    this.clouds.layout(this.app.screen.width, this.app.screen.height);
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
      tz = 0.92;
      tx = Math.sin(drift * 0.6) * 20;
    } else if (this.mode === "intro") {
      // Fly over the islands: one slow lap around the map.
      tz = 1.45;
      tx = Math.cos(this.t * 0.17) * 150;
      ty = Math.sin(this.t * 0.17) * 90;
    } else if (this.mode === "action") {
      tz = this.cam.tz;
      tx = this.cam.tx;
      ty = this.cam.ty;
    }
    tx += Math.sin(drift) * 6;
    ty += Math.cos(drift * 0.8) * 3;

    const ease = Math.min(1, dt * 2.4);
    this.cam.x += (tx - this.cam.x) * ease;
    this.cam.y += (ty - this.cam.y) * ease;
    this.cam.zoom += (tz - this.cam.zoom) * ease;
    this.cam.shake = Math.max(0, this.cam.shake - dt * 30);

    const z = fit * this.cam.zoom;
    const sx = (Math.random() - 0.5) * this.cam.shake, sy = (Math.random() - 0.5) * this.cam.shake;
    this.world.scale.set(z);
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
      this.setToken(v, tile.key !== undefined ? `key${tile.key}` : tile.star ? "star" : "");
    }
  }

  private rebuild(tiles: Tile[], sig: string): void {
    this.mapSig = sig;
    for (const v of this.views.values()) v.root.destroy({ children: true });
    this.views.clear();
    this.tickers = [];
    this.tokens = [];
    this.under.clear();

    const corners = hexCorners();
    const span = HEX_SIZE * 1.5 * MAP_RADIUS;
    // Soft drop shadow, then the rocky underside of the floating islands.
    this.under.ellipse(0, span * 0.62, span * 1.15, span * 0.36).fill({ color: 0x0a1030, alpha: 0.16 });
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
      if (tile.type === "water") {
        const shine = new Graphics();
        shine.moveTo(-18, -2).lineTo(-4, -2).moveTo(4, 6).lineTo(20, 6).moveTo(-10, 12).lineTo(2, 12).stroke({ width: 2, color: 0xdff5ff, alpha: 0.7 });
        v.root.addChild(shine);
        v.tick = (t) => { shine.x = Math.sin(t * 0.8 + v.cx * 0.05) * 6; shine.alpha = 0.5 + Math.sin(t * 1.3 + v.cy * 0.1) * 0.4; };
        this.tickers.push(v);
      }
    }
  }

  private setOwner(v: TileView, owner: TeamId | undefined): void {
    if (v.owner === owner) return;
    v.owner = owner;
    drawOverlay(v.overlay, v, owner, owner !== undefined && this.homes.get(v.key) === owner);
  }

  private setToken(v: TileView, kind: string): void {
    if (v.tokenKind === kind) return;
    if (v.token) {
      v.token.destroy({ children: true });
      v.token = null;
      this.tokens = this.tokens.filter((c) => c !== v);
    }
    v.tokenKind = kind;
    if (!kind) return;
    v.token = kind === "star" ? makeStar() : makeKey(Number(kind.slice(3)) as TeamId);
    v.token.y = -v.tile.height - 2;
    v.root.addChild(v.token);
    this.tokens.push(v);
    v.token.scale.set(0);
    this.tween(v.token.scale, { x: 1, y: 1, duration: 0.5, ease: "back.out(2.5)" });
  }

  private top(key: string): { x: number; y: number } | null {
    const v = this.views.get(key);
    return v ? { x: v.cx, y: v.top } : null;
  }

  /** Leave a trail on a tile with a small splash. */
  private trail(key: string, teamId: TeamId): void {
    const v = this.views.get(key);
    if (!v || v.tile.type === "stage") return;
    this.setOwner(v, teamId);
    const color = cssToNum(TEAM_DEFS[teamId].color);
    v.overlay.scale.set(0.2);
    this.tween(v.overlay.scale, { x: 1, y: 1, duration: 0.38, ease: "back.out(2.2)" });
    this.particles.emit(v.cx, v.top, color, { count: 8, speed: 130, life: 0.5, size: 0.28, up: 50 });
  }

  /* ---------- ships ---------- */

  /** Where a ship sits: on its tile, or in a ring around the Stage once docked. */
  private shipSpot(team: Pick<TeamPublic, "pos" | "docked">): { x: number; y: number } {
    const p = this.top(`${team.pos.q},${team.pos.r}`) ?? hexCenter(team.pos);
    if (team.docked === null) return p;
    const a = -Math.PI / 2 + ((team.docked - 1) * Math.PI) / 3;
    return { x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 17 };
  }

  /** Tell the renderer which tiles are homes (drawn solid). Call before the first syncTiles. */
  setHomes(teams: Pick<TeamPublic, "id" | "home">[]): void {
    this.homes = new Map(teams.map((t) => [`${t.home.q},${t.home.r}`, t.id]));
  }

  syncTeams(teams: TeamPublic[], force = false): void {
    if (!force && performance.now() < this.busyUntil) {
      this.pendingTeams = teams;
      return;
    }
    this.homes = new Map(teams.map((t) => [`${t.home.q},${t.home.r}`, t.id]));
    // Ships can share a hex, so spread out any that do.
    const sharing = new Map<string, TeamId[]>();
    for (const t of teams) {
      if (t.docked !== null) continue;
      const k = `${t.pos.q},${t.pos.r}`;
      sharing.set(k, (sharing.get(k) ?? []).concat(t.id));
    }
    for (const team of teams) {
      const p = this.shipSpot(team);
      const group = team.docked === null ? (sharing.get(`${team.pos.q},${team.pos.r}`) ?? []) : [];
      if (group.length > 1) p.x += (group.indexOf(team.id) - (group.length - 1) / 2) * 30;
      const ship = this.ships[team.id];
      ship.view.position.set(p.x, p.y);
      ship.view.zIndex = p.y;
      ship.view.scale.set(team.docked === null ? 1 : 0.72);
    }
  }

  /** Badges over each ship, e.g. "1st · 3 steps" (null hides them). */
  setBadges(labels: (string | null)[] | null): void {
    this.ships.forEach((ship, i) => ship.setBadge(labels?.[i] ?? null));
  }

  /** Per-team "votes in" ring (0..1), or null to hide. */
  setVoteProgress(p: number[] | null): void {
    this.ships.forEach((ship, i) => ship.setProgress(p ? p[i] : -1));
  }

  /* ---------- move resolution ---------- */

  /**
   * Animate one round. `moves` are in move order (most points first) and are played one after
   * another, so the room can follow each ship: fly, leave a trail, grab its key or a star, or dock
   * at the Stage.
   */
  playResolution(moves: MoveResult[], tilesAfter: Tile[], teamsAfter: TeamPublic[], durationMs: number): void {
    const dur = durationMs / 1000;
    const movers = moves.filter((m) => m.path.length > 1);
    const slot = Math.min(2.1, (dur * 0.86) / Math.max(1, movers.length));
    const total = Math.min(dur - 0.05, slot * movers.length + 0.4);
    this.busyUntil = performance.now() + total * 1000;
    this.pendingTiles = tilesAfter;
    this.pendingTeams = teamsAfter;
    if (movers.length) this.mode = "action";

    movers.forEach((m, i) => {
      const ship = this.ships[m.teamId];
      const color = ship.color;
      const hops = m.path.length - 1;
      const step = hops ? Math.min(0.3, (slot * 0.62) / hops) : 0;
      const start = i * slot;
      const after = teamsAfter[m.teamId];

      this.later(start, () => {
        // The camera follows whoever's turn it is.
        const end = hexCenter(m.path[m.path.length - 1]);
        this.cam.tx = end.x * 0.4;
        this.cam.ty = end.y * 0.4 + MAP_CY;
        this.cam.tz = 1.12;
        this.shipMoving[m.teamId] = hops > 0;
        ship.spin = 2.4;
        this.emit("turn", m.teamId);
      });

      m.path.slice(1).forEach((h, s) => {
        const k = `${h.q},${h.r}`;
        const last = s === hops - 1;
        const p = last && m.docked ? this.shipSpot(after) : this.top(k);
        if (!p) return;
        this.tween(ship.view, {
          x: p.x,
          y: p.y,
          duration: step,
          delay: start + s * step,
          ease: "sine.inOut",
          onComplete: () => {
            ship.view.zIndex = p.y;
            this.trail(k, m.teamId);
            this.emit("step", m.teamId);
            const v = this.views.get(k);
            if (!v || !v.token) return;
            if (v.tokenKind === `key${m.teamId}` && m.gotKey) {
              this.setToken(v, "");
              this.particles.emit(p.x, p.y - 20, 0xffe27a, { count: 28, speed: 220, life: 0.9, size: 0.3, up: 120 });
              this.ring(p.x, p.y, color, 90);
              this.emit("key", m.teamId);
            } else if (v.tokenKind === "star" && m.stars.includes(k)) {
              this.setToken(v, "");
              this.particles.emit(p.x, p.y - 16, 0xffd54a, { count: 18, speed: 180, life: 0.7, size: 0.26, up: 100 });
              this.emit("star", m.teamId);
            }
          },
        });
      });

      this.later(start + hops * step + 0.02, () => {
        this.shipMoving[m.teamId] = false;
        ship.spin = 1;
        const end = m.path[m.path.length - 1];
        const here = this.top(`${end.q},${end.r}`);
        if (!here) return;
        if (m.docked) {
          ship.view.scale.set(0.72);
          this.ring(here.x, here.y, color, 200);
          this.particles.emit(here.x, here.y - 20, color, { count: 50, speed: 320, life: 1.1, size: 0.36, up: 180 });
          this.particles.emit(here.x, here.y - 20, 0xffffff, { count: 16, speed: 200, life: 0.8, size: 0.22, up: 200 });
          this.shake(12);
          this.fireworks = { color, until: this.t + Math.min(1.6, slot * 0.8), next: this.t };
          this.emit("dock", m.teamId);
        }
      });
    });

    this.later(total, () => this.finishAnimation());
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

  private ring(x: number, y: number, color: number, radius: number): void {
    const g = new Graphics().ellipse(0, 0, radius, radius * 0.62).stroke({ width: 10, color: lighten(color, 0.4), alpha: 0.95 });
    g.position.set(x, y);
    g.scale.set(0.05);
    this.fxLayer.addChild(g);
    this.tween(g.scale, { x: 1, y: 1, duration: 0.55, ease: "power2.out" });
    this.tween(g, { alpha: 0, duration: 0.55, ease: "power1.in", onComplete: () => g.destroy() });
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
    for (const v of this.tokens) {
      if (!v.token) continue;
      v.token.y = -v.tile.height - 4 + Math.sin(t * 2.4 + v.cx) * 3;
      if (Math.random() < dt * 0.9) this.particles.emit(v.cx + (Math.random() - 0.5) * 24, v.top - 14, 0xffe89a, { count: 1, speed: 20, life: 0.8, size: 0.14, gravity: -50 });
    }

    this.ships.forEach((ship, i) => {
      ship.update(t, dt);
      if (this.shipMoving[i] && Math.random() < dt * 40) {
        this.particles.emit(ship.view.x + ship.kick.x, ship.view.y - 6, lighten(ship.color, 0.25), { count: 1, speed: 14, life: 0.7, size: 0.26, gravity: 0, grow: 0.1, alpha: 0.85 });
      }
    });

    if (this.fireworks) {
      if (t > this.fireworks.until) this.fireworks = null;
      else if (t >= this.fireworks.next) {
        this.fireworks.next = t + 0.22 + Math.random() * 0.25;
        const x = (Math.random() - 0.5) * 560, y = -150 - Math.random() * 200;
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
