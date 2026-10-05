// Measures how many broadcast messages actually get through Supabase Realtime at a given rate.
//   node --env-file=.env.local scripts/probe.mjs [count] [gapMs] [senders]
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const count = Number(process.argv[2] ?? 40);
const gap = Number(process.argv[3] ?? 35);
const senders = Number(process.argv[4] ?? 1);
const topic = `spotlight:PROBE${Math.random().toString(36).slice(2, 6)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mk = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 40 } } });

async function join(client, onMsg) {
  const ch = client.channel(topic, { config: { broadcast: { self: false, ack: false } } });
  if (onMsg) ch.on("broadcast", { event: "m" }, onMsg);
  await new Promise((res, rej) => ch.subscribe((s, e) => (s === "SUBSCRIBED" ? res() : s === "CHANNEL_ERROR" || s === "TIMED_OUT" ? rej(e ?? new Error(s)) : null)));
  return ch;
}

let got = 0;
const rx = mk();
await join(rx, () => got++);
const chans = [];
for (let i = 0; i < senders; i++) chans.push(await join(mk()));
const results = {};
const t0 = Date.now();
for (let i = 0; i < count; i++) {
  chans[i % senders].send({ type: "broadcast", event: "m", payload: { e: "join", p: { i, pad: "x".repeat(60) } } }).then((r) => (results[r] = (results[r] ?? 0) + 1));
  if (gap) await sleep(gap);
}
const sendMs = Date.now() - t0;
await sleep(2500);
console.log(`sent ${count} from ${senders} sender(s) in ${sendMs} ms (${Math.round((count / Math.max(1, sendMs)) * 1000)}/s) -> received ${got}; send() results ${JSON.stringify(results)}`);
process.exit(0);
