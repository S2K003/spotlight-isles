/**
 * All sound is synthesized with WebAudio at runtime: no samples, nothing to license.
 * Projector only; phones stay silent.
 */
export type SfxName =
  | "pop"
  | "whoosh"
  | "splat"
  | "clash"
  | "chest"
  | "tick"
  | "tock"
  | "fanfare"
  | "banner"
  | "step"
  | "reveal"
  | "card"
  | "boom"
  | "firework"
  | "reel"
  | "gameover";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private volume = 0.7;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private ducked = false;
  private last: Partial<Record<SfxName, number>> = {};

  /** Must be called from a user gesture (the START button) because browsers block autoplay. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.master);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  getVolume(): number {
    return this.volume;
  }

  private tone(freq: number, dur: number, o: { type?: OscillatorType; gain?: number; to?: number; at?: number; attack?: number; bus?: GainNode | null } = {}): void {
    const ctx = this.ctx;
    const bus = o.bus ?? this.sfxBus;
    if (!ctx || !bus) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    const peak = o.gain ?? 0.25;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, o: { gain?: number; freq?: number; to?: number; q?: number; type?: BiquadFilterType; at?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noiseBuf) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? "bandpass";
    f.frequency.setValueAtTime(o.freq ?? 1200, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  play(name: SfxName): void {
    if (!this.ctx) return;
    // Don't stack the same sound many times in one frame (six ships stepping at once).
    const now = performance.now();
    const gap = name === "step" || name === "splat" ? 45 : 20;
    if (now - (this.last[name] ?? 0) < gap) return;
    this.last[name] = now;

    switch (name) {
      case "pop":
        this.tone(520, 0.12, { to: 980, type: "sine", gain: 0.3 });
        break;
      case "step":
        this.tone(300, 0.07, { to: 420, type: "triangle", gain: 0.1 });
        break;
      case "whoosh":
        this.noise(0.45, { freq: 400, to: 3200, gain: 0.25, q: 0.8 });
        break;
      case "banner":
        this.noise(0.35, { freq: 300, to: 2600, gain: 0.3, q: 0.7 });
        this.tone(196, 0.5, { type: "sawtooth", gain: 0.14, at: 0.12 });
        this.tone(294, 0.5, { type: "sawtooth", gain: 0.1, at: 0.12 });
        break;
      case "splat":
        this.noise(0.16, { freq: 900, to: 220, gain: 0.26, q: 1.2, type: "lowpass" });
        this.tone(240, 0.12, { to: 90, gain: 0.14 });
        break;
      case "clash":
        this.noise(0.5, { freq: 2600, to: 180, gain: 0.5, q: 0.6, type: "lowpass" });
        this.tone(130, 0.5, { to: 38, type: "square", gain: 0.28 });
        this.tone(1900, 0.18, { to: 700, type: "square", gain: 0.1 });
        break;
      case "boom":
        this.tone(110, 0.8, { to: 30, type: "sine", gain: 0.5 });
        this.noise(0.6, { freq: 500, to: 80, gain: 0.35, type: "lowpass" });
        break;
      case "chest":
        [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.22, { type: "triangle", gain: 0.2, at: i * 0.07 }));
        break;
      case "card":
        this.tone(880, 0.1, { type: "square", gain: 0.1 });
        this.tone(1320, 0.18, { type: "square", gain: 0.1, at: 0.08 });
        break;
      case "tick":
        this.tone(1500, 0.04, { type: "square", gain: 0.09 });
        break;
      case "tock":
        this.tone(1050, 0.05, { type: "square", gain: 0.09 });
        break;
      case "reel":
        this.tone(700 + Math.random() * 500, 0.05, { type: "triangle", gain: 0.12 });
        break;
      case "reveal":
        this.tone(523, 0.16, { type: "triangle", gain: 0.2 });
        this.tone(784, 0.3, { type: "triangle", gain: 0.2, at: 0.12 });
        break;
      case "firework":
        this.noise(0.5, { freq: 3000, to: 600, gain: 0.14, q: 0.5 });
        this.tone(160, 0.3, { to: 50, gain: 0.16 });
        break;
      case "fanfare":
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
          this.tone(f, i === 6 ? 0.9 : 0.2, { type: "sawtooth", gain: 0.13, at: i * 0.16 });
          this.tone(f / 2, i === 6 ? 0.9 : 0.2, { type: "triangle", gain: 0.13, at: i * 0.16 });
        });
        break;
      case "gameover":
        [784, 659, 523, 392].forEach((f, i) => this.tone(f, i === 3 ? 1.2 : 0.25, { type: "triangle", gain: 0.2, at: i * 0.2 }));
        this.tone(98, 1.6, { type: "sine", gain: 0.3, at: 0.6 });
        break;
    }
  }

  /* ---------- music: a short upbeat loop, scheduled a little ahead of time ---------- */

  startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.beat = 0;
    this.musicTimer = setInterval(() => this.schedule(), 60);
  }

  stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  /** Lower the music under Spotlight speeches. */
  duck(on: boolean): void {
    this.ducked = on;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.06 : 0.5, this.ctx.currentTime, 0.4);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const spb = 60 / 112 / 2; // eighth notes at 112 bpm
    // I–V–vi–IV in C, as [bass, chord tones...]
    const bars = [
      [65.4, 261.6, 329.6, 392.0],
      [98.0, 293.7, 392.0, 493.9],
      [110.0, 261.6, 329.6, 440.0],
      [87.3, 261.6, 349.2, 440.0],
    ];
    const arp = [1, 2, 3, 2, 1, 3, 2, 3];
    while (this.nextBeat < ctx.currentTime + 0.25) {
      const step = this.beat % 8;
      const bar = bars[Math.floor(this.beat / 8) % 4];
      const at = Math.max(0, this.nextBeat - ctx.currentTime);
      this.tone(bar[arp[step]] * 2, spb * 0.9, { type: "triangle", gain: 0.07, at, bus: this.musicBus });
      if (step % 4 === 0) this.tone(bar[0], spb * 3.4, { type: "sine", gain: 0.2, at, bus: this.musicBus });
      if (step === 2 || step === 6) this.tone(bar[1], spb * 0.5, { type: "square", gain: 0.025, at, bus: this.musicBus });
      this.nextBeat += spb;
      this.beat++;
    }
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
