// Records a real screen-capture walkthrough of the live Caseway site doing an
// attorney lookup (home -> Connecticut -> Stamford -> Family category -> results
// map -> attorney profile), then converts it to a smooth mp4.
//
// Run with the web + api workflows already running:
//   pnpm --filter @workspace/scripts run record:walkthrough
//
// It drives the real app with Playwright (playwright-core + the system Chromium,
// no bundled browser download) and overlays a guided cursor + captions, then
// encodes to 60fps with frame interpolation for smooth playback. Output:
//   media/caseway-walkthrough.mp4
//
// Env overrides: WT_URL (default http://localhost:80/), WT_CHROMIUM, WT_FFMPEG,
//   WT_FPS (default 60), WT_SMOOTH (0 to disable interpolation),
//   WT_KEEP_SOURCE (1 to keep the raw webm for re-encoding).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const BASE = process.env.WT_URL || 'http://localhost:80/';
const W = 1280;
const H = 720;
const mediaDir = path.join(repoRoot, 'media');
const tmpDir = path.join(mediaDir, '.rec-tmp');
const outMp4 = path.join(mediaDir, 'caseway-walkthrough.mp4');

function resolveBin(name, envKey) {
  if (process.env[envKey]) return process.env[envKey];
  try {
    return execSync(`command -v ${name}`, { shell: '/bin/bash' }).toString().trim();
  } catch {
    return name;
  }
}
const chromiumPath = resolveBin('chromium', 'WT_CHROMIUM');
const ffmpegPath = resolveBin('ffmpeg', 'WT_FFMPEG');
const log = (...a) => console.log('[walkthrough]', ...a);

// timing (ms) — cursor glides are CSS-driven. The capture is a steady 25fps, so
// glides are deliberately long (~16 frames each) to read smooth; dead-air between
// steps is trimmed instead to keep the overall pace quick.
const CURSOR_MS = 900; // cursor glide duration (keep MOVE_WAIT >= this)
const MOVE_WAIT = 940;
const TYPE_DELAY = 32;

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1, // 1x keeps the screencast frame rate high (smoother capture)
  recordVideo: { dir: tmpDir, size: { width: W, height: H } },
});
const page = await ctx.newPage();
const recT0 = Date.now(); // ~recording start; used to trim the leading white/load
let leadTrim = 0;

// ---- guided-cursor + caption overlay (lives on <body>, survives SPA step changes)
async function injectOverlay() {
  await page.evaluate((curMs) => {
    if (document.getElementById('__wt_cursor')) return;
    const cur = document.createElement('div');
    cur.id = '__wt_cursor';
    Object.assign(cur.style, {
      position: 'fixed', left: '50%', top: '62%', width: '26px', height: '26px',
      borderRadius: '50%', background: 'rgba(176,141,46,0.35)',
      border: '2px solid rgba(176,141,46,0.95)',
      boxShadow: '0 0 0 3px rgba(255,255,255,0.65), 0 4px 14px rgba(0,0,0,0.25)',
      transform: 'translate(-50%,-50%)', zIndex: '2147483647', pointerEvents: 'none',
      transition: `left ${curMs}ms cubic-bezier(.42,0,.2,1), top ${curMs}ms cubic-bezier(.42,0,.2,1)`,
      opacity: '0', willChange: 'left, top',
    });
    document.body.appendChild(cur);

    const cap = document.createElement('div');
    cap.id = '__wt_cap';
    Object.assign(cap.style, {
      position: 'fixed', bottom: '40px', left: '50%',
      transform: 'translateX(-50%) translateY(8px)', maxWidth: '78vw',
      background: 'rgba(20,20,22,0.84)', color: '#fff', padding: '13px 24px',
      borderRadius: '9999px',
      font: '600 17px/1.25 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      letterSpacing: '.01em', zIndex: '2147483647', pointerEvents: 'none',
      boxShadow: '0 10px 34px rgba(0,0,0,0.32)', backdropFilter: 'blur(8px)',
      opacity: '0', transition: 'opacity .28s ease, transform .28s ease',
      display: 'inline-flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap',
    });
    const dot = document.createElement('span');
    Object.assign(dot.style, { width: '8px', height: '8px', borderRadius: '50%', background: '#b08d2e', flex: '0 0 auto' });
    const txt = document.createElement('span');
    txt.id = '__wt_cap_txt';
    cap.appendChild(dot);
    cap.appendChild(txt);
    document.body.appendChild(cap);
  }, CURSOR_MS);
}
async function showCursor() {
  await page.evaluate(() => { const c = document.getElementById('__wt_cursor'); if (c) c.style.opacity = '1'; });
}
async function caption(text) {
  await page.evaluate((t) => {
    const cap = document.getElementById('__wt_cap');
    const txt = document.getElementById('__wt_cap_txt');
    if (!cap || !txt) return;
    cap.style.opacity = '0';
    cap.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => {
      txt.textContent = t;
      cap.style.opacity = '1';
      cap.style.transform = 'translateX(-50%) translateY(0)';
    }, 100);
  }, text);
  await page.waitForTimeout(300);
}
async function moveTo(x, y) {
  await page.evaluate(([x, y]) => {
    const c = document.getElementById('__wt_cursor');
    if (!c) return;
    c.style.left = x + 'px';
    c.style.top = y + 'px';
  }, [x, y]);
  await page.waitForTimeout(MOVE_WAIT);
}
async function ripple() {
  await page.evaluate(() => {
    const c = document.getElementById('__wt_cursor');
    if (!c) return;
    const x = parseFloat(c.style.left), y = parseFloat(c.style.top);
    const r = document.createElement('div');
    Object.assign(r.style, {
      position: 'fixed', left: x + 'px', top: y + 'px', width: '14px', height: '14px',
      borderRadius: '50%', border: '2px solid rgba(176,141,46,0.9)',
      transform: 'translate(-50%,-50%) scale(1)', zIndex: '2147483646',
      pointerEvents: 'none', opacity: '0.9',
      transition: 'transform .45s ease-out, opacity .45s ease-out',
    });
    document.body.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'translate(-50%,-50%) scale(4)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 480);
  });
}
async function pointAt(locator) {
  const box = await locator.boundingBox();
  if (!box) return null;
  const x = box.x + box.width / 2;
  const y = Math.min(box.y + box.height / 2, H - 70);
  await moveTo(x, y);
  return { x, y };
}
async function guidedClick(locator, opts = {}) {
  await pointAt(locator);
  await ripple();
  await page.waitForTimeout(90);
  await locator.click(opts);
}
async function introCover() {
  await page.evaluate(() => {
    const o = document.createElement('div');
    o.id = '__wt_intro';
    Object.assign(o.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none',
      background: '#faf9f6', transition: 'opacity .55s ease', opacity: '1',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    });
    const wrap = document.createElement('div');
    wrap.style.textAlign = 'center';
    const name = document.createElement('div');
    name.textContent = 'Caseway';
    Object.assign(name.style, { font: "500 64px/1 Georgia,'Times New Roman',serif", color: '#1a1a1a', letterSpacing: '-0.01em', marginBottom: '14px' });
    const tag = document.createElement('div');
    tag.textContent = 'Find your way to the right attorney.';
    Object.assign(tag.style, { font: '400 21px/1.4 ui-sans-serif,system-ui,sans-serif', color: '#6b6b6b' });
    wrap.appendChild(name);
    wrap.appendChild(tag);
    o.appendChild(wrap);
    document.body.appendChild(o);
  });
}
async function hideIntro() {
  await page.evaluate(() => {
    const o = document.getElementById('__wt_intro');
    if (o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 650); }
  });
}

try {
  log('navigating to', BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.getByRole('combobox', { name: 'Select a state' }).waitFor({ timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(300);
  await injectOverlay();

  // Branded intro cover. It is opaque from its first painted frame, so trimming the
  // recording to this moment removes the browser's initial white screen + load time.
  const coverAt = Date.now();
  await introCover();
  if (!process.env.WT_NO_TRIM) leadTrim = Math.max(0, (coverAt - recT0) / 1000 + 0.25);
  await page.waitForTimeout(850);
  await hideIntro();
  await page.waitForTimeout(250);
  await showCursor();

  await caption('Finding an attorney on Caseway');
  await page.waitForTimeout(700);

  // 1) State
  await caption('First, choose your state');
  await guidedClick(page.getByRole('combobox', { name: 'Select a state' }));
  const stateSearch = page.getByPlaceholder('Search state...');
  await stateSearch.waitFor({ timeout: 8000 });
  await page.waitForTimeout(220);
  await stateSearch.type('Connecticut', { delay: TYPE_DELAY });
  await page.waitForTimeout(280);
  const ctOpt = page.getByRole('option', { name: 'Connecticut' }).first();
  await ctOpt.waitFor({ timeout: 8000 });
  await guidedClick(ctOpt);
  await page.waitForTimeout(450);

  // 2) Town
  await caption('Then pick your town');
  await guidedClick(page.getByRole('combobox', { name: 'Select a town' }));
  const townSearch = page.getByPlaceholder('Search town...');
  await townSearch.waitFor({ timeout: 8000 });
  await page.waitForTimeout(220);
  await townSearch.type('Stamford', { delay: TYPE_DELAY });
  await page.waitForTimeout(320);
  let townOpt = page.getByRole('option', { name: 'Stamford', exact: true }).first();
  if ((await townOpt.count()) === 0) {
    townOpt = page.getByRole('option', { name: 'Stamford' }).first();
  }
  await townOpt.waitFor({ timeout: 8000 });
  await guidedClick(townOpt);
  await page.waitForTimeout(450);

  // 3) Find lawyers
  await caption('Search for lawyers near you');
  await guidedClick(page.getByRole('button', { name: /Find lawyers/i }));
  await page.getByRole('button', { name: 'Family or Relationship issue' }).waitFor({ timeout: 12000 });
  await page.waitForTimeout(550);

  // 4) Category
  await caption('Tell us what kind of help you need');
  await page.waitForTimeout(600);
  await guidedClick(page.getByRole('button', { name: 'Family or Relationship issue' }));

  // 5) Results
  const firstCard = page.getByRole('button', { name: /View profile for/ }).first();
  await firstCard.waitFor({ timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await caption('Browse matching attorneys on the map');
  await page.waitForTimeout(1300);
  await pointAt(firstCard);
  await page.waitForTimeout(500);

  // 6) Open a profile
  await caption('Open a profile for full details');
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(120);
  await guidedClick(firstCard);
  const consult = page.getByText('Book Free Consultation').first();
  await consult.waitFor({ timeout: 12000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(650);

  await caption('See experience, fees, and book a free consult');
  await pointAt(consult).catch(() => {});
  await page.waitForTimeout(1400);

  // 7) Outro card
  await page.evaluate(() => {
    const o = document.createElement('div');
    o.id = '__wt_outro';
    Object.assign(o.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none',
      background: 'rgba(250,249,246,0.0)', transition: 'background .5s ease',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    });
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { textAlign: 'center', opacity: '0', transform: 'translateY(10px)', transition: 'opacity .5s ease .12s, transform .5s ease .12s' });
    const name = document.createElement('div');
    name.textContent = 'Caseway';
    Object.assign(name.style, { font: "500 64px/1 Georgia,'Times New Roman',serif", color: '#1a1a1a', letterSpacing: '-0.01em', marginBottom: '14px' });
    const tag = document.createElement('div');
    tag.textContent = 'Find your way to the right attorney.';
    Object.assign(tag.style, { font: '400 21px/1.4 ui-sans-serif,system-ui,sans-serif', color: '#6b6b6b' });
    wrap.appendChild(name);
    wrap.appendChild(tag);
    o.appendChild(wrap);
    document.body.appendChild(o);
    const cap = document.getElementById('__wt_cap'); if (cap) cap.style.opacity = '0';
    const cur = document.getElementById('__wt_cursor'); if (cur) cur.style.opacity = '0';
    requestAnimationFrame(() => { o.style.background = 'rgba(250,249,246,0.97)'; wrap.style.opacity = '1'; wrap.style.transform = 'translateY(0)'; });
  });
  await page.waitForTimeout(1800);
  log('flow complete');
} catch (e) {
  log('ERROR', e && e.message);
  await page.screenshot({ path: path.join(tmpDir, 'error.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await ctx.close(); // flush the recording to disk
  await browser.close();
}

const webm = fs.readdirSync(tmpDir).find((f) => f.endsWith('.webm'));
if (!webm) {
  log('no video produced');
  process.exit(1);
}
const webmPath = path.join(tmpDir, webm);
if (process.env.WT_KEEP_SOURCE) {
  fs.writeFileSync(path.join(tmpDir, 'lead.txt'), String(leadTrim));
}
const fps = process.env.WT_FPS || '60';
// Smoothing modes: 'mci' (default) synthesizes true motion-compensated in-between
// frames -> genuinely fluid cursor/slide motion (scd=fdiff avoids warping across
// hard cuts); 'blend' cross-fades (cheaper, slight ghosting); '0' disables.
// 'blend' (default) is reliable everywhere; 'mci' is genuinely smoother but very
// CPU-heavy (can exceed time/memory limits on small machines) — opt in via env.
const mode = process.env.WT_SMOOTH === '0' ? 'off' : (process.env.WT_SMOOTH_MODE || 'blend');
let vf;
if (mode === 'blend') vf = ['-vf', `minterpolate=fps=${fps}:mi_mode=blend`];
else if (mode === 'off') vf = ['-r', fps];
else vf = ['-vf', `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=fdiff`];
const ss = leadTrim > 0.05 ? ['-ss', leadTrim.toFixed(2)] : [];
log(`encoding mp4 (${mode === 'off' ? `${fps}fps` : `${mode} ${fps}fps`}${ss.length ? `, trim ${ss[1]}s lead` : ''}) ->`, path.relative(repoRoot, outMp4));
execFileSync(ffmpegPath, [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', webmPath,
  ...ss,
  ...vf,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
  '-movflags', '+faststart', '-an', outMp4,
], { stdio: 'inherit' });
if (!process.env.WT_KEEP_SOURCE) fs.rmSync(tmpDir, { recursive: true, force: true });
log('done:', path.relative(repoRoot, outMp4));
