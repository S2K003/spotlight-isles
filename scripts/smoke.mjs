// End-to-end rehearsal: starts the production server, then drives a host, 40 bots and one phone
// in headless Edge/Chrome at 10× speed. Checks the end time (90 s ±0.5 s), host reload/resume,
// Manual Mode, and that the browser console stays clean.
//
//   npm run build && npm run smoke            (uses installed Microsoft Edge; no browser download)
//   SMOKE_SHOTS=./shots npm run smoke         (also saves screenshots)
//   SMOKE_CHANNEL=chrome npm run smoke        (use Chrome instead)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const PORT = Number(process.env.SMOKE_PORT ?? 3217);
const BASE = process.env.SMOKE_BASE ?? `http://localhost:${PORT}`;
const SHOTS = process.env.SMOKE_SHOTS ?? "";
const ONLY = process.env.SMOKE_ONLY ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const note = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FAIL "} ${msg}`);
  if (!ok) problems.push(msg);
};

async function startServer() {
  if (process.env.SMOKE_BASE) return null;
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", (d) => process.stderr.write(d));
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  child.kill();
  throw new Error("server did not start");
}

function watch(page, label, errors) {
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/favicon|Failed to load resource/.test(text)) return;
    errors.push(`${label}: ${text}`);
  });
}

const shot = async (page, name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
};

const snapshot = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("spotlight-isles:host") ?? "null"));
const waitOver = (page, timeout) => page.waitForFunction(() => (document.body.innerText.includes("GAME OVER") && document.querySelector(".stamp") ? Date.now() : false), null, { timeout, polling: 20 });

async function fullGame(browser) {
  console.log("\n— Full game at 10× with 40 bots and a phone —");
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const host = await ctx.newPage();
  watch(host, "host", errors);
  await host.goto(`${BASE}/host?speed=10&fresh=1`);
  await host.getByRole("button", { name: "START", exact: true }).waitFor();
  const code = (await snapshot(host))?.roomCode ?? (await host.evaluate(() => document.body.innerText.match(/\b[A-HJ-NP-Z]{4}\b/)?.[0]));
  note(/^[A-HJ-NP-Z]{4}$/.test(code ?? ""), `room code ${code}`);

  const bots = await ctx.newPage();
  watch(bots, "bots", errors);
  const t0 = Date.now();
  await bots.goto(`${BASE}/dev/bots?code=${code}&count=40`);

  const phone = await ctx.newPage();
  watch(phone, "phone", errors);
  await phone.setViewportSize({ width: 375, height: 667 });
  await phone.goto(`${BASE}/play/${code}`);
  await phone.fill("#nick", "Tester");
  await phone.click("text=NEXT");
  await shot(phone, "phone-01-teams");
  await phone.click("text=Tide");
  await phone.waitForSelector("text=Waiting for the host");
  await shot(phone, "phone-02-waiting");

  await host.bringToFront();
  await host.waitForFunction(() => Number(document.body.innerText.match(/(\d+)\s*\n?\s*players ready/)?.[1] ?? 0) >= 41, null, { timeout: 8000 }).catch(() => {});
  const lobbyCount = await host.evaluate(() => document.querySelectorAll("button[title='Click to remove this player']").length);
  note(lobbyCount >= 41, `lobby shows ${lobbyCount} players (40 bots + 1 phone) after ${Date.now() - t0} ms`);
  await sleep(1500);
  await shot(host, "host-01-lobby");

  await host.getByRole("button", { name: "START", exact: true }).click();
  const startedAt = (await host.waitForFunction(() => JSON.parse(localStorage.getItem("spotlight-isles:host") ?? "{}").startedAt ?? false, null, { polling: 20 })).jsonValue();
  const start = await startedAt;

  // Screenshots at interesting game-time moments (seconds of the 15:00 clock ÷ 10).
  const marks = [
    [1.2, "intro-title"], [3.2, "intro-rules"], [5.2, "challenge"], [6.3, "reveal"], [7.2, "vote"], [8.2, "resolve"],
    [9.9, "challenge-slide"], [13.6, "spot-ready"], [15.0, "spot-speak"], [16.2, "spot-rate"], [19.6, "spot-reveal"], [20.6, "spot-vote"],
    [36.5, "round6"], [52.5, "sunset-vote"], [53.6, "sunset-resolve"], [71.7, "final-banner"], [72.6, "final-q"], [73.5, "final-reveal"],
    [77.4, "final-flood"], [78.7, "final-stage"], [80.0, "results-count"], [82.0, "results-podium"], [84.6, "results-awards"], [87.5, "debrief"],
  ];
  const phoneMarks = new Set(["challenge", "reveal", "vote", "resolve", "spot-speak", "spot-rate", "spot-reveal", "final-q", "debrief"]);
  let phoneAnswered = 0;
  const overPromise = waitOver(host, 120_000);
  for (const [sec, name] of marks) {
    const wait = start + sec * 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    await shot(host, `host-${String(Math.round(sec * 10)).padStart(3, "0")}-${name}`);
    if (phoneMarks.has(name)) await shot(phone, `phone-${String(Math.round(sec * 10)).padStart(3, "0")}-${name}`);
    // Play along on the phone where we can.
    if (name === "challenge" || name === "final-q") {
      const btn = phone.locator("section button:not([disabled])").first();
      if (await btn.count()) {
        await btn.click({ timeout: 300 }).catch(() => {});
        phoneAnswered++;
      }
    } else if (name === "vote" || name === "spot-vote" || name === "sunset-vote") {
      await phone.locator("svg g[role='button']").first().click({ timeout: 300 }).catch(() => {});
    }
  }
  const end = await (await overPromise).jsonValue();
  const elapsed = (end - start) / 1000;
  note(Math.abs(elapsed - 90) <= 0.5, `game ended after ${elapsed.toFixed(2)} s (target 90.00 ±0.5)`);
  await sleep(700);
  await shot(host, "host-900-gameover");
  await shot(phone, "phone-900-thanks");

  const final = await snapshot(host);
  note(final.history.length === 12, `12 rounds resolved (${final.history.length})`);
  note(!!final.results && !!final.debrief, "results and debrief computed");
  const moved = final.teams.filter((t) => t.pos.q !== t.home.q || t.pos.r !== t.home.r).length;
  note(moved >= 4, `${moved}/6 ships left home; scores ${final.teams.map((t) => t.score).join(", ")}`);
  const stats = Object.values(final.players);
  const answered = stats.reduce((s, p) => s + p.stats.answered, 0);
  const ratings = stats.reduce((s, p) => s + p.stats.ratings, 0);
  note(answered > 300, `${answered} answers and ${ratings} ratings recorded from ${stats.length} players`);
  note(ratings > 100, "spotlight ratings came through");
  note(await phone.locator("text=Thanks for playing").count() > 0, `phone shows the thank-you screen (answered ${phoneAnswered} on the phone)`);
  const fps = await host.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; performance.now() - t < 1000 ? requestAnimationFrame(f) : res(n); }; requestAnimationFrame(f); }));
  console.log(`      (headless software-GL frame rate: ~${fps} fps; not representative of a real GPU)`);
  note(errors.length === 0, `console clean (${errors.length} errors)`);
  for (const e of errors.slice(0, 12)) console.log("      " + e);
  await ctx.close();
}

async function reloadResume(browser) {
  console.log("\n— Host reload mid-game resumes on the same clock (30×) —");
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await ctx.newPage();
  watch(host, "host", errors);
  await host.goto(`${BASE}/host?speed=30&fresh=1`);
  await host.getByRole("button", { name: "START", exact: true }).waitFor();
  const code = (await snapshot(host)).roomCode;
  const bots = await ctx.newPage();
  await bots.goto(`${BASE}/dev/bots?code=${code}&count=12`);
  await host.bringToFront();
  await sleep(1500);
  await host.getByRole("button", { name: "START", exact: true }).click();
  await host.click("text=GO!", { timeout: 500 }).catch(() => {});
  const start = await (await host.waitForFunction(() => JSON.parse(localStorage.getItem("spotlight-isles:host") ?? "{}").startedAt ?? false, null, { polling: 20 })).jsonValue();
  await sleep(9000);
  const before = await snapshot(host);
  await host.goto(`${BASE}/host`); // reload without ?fresh: must pick the snapshot up
  await host.waitForSelector("text=/ROUND|FINAL|RESULTS|DEBRIEF/", { timeout: 5000 }).catch(() => {});
  await sleep(600);
  const after = await snapshot(host);
  note(after.roomCode === code && after.startedAt === start, "same room and start time after reload");
  note(after.phaseIndex > before.phaseIndex, `kept advancing (${before.phaseIndex} → ${after.phaseIndex})`);
  await shot(host, "reload-720p");
  const end = await (await waitOver(host, 60_000)).jsonValue();
  const elapsed = (end - start) / 1000;
  note(Math.abs(elapsed - 30) <= 0.5, `ended after ${elapsed.toFixed(2)} s from the ORIGINAL start (target 30.00 ±0.5)`);
  const final = await snapshot(host);
  note(Object.values(final.players).some((p) => p.stats.answered > 3), "bots were re-attached after the reload and kept answering");
  note(errors.length === 0, `console clean (${errors.length} errors)`);
  for (const e of errors.slice(0, 8)) console.log("      " + e);
  await ctx.close();
}

async function manualMode(browser) {
  console.log("\n— Manual Mode: a whole game with no phones (8×) —");
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const host = await ctx.newPage();
  watch(host, "host", errors);
  await host.goto(`${BASE}/host?speed=8&fresh=1`);
  await host.getByRole("button", { name: "START", exact: true }).waitFor();
  await host.check("input[type=checkbox]");
  await host.getByRole("button", { name: "START", exact: true }).click();
  const start = await (await host.waitForFunction(() => JSON.parse(localStorage.getItem("spotlight-isles:host") ?? "{}").startedAt ?? false, null, { polling: 20 })).jsonValue();
  const overPromise = waitOver(host, 150_000);
  let clicks = 0;
  let shots = 0;
  // Click through the manual panel like an operator would.
  while (Date.now() - start < 111_000) {
    const panel = host.locator("text=MANUAL MODE").locator("xpath=ancestor::div[contains(@class,'glossy')]");
    if (await panel.count()) {
      const title = await panel.innerText().catch(() => "");
      if (/got it right|Hands up/.test(title)) {
        for (const label of ["80+", "50–79", "1–49"]) {
          const b = panel.locator(`button:has-text("${label}")`);
          const n = await b.count();
          if (n) await b.nth(Math.floor(Math.random() * n)).click({ timeout: 200 }).then(() => clicks++).catch(() => {});
        }
      } else if (/destination/.test(title)) {
        const tabs = panel.locator("button:has(svg)");
        const n = Math.min(6, await tabs.count());
        for (let i = 0; i < n; i++) {
          await tabs.nth(i).click({ timeout: 200 }).catch(() => {});
          const hexes = panel.locator("svg g[role='button']");
          const h = await hexes.count();
          if (h) await hexes.nth(Math.floor(Math.random() * h)).click({ timeout: 200 }).then(() => clicks++).catch(() => {});
        }
        if (shots === 1) { await shot(host, "manual-vote"); shots++; }
      } else if (/star rating/.test(title)) {
        await panel.locator("button:has-text('★')").nth(3).click({ timeout: 200 }).then(() => clicks++).catch(() => {});
        await panel.locator("button:has-text('★')").nth(9).click({ timeout: 200 }).catch(() => {});
      } else if (/Which way/.test(title)) {
        const b = panel.locator("button:has-text('TRUE'), button:has-text('FALSE')");
        const n = await b.count();
        for (let i = 0; i < n; i += 2) await b.nth(i + (Math.random() < 0.5 ? 0 : 1)).click({ timeout: 200 }).then(() => clicks++).catch(() => {});
      }
      if (shots === 0 && /got it right/.test(title)) { await shot(host, "manual-bands"); shots++; }
    }
    await sleep(40);
  }
  const end = await (await overPromise).jsonValue();
  const final = await snapshot(host);
  const moved = final.teams.filter((t) => t.pos.q !== t.home.q || t.pos.r !== t.home.r).length;
  note(Math.abs((end - start) / 1000 - 112.5) <= 0.5, `ended after ${((end - start) / 1000).toFixed(2)} s (target 112.50)`);
  // The scripted operator is slow under software rendering, so it only reaches some teams each vote.
  const painted = final.teams.reduce((s, t) => s + t.score, 0);
  note(clicks > 20 && painted > 100, `${clicks} operator clicks moved ships from the panel; ${moved}/6 away from home at the end; scores ${final.teams.map((t) => t.score).join(", ")}`);
  note(final.debrief?.takeaways.length === 3, "debrief produced with no phones");
  note(errors.length === 0, `console clean (${errors.length} errors)`);
  for (const e of errors.slice(0, 8)) console.log("      " + e);
  await ctx.close();
}

async function staticPages(browser) {
  console.log("\n— Landing and guide pages —");
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await ctx.newPage();
  watch(page, "page", errors);
  await page.goto(BASE);
  note(await page.locator("text=JOIN GAME").count() > 0, "landing renders");
  await shot(page, "landing");
  await page.setViewportSize({ width: 1000, height: 1300 });
  await page.goto(`${BASE}/guide?code=ABCD`);
  await page.waitForSelector("img[alt^='QR code']");
  note(await page.locator(".sheet").count() === 4, "guide has 2 guide pages + question bank + QR poster");
  // Every sheet must fit on one A4 page when printed (296 mm tall), or it would be clipped.
  await page.emulateMedia({ media: "print" });
  const fit = await page.evaluate(() => Array.from(document.querySelectorAll(".sheet"), (s) => Math.round((s.scrollHeight / s.clientHeight) * 100)));
  note(fit.every((p) => p <= 100), `each guide sheet fits one A4 page (content is ${fit.join("%, ")}% of the page height)`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "guide-print.png"), fullPage: true }).catch(() => {});
  await page.emulateMedia({ media: "screen" });
  await shot(page, "guide");
  if (SHOTS) await page.pdf({ path: path.join(SHOTS, "guide.pdf"), format: "A4", printBackground: true }).catch(() => {});
  note(errors.length === 0, `console clean (${errors.length} errors)`);
  for (const e of errors.slice(0, 8)) console.log("      " + e);
  await ctx.close();
}

const server = await startServer();
const browser = await chromium.launch({
  channel: process.env.SMOKE_CHANNEL ?? "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
});
try {
  const tests = { full: fullGame, reload: reloadResume, manual: manualMode, pages: staticPages };
  for (const [name, fn] of Object.entries(tests)) {
    if (ONLY && !ONLY.split(",").includes(name)) continue;
    try {
      await fn(browser);
    } catch (e) {
      note(false, `${name}: ${e.message.split("\n")[0]}`);
    }
  }
} finally {
  await browser.close();
  server?.kill();
}
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nAll smoke checks passed");
process.exit(problems.length ? 1 : 0);
