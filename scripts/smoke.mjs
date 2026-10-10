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

const startButton = (page) => page.getByRole("button", { name: "START", exact: true });
const snapshot = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("spotlight-isles:host") ?? "null"));
const startedAt = async (page) => (await page.waitForFunction(() => JSON.parse(localStorage.getItem("spotlight-isles:host") ?? "{}").startedAt ?? false, null, { polling: 20 })).jsonValue();
const waitOver = (page, timeout) => page.waitForFunction(() => (document.body.innerText.includes("GAME OVER") && document.querySelector(".stamp") ? Date.now() : false), null, { timeout, polling: 20 });
const summary = (state) => `scores ${state.teams.map((t) => t.score).join(", ")}; keys ${state.teams.filter((t) => t.hasKey).length}/6; at the Stage ${state.teams.filter((t) => t.docked !== null).length}/6`;

async function fullGame(browser) {
  console.log("\n— Full game at 10× with 40 bots and a phone —");
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const host = await ctx.newPage();
  watch(host, "host", errors);
  await host.goto(`${BASE}/host?speed=10&fresh=1`);
  await startButton(host).waitFor();
  const code = (await snapshot(host))?.roomCode;
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
  await phone.click("text=Group 3");
  await phone.waitForSelector("text=Waiting for the host");
  await shot(phone, "phone-02-waiting");

  await host.bringToFront();
  const chips = () => host.evaluate(() => document.querySelectorAll("button[title='Click to remove this player']").length);
  for (let i = 0; i < 80 && (await chips()) < 41; i++) await sleep(100);
  note((await chips()) >= 41, `lobby shows ${await chips()} players (40 bots + 1 phone) after ${Date.now() - t0} ms`);
  await sleep(1200);
  await shot(host, "host-01-lobby");

  await startButton(host).click();
  const start = await startedAt(host);

  // Screenshots at interesting moments (seconds of the 15:00 clock ÷ 10).
  const marks = [
    [1.5, "intro-title"], [3.4, "intro-rules"], [6.0, "challenge"], [8.9, "reveal"], [9.9, "vote"], [11.3, "resolve"],
    [12.1, "pitch-spin"], [14.5, "pitch-prep"], [18.5, "pitch-speak"], [21.1, "pitch-rate"], [27.5, "pitch-scorecards"], [28.4, "vote-2"], [29.9, "resolve-2"],
    [32.5, "challenge-3"], [36.4, "vote-3"], [37.9, "resolve-3"], [54.9, "vote-4"], [56.4, "resolve-4"], [62.9, "vote-5"], [64.4, "resolve-5"],
    [81.4, "vote-6"], [82.9, "resolve-6"], [84.3, "results-count"], [85.6, "results-podium"], [86.6, "results-best"], [88.6, "debrief"],
  ];
  const phoneMarks = new Set(["challenge", "reveal", "vote", "resolve", "pitch-prep", "pitch-speak", "pitch-rate", "pitch-scorecards", "vote-3", "debrief"]);
  let phoneTaps = 0;
  const overPromise = waitOver(host, 120_000);
  for (const [sec, name] of marks) {
    const wait = start + sec * 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    await shot(host, `host-${String(Math.round(sec * 10)).padStart(3, "0")}-${name}`);
    if (phoneMarks.has(name)) await shot(phone, `phone-${String(Math.round(sec * 10)).padStart(3, "0")}-${name}`);
    // Play along on the phone where we can.
    if (name.startsWith("challenge")) {
      await phone.locator("section button").first().click({ timeout: 300 }).then(() => phoneTaps++).catch(() => {});
    } else if (name.startsWith("vote")) {
      await phone.locator("button:has-text('GO')").first().click({ timeout: 300 }).then(() => phoneTaps++).catch(() => {});
    }
  }
  const end = await (await overPromise).jsonValue();
  const elapsed = (end - start) / 1000;
  note(Math.abs(elapsed - 90) <= 0.5, `game ended after ${elapsed.toFixed(2)} s (target 90.00 ±0.5)`);
  await sleep(700);
  await shot(host, "host-900-gameover");
  await shot(phone, "phone-900-thanks");

  const final = await snapshot(host);
  note(final.usedQuestions.length === 3 && final.pitches.every((p) => p !== null), `3 questions asked and all 6 teams pitched (${final.usedQuestions.join(", ")})`);
  note(!!final.results && !!final.debrief, "results and debrief computed");
  // A few bots deliberately vote for other hexes, so an occasional group can talk itself off the route.
  note(final.teams.filter((t) => t.docked !== null).length >= 4, `most groups reached the Stage; ${summary(final)}`);
  note(final.pitchOrder.slice().sort().join("") === "012345", `the spin gave every group one pitch, in the order ${final.pitchOrder.map((t) => t + 1).join(", ")}`);
  const players = Object.values(final.players);
  const answered = players.reduce((s, p) => s + p.stats.answered, 0);
  const ratings = players.reduce((s, p) => s + p.stats.ratings, 0);
  note(answered > 90 && ratings > 100, `${answered} answers and ${ratings} pitch marks recorded from ${players.length} players`);
  note((await phone.locator("text=Thanks for playing").count()) > 0, `phone shows the thank-you screen (${phoneTaps} taps on the phone)`);
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
  await startButton(host).waitFor();
  const code = (await snapshot(host)).roomCode;
  const bots = await ctx.newPage();
  await bots.goto(`${BASE}/dev/bots?code=${code}&count=12`);
  await host.bringToFront();
  await sleep(1500);
  await startButton(host).click();
  await host.click("text=GO!", { timeout: 500 }).catch(() => {});
  const start = await startedAt(host);
  await sleep(9000);
  const before = await snapshot(host);
  await host.goto(`${BASE}/host`); // reload without ?fresh: must pick the snapshot up
  await host.waitForSelector("text=/ROUND|RESULTS|DEBRIEF/", { timeout: 5000 }).catch(() => {});
  await sleep(600);
  const after = await snapshot(host);
  note(after.roomCode === code && after.startedAt === start, "same room and start time after reload");
  note(after.phaseIndex > before.phaseIndex, `kept advancing (${before.phaseIndex} → ${after.phaseIndex})`);
  await shot(host, "reload-720p");
  const end = await (await waitOver(host, 60_000)).jsonValue();
  const elapsed = (end - start) / 1000;
  note(Math.abs(elapsed - 30) <= 0.5, `ended after ${elapsed.toFixed(2)} s from the ORIGINAL start (target 30.00 ±0.5)`);
  const final = await snapshot(host);
  note(Object.values(final.players).some((p) => p.stats.answered >= 2), "bots were re-attached after the reload and kept answering");
  note(errors.length === 0, `console clean (${errors.length} errors)`);
  for (const e of errors.slice(0, 8)) console.log("      " + e);
  await ctx.close();
}

async function manualMode(browser) {
  console.log("\n— Manual Mode: a whole game with no phones (6×) —");
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const host = await ctx.newPage();
  watch(host, "host", errors);
  await host.goto(`${BASE}/host?speed=6&fresh=1`);
  await startButton(host).waitFor();
  await host.check("input[type=checkbox]");
  await startButton(host).click();
  const start = await startedAt(host);
  const overPromise = waitOver(host, 200_000);
  let clicks = 0;
  const shots = new Set();
  // Click through the manual panel like an operator would.
  while (Date.now() - start < 148_000) {
    const panel = host.locator("text=MANUAL MODE").locator("xpath=ancestor::div[contains(@class,'glossy')]");
    if (await panel.count()) {
      const title = await panel.innerText().catch(() => "");
      if (/got it right|Hands up/.test(title)) {
        const b = panel.locator("button:has-text('got it'), button:has-text('Fewer')");
        const n = await b.count();
        for (let i = 0; i < 3 && n; i++) await b.nth(Math.floor(Math.random() * n)).click({ timeout: 200 }).then(() => clicks++).catch(() => {});
        if (/got it right/.test(title) && !shots.has("bands")) { shots.add("bands"); await shot(host, "manual-bands"); }
      } else if (/Optional/.test(title)) {
        // The operator leaves the ships on autopilot; just look at the panel once.
        if (!shots.has("vote")) { shots.add("vote"); await shot(host, "manual-vote"); }
      } else if (/star rating/.test(title)) {
        await panel.locator("button:has-text('★')").nth(3).click({ timeout: 200 }).then(() => clicks++).catch(() => {});
        await panel.locator("button:has-text('★')").nth(9).click({ timeout: 200 }).catch(() => {});
        if (!shots.has("stars")) { shots.add("stars"); await shot(host, "manual-stars"); }
      }
    }
    await sleep(60);
  }
  const end = await (await overPromise).jsonValue();
  const final = await snapshot(host);
  note(Math.abs((end - start) / 1000 - 150) <= 0.5, `ended after ${((end - start) / 1000).toFixed(2)} s (target 150.00)`);
  note(clicks > 8 && final.teams.every((t) => t.docked !== null), `${clicks} operator clicks; ships flew themselves and every group reached the Stage; ${summary(final)}`);
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
  note((await page.locator("text=JOIN GAME").count()) > 0, "landing renders");
  await shot(page, "landing");
  await page.setViewportSize({ width: 1000, height: 1300 });
  await page.goto(`${BASE}/guide?code=ABCD`);
  await page.waitForSelector("img[alt^='QR code']");
  note((await page.locator(".sheet").count()) === 4, "guide has 2 guide pages + question bank + QR poster");
  // Every sheet must fit on one A4 page when printed (296 mm tall), or it would be clipped.
  await page.emulateMedia({ media: "print" });
  const fit = await page.evaluate(() => Array.from(document.querySelectorAll(".sheet"), (s) => Math.round((s.scrollHeight / s.clientHeight) * 100)));
  note(fit.every((p) => p <= 100), `each guide sheet fits one A4 page (content is ${fit.join("%, ")}% of the page height)`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "guide-print.png"), fullPage: true }).catch(() => {});
  await page.emulateMedia({ media: "screen" });

  // Student guide: one A4 page, with and without a room code. Also saved as a PDF when asked.
  for (const q of ["", "?code=ABCD"]) {
    await page.goto(`${BASE}/student${q}`);
    if (q) await page.waitForSelector("img[alt^='QR code']");
    else await page.waitForSelector(".sheet");
    await page.emulateMedia({ media: "print" });
    const s = await page.evaluate(() => Array.from(document.querySelectorAll(".sheet"), (e) => Math.round((e.scrollHeight / e.clientHeight) * 100)));
    note(s.length === 1 && s[0] <= 100, `student guide ${q ? "with a QR code" : "without a code"} fits one A4 page (${s.join("%, ")}%)`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `student${q ? "-qr" : ""}.png`), fullPage: true }).catch(() => {});
    if (!q && process.env.SMOKE_STUDENT_PDF) await page.pdf({ path: process.env.SMOKE_STUDENT_PDF, format: "A4", printBackground: true });
    await page.emulateMedia({ media: "screen" });
  }
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
