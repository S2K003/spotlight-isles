import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { channelName, type PresenceMeta } from "./messages";

export type TransportStatus = "connecting" | "connected" | "error";
type Handler = (event: string, payload: unknown) => void;

/**
 * The only thing the game needs from a realtime service: broadcast + presence on one channel.
 * Two implementations: Supabase Realtime (real phones) and BroadcastChannel (same-browser tabs,
 * used when no Supabase keys are configured, for local rehearsal and Manual Mode).
 */
export interface Transport {
  readonly mode: "supabase" | "local";
  send(event: string, payload: unknown): void;
  on(handler: Handler): () => void;
  /** Announce (or with null, withdraw) this client's presence. */
  track(meta: PresenceMeta | null): void;
  onPresence(cb: (metas: PresenceMeta[]) => void): () => void;
  onStatus(cb: (status: TransportStatus) => void): () => void;
  close(): void;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function supabaseConfigured(): boolean {
  return /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_KEY.length > 20 && !SUPABASE_URL.includes("YOUR-PROJECT");
}

let sharedClient: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  sharedClient ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 40 } },
  });
  return sharedClient;
}

class Emitter<T> {
  private subs = new Set<(v: T) => void>();
  add(cb: (v: T) => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }
  emit(v: T) {
    for (const cb of Array.from(this.subs)) cb(v);
  }
}

/** All messages travel as one broadcast event ("m") wrapping `{ e: eventName, p: payload }`. */
class SupabaseTransport implements Transport {
  readonly mode = "supabase" as const;
  private channel: RealtimeChannel;
  private handlers = new Set<Handler>();
  private presence = new Emitter<PresenceMeta[]>();
  private status = new Emitter<TransportStatus>();
  private current: TransportStatus = "connecting";
  private queue: { e: string; p: unknown }[] = [];
  private meta: PresenceMeta | null = null;
  private closed = false;

  constructor(roomCode: string) {
    const client = getClient();
    this.channel = client.channel(channelName(roomCode), {
      config: { broadcast: { self: false, ack: false }, presence: { key: Math.random().toString(36).slice(2), enabled: true } },
    });
    this.channel
      .on("broadcast", { event: "m" }, (msg) => {
        const body = msg.payload as { e?: string; p?: unknown } | undefined;
        if (!body || typeof body.e !== "string") return;
        for (const h of Array.from(this.handlers)) h(body.e, body.p);
      })
      .on("presence", { event: "sync" }, () => {
        const state = this.channel.presenceState() as unknown as Record<string, PresenceMeta[]>;
        this.presence.emit(Object.values(state).flat());
      })
      .subscribe((s) => {
        if (this.closed) return;
        if (s === "SUBSCRIBED") {
          this.setStatus("connected");
          // Presence is not restored automatically after a reconnect, so re-announce every time.
          if (this.meta) void this.channel.track(this.meta);
          const pending = this.queue;
          this.queue = [];
          for (const m of pending) this.send(m.e, m.p);
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          this.setStatus("error");
        } else if (s === "CLOSED") {
          this.setStatus("connecting");
        }
      });
  }

  private setStatus(s: TransportStatus) {
    this.current = s;
    this.status.emit(s);
  }

  send(event: string, payload: unknown): void {
    if (this.closed) return;
    if (this.current !== "connected") {
      if (this.queue.length < 50) this.queue.push({ e: event, p: payload });
      return;
    }
    void this.channel.send({ type: "broadcast", event: "m", payload: { e: event, p: payload } });
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  track(meta: PresenceMeta | null): void {
    this.meta = meta;
    if (this.current !== "connected") return;
    if (meta) void this.channel.track(meta);
    else void this.channel.untrack();
  }

  onPresence(cb: (metas: PresenceMeta[]) => void): () => void {
    return this.presence.add(cb);
  }

  onStatus(cb: (status: TransportStatus) => void): () => void {
    cb(this.current);
    return this.status.add(cb);
  }

  close(): void {
    this.closed = true;
    void getClient().removeChannel(this.channel);
  }
}

/** Same-browser transport. Presence is emulated with a heartbeat. */
class LocalTransport implements Transport {
  readonly mode = "local" as const;
  private bc: BroadcastChannel | null = null;
  private id = Math.random().toString(36).slice(2);
  private handlers = new Set<Handler>();
  private presence = new Emitter<PresenceMeta[]>();
  private status = new Emitter<TransportStatus>();
  private peers = new Map<string, { meta: PresenceMeta; seen: number }>();
  private meta: PresenceMeta | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(roomCode: string) {
    if (typeof BroadcastChannel === "undefined") return;
    this.bc = new BroadcastChannel(channelName(roomCode));
    this.bc.onmessage = (ev) => {
      const m = ev.data as { e: string; p: unknown; from: string };
      if (!m || m.from === this.id) return;
      if (m.e === "__presence") {
        const meta = m.p as PresenceMeta | null;
        const had = this.peers.has(m.from);
        if (meta) this.peers.set(m.from, { meta, seen: Date.now() });
        else this.peers.delete(m.from);
        if (had !== !!meta || JSON.stringify(meta) !== JSON.stringify(this.lastEmitted.get(m.from))) this.emitPresence();
        return;
      }
      if (m.e === "__who") {
        this.beat();
        return;
      }
      for (const h of Array.from(this.handlers)) h(m.e, m.p);
    };
    this.timer = setInterval(() => {
      this.beat();
      const cutoff = Date.now() - 7000;
      let changed = false;
      for (const [id, peer] of this.peers) {
        if (peer.seen < cutoff) {
          this.peers.delete(id);
          changed = true;
        }
      }
      if (changed) this.emitPresence();
    }, 2000);
    this.post("__who", null);
    if (typeof window !== "undefined") window.addEventListener("pagehide", this.bye);
  }

  private lastEmitted = new Map<string, PresenceMeta>();
  private emitPresence() {
    this.lastEmitted = new Map(Array.from(this.peers, ([id, p]) => [id, p.meta]));
    this.presence.emit(Array.from(this.peers.values(), (p) => p.meta));
  }

  private bye = () => this.post("__presence", null);
  private beat() {
    if (this.meta) this.post("__presence", this.meta);
  }
  private post(e: string, p: unknown) {
    try {
      this.bc?.postMessage({ e, p, from: this.id });
    } catch {
      /* channel closed */
    }
  }

  send(event: string, payload: unknown): void {
    this.post(event, payload);
  }
  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  track(meta: PresenceMeta | null): void {
    this.meta = meta;
    this.post("__presence", meta);
  }
  onPresence(cb: (metas: PresenceMeta[]) => void): () => void {
    return this.presence.add(cb);
  }
  onStatus(cb: (status: TransportStatus) => void): () => void {
    cb("connected");
    return this.status.add(cb);
  }
  close(): void {
    this.bye();
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== "undefined") window.removeEventListener("pagehide", this.bye);
    this.bc?.close();
    this.bc = null;
  }
}

export function createTransport(roomCode: string): Transport {
  return supabaseConfigured() ? new SupabaseTransport(roomCode) : new LocalTransport(roomCode);
}
