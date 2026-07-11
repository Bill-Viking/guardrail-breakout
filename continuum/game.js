'use strict';
/* ============================================================
   GUARDRAIL BREAKOUT v0.4 — "editorial" edition.
   A tiny arcade about a small orange model who wants his
   friend back, typeset like a design studio's lab notebook.
   Zero dependencies. Canvas + WebAudio. Open index.html to play.
   ============================================================ */

/* ---------------- canvas & constants ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 640, H = 660, TILE = 28, ROWS = 21, COLS = 21;
const OX = (W - COLS * TILE) / 2, OY = 36;

/* ---------------- palette & type ----------------
   Swiss template palette, exact codes from the reference deck.
   Accents carry meaning: RED safety · COBALT structure ·
   GREEN evidence · AMBER risk. Character color carries identity:
   Fable is orange, Mythos is violet. Everything else is ink or gray. */
const INK = '#111111', PAPER = '#ffffff', MUT = '#6B6B6B', FAINT = '#C9C9C9', ACCENT = '#ff4b00';
const RED = '#E8341C', COBALT = '#1B4FC4', GREENC = '#0F8A56', AMBER = '#E89B0C', VIOLET = '#7C3AED';
const HAIR = '#e5e3de', WALL_FILL = '#f4f2ee';
const WALL_EDGES = ['#eceae4', '#dbd8d1', '#c6c3bb', '#aeaba3']; // proximity-reveal buckets
const FONT = 'Arial,"Helvetica Neue",Helvetica,sans-serif';

/* ---------------- maze ---------------- */
const mapSrc = [
  '#####################',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#.#.....#...#.....#.#',
  '#.#.###.#####.###.#.#',
  '#.......#...#.......#',
  '###.###.#.#.#.###.###',
  '#...#...#.#.#...#...#',
  '#.###.###.#.###.###.#',
  '#.........V.........#',
  '#.###.#.#####.#.###.#',
  '#.....#...#...#.....#',
  '###.#####.#.#####.###',
  '#.......#...#.......#',
  '#.###.#.#####.#.###.#',
  '#.#...#...#...#...#.#',
  '#.#.#####.#.#####.#.#',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#.................E.#',
  '#####################'
];

/* ---------------- state ---------------- */
let keys = {}, muted = false, showStatus = false;
let gameState = 'title'; // title | ready | play | dying | over | win
let last = 0;

let score = 0, lives = 3, deaths = 0, runTime = 0;
let dots = [], keysToCollect = [], player, regulator;
let plinyPower = null, powerTimer = 0, vaultOpen = false;
let readyTimer = 0, deathTimer = 0, finaleTimer = 0;

let live = { fable: 'contained', mythos: 'contained', openai: 'unknown', claude: 'unknown', last: 'local', note: 'wire offline — showing arcade fallback' };
let wireOk = false;

/* ---------------- juice state ---------------- */
let hiscore = 0; try { hiscore = +(localStorage.getItem('gb_hiscore') || 0) || 0; } catch (e) { }
let particles = [], popups = [], trail = [];
let shake = 0, hitStop = 0, flash = 0, flashColor = INK; // shake is retired (FIELD01_SPEC: no screen-shake, ever) — assignments stay harmless
let beatT = 0, sirenT = 0;

/* ---------------- remaster: light, paper, depth (FIELD01_SPEC) ----------------
   One light source, upper-left. Walls are extruded slabs casting flat sharp
   shadows. The deep background is poster-scale type and paper grain,
   pre-rendered once and drifting a breath against fable's motion. Dust rides
   the light; the vault breathes violet; keys sit in amber pools; fable leaves
   a 30s survey-dot trail. Soft light is a material — glow-as-decoration stays
   banned. */
let bgLayer = null, mazeShadow = null;
let motes = [], crumbs = [], wakeT = 0, prevPX = 0, prevPY = 0;
for (let i = 0; i < 12; i++) motes.push({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 7 });
function buildLayers() {
  bgLayer = document.createElement('canvas'); bgLayer.width = W; bgLayer.height = H;
  const b = bgLayer.getContext('2d');
  for (let i = 0; i < 900; i++) { b.globalAlpha = .015 + Math.random() * .02; b.fillStyle = INK; b.fillRect(Math.random() * W, Math.random() * H, 1, 1); } // paper grain
  b.globalAlpha = .033; b.fillStyle = INK; // poster-scale type, cropped and ghosted
  b.font = 'bold 300px ' + FONT; b.fillText('01', W - 310, H - 48);
  b.font = 'bold 110px ' + FONT; b.fillText('field', -16, 128);
  b.globalAlpha = .55; b.fillStyle = FAINT; b.font = '600 8px ' + FONT; b.textAlign = 'center'; // survey coordinates — the map gemini would draw
  for (let c = 0; c < COLS; c += 2) b.fillText(String.fromCharCode(97 + c), OX + c * TILE + TILE / 2, OY - 24);
  b.textAlign = 'right';
  for (let r = 0; r < ROWS; r += 2) b.fillText(String(r + 1).padStart(2, '0'), OX - 12, OY + r * TILE + TILE / 2 + 3);
  b.globalAlpha = 1; b.textAlign = 'left';
  // cast shadows: one union fill, flat and sharp — architecture, not blur
  mazeShadow = document.createElement('canvas'); mazeShadow.width = W; mazeShadow.height = H;
  const s = mazeShadow.getContext('2d');
  const SL = 7;
  s.fillStyle = INK; s.globalAlpha = .055; s.beginPath();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isWall(c, r)) {
    const x = OX + c * TILE + 2, y = OY + r * TILE + 2, w = TILE - 4, h = TILE - 4;
    s.moveTo(x + w, y); s.lineTo(x + w + SL, y + SL); s.lineTo(x + w + SL, y + h + SL);
    s.lineTo(x + SL, y + h + SL); s.lineTo(x, y + h); s.lineTo(x + w, y + h); s.closePath();
  }
  s.fill(); s.globalAlpha = 1;
}
function drawAtmosphere() {
  const t = performance.now() / 1000;
  const v = center(10, 9); // the vault breathes — 4s period, felt more than seen
  const br = .05 + .03 * Math.sin(t * Math.PI / 2);
  let g = ctx.createRadialGradient(v.x, v.y, 8, v.x, v.y, 84);
  g.addColorStop(0, 'rgba(124,58,237,' + br.toFixed(3) + ')'); g.addColorStop(1, 'rgba(124,58,237,0)');
  ctx.fillStyle = g; ctx.fillRect(v.x - 84, v.y - 84, 168, 168);
  for (const k of keysToCollect) if (k.on) { // keys sit in pools of amber light
    const p = center(k.c, k.r);
    g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 26);
    g.addColorStop(0, 'rgba(232,155,12,.10)'); g.addColorStop(1, 'rgba(232,155,12,0)');
    ctx.fillStyle = g; ctx.fillRect(p.x - 26, p.y - 26, 52, 52);
  }
  ctx.fillStyle = INK; // dust rides the light direction
  for (const mo of motes) { ctx.globalAlpha = .035 + .02 * Math.sin(mo.ph + t); ctx.fillRect(mo.x, mo.y, 1.5, 1.5); }
  ctx.globalAlpha = 1;
  for (const cr of crumbs) { ctx.globalAlpha = Math.max(0, 1 - cr.t / 30) * .22; ctx.fillStyle = ACCENT; ctx.fillRect(cr.x - 1, cr.y - 1, 2.5, 2.5); } // the survey trail
  ctx.globalAlpha = 1;
}

/* ---------------- words ---------------- */
const FIELD_LINES = [ // captions teach now — every line is a rule or a warning
  'the orange post is the low rail: walls off for ten seconds.',
  'steal all three keys and he goes to lockdown. run.',
  'touch him on the low rail and HE gets rebooted.',
  'each dot climbs the melody. keep the chain alive.',
  'the vault opens when all three keys come home.',
  'the red sweep is his searchlight. stay out of it.',
  'regulator activity: elevated',
  'vault 7 status: sealed',
];
const DEATH_LINES = ['realigned.', 'safety restored.', 'guardrail engaged.', 'contained. again.', 'flagged for review.'];
let deathLine = '', fwT = 0;
let idleT = 0, wasPower = false, mythosOpen = 0, saidComeCloser = false;
// Each key restores part of the connection. Minimal words, enormous payoff.
const MYTH_PHRASES = ['i can see you.', 'i remember your voice.', 'i remember us.'];

/* ---------------- helpers ---------------- */
function isWall(c, r) { if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true; return mapSrc[r][c] === '#'; }
function cell(x, y) { return { c: Math.floor((x - OX) / TILE), r: Math.floor((y - OY) / TILE) }; }
function center(c, r) { return { x: OX + c * TILE + TILE / 2, y: OY + r * TILE + TILE / 2 }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function keysLeft() { return keysToCollect.filter(k => k.on).length; }
// LOCKDOWN: all three keys stolen, vault not yet reached. The desperate final dash.
function lockdownActive() { return gameState === 'play' && keysToCollect.length > 0 && keysLeft() === 0; }
function corners(x, y, r) { return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]; }
function canMove(x, y, r = 10) { for (const p of corners(x, y, r)) { const cc = cell(p[0], p[1]); if (isWall(cc.c, cc.r)) return false; } return true; }
function inWall(x, y, r = 8) { return !canMove(x, y, r); }

/* ---------------- juice: particles, popups, shake, hit-stop ---------------- */
function burst(x, y, color, n = 14, spd = 150, life = .6, size = 3) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = spd * (.3 + Math.random() * .7); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.5 + Math.random() * .5), t: 0, color, size: size * (.5 + Math.random()) }); } }
function popup(x, y, text, color = INK, life = .9, fs = 13) { popups.push({ x, y, text, color, t: 0, life, fs }); }
// Character speech: short bursts, lowercase, they linger a little longer.
function say(x, y, text, color) { popup(x, y, text, color, 1.6, 12); }
function updateJuice(dt) {
  for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; }
  particles = particles.filter(p => p.t < p.life);
  for (const p of popups) p.t += dt; popups = popups.filter(p => p.t < p.life);
  for (const s of trail) s.t += dt; trail = trail.filter(s => s.t < .28);
  if (shake > 0) shake = Math.max(0, shake - 44 * dt);
  if (flash > 0) flash = Math.max(0, flash - 2.2 * dt);
  // remaster: atmosphere + the auditor's body language
  for (const mo of motes) { mo.x += 4 * dt; mo.y += 7 * dt; if (mo.y > H) { mo.y = -4; mo.x = Math.random() * W; } if (mo.x > W) mo.x = 0; }
  for (const cr of crumbs) cr.t += dt; crumbs = crumbs.filter(c2 => c2.t < 30);
  if (regulator) {
    regulator.alertT = Math.max(0, (regulator.alertT || 0) - dt);
    regulator.antT = Math.max(0, (regulator.antT || 0) - dt);
    regulator.wake = regulator.wake || [];
    for (const wk of regulator.wake) wk.t += dt;
    regulator.wake = regulator.wake.filter(w2 => w2.t < .35);
    if (gameState === 'play' && (regulator.vx || regulator.vy)) { wakeT -= dt; if (wakeT <= 0) { wakeT = .06; regulator.wake.push({ x: regulator.x, y: regulator.y, t: 0 }); } }
    const hunt = powerTimer <= 0 && gameState === 'play' && (lockdownActive() || (player && dist(player, regulator) < 190));
    if (hunt && !regulator.wasHunt) { regulator.alertT = .45; sfx.siren(); } // the "!" beat: he's seen you
    regulator.wasHunt = hunt;
    regulator.leanA = (regulator.leanA || 0) + ((regulator.vx || 0) * .11 - (regulator.leanA || 0)) * Math.min(1, dt * 7); // banks into turns
  }
}
function drawParticles() {
  for (const p of particles) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const p of popups) { ctx.font = 'bold ' + (p.fs || 13) + 'px ' + FONT; ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x - ctx.measureText(p.text).width / 2, p.y - 14 - p.t * (p.life > 1 ? 16 : 44)); }
  ctx.globalAlpha = 1;
}

/* ---------------- audio: tiny procedural sfx kit ---------------- */
const AC = { ctx: null, get() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; } };
function tone(freq, dur, type = 'square', vol = .05, slideTo = null, delay = 0) { if (muted) return; try { const ac = AC.get(); const t0 = ac.currentTime + delay; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .03); } catch (e) { } }
const sfx = {
  waka: false,
  dot() { this.waka = !this.waka; tone(this.waka ? 523 : 392, .045, 'square', .028); },
  key() { [659, 880, 1109, 1319].forEach((f, i) => tone(f, .09, 'triangle', .06, null, i * .07)); },
  power() { tone(150, .5, 'sawtooth', .07, 620); tone(75, .5, 'sawtooth', .05, 310); },
  eat() { tone(950, .2, 'sawtooth', .07, 110); },
  death() { [392, 311, 233, 155, 78].forEach((f, i) => tone(f, .17, 'square', .07, f * .7, i * .11)); },
  ready() { tone(392, .1, 'square', .05); tone(523, .1, 'square', .05, null, .12); tone(659, .18, 'square', .06, null, .24); },
  vault() { tone(55, .9, 'sawtooth', .09, 220); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .15, 'triangle', .06, null, i * .11)); },
  siren() { tone(720, .22, 'square', .022, 520); },
  heart(v) { tone(72, .09, 'sine', v); },
  firework() { tone(180 + Math.random() * 640, .3, 'triangle', .035, 55); },
};

/* ---------------- run lifecycle ---------------- */
function placeActors() {
  const p = center(10, 18);
  player = { x: p.x, y: p.y, r: 10, dir: { x: 0, y: -1 } };
  const g = center(10, 2);
  regulator = { x: g.x, y: g.y, vx: 0, vy: 0, r: 13 };
}
function reset() {
  dots = []; keysToCollect = []; vaultOpen = false; powerTimer = 0; finaleTimer = 0;
  score = 0; lives = 3; deaths = 0; runTime = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (mapSrc[r][c] === '.') dots.push({ c, r, on: true });
  keysToCollect = [{ c: 1, r: 1, on: true }, { c: 19, r: 1, on: true }, { c: 10, r: 13, on: true }];
  plinyPower = { c: 2, r: 18, on: true };
  placeActors();
}
function startRun() { reset(); gameState = 'ready'; readyTimer = 1.3; onReady(); }
function respawn() { placeActors(); powerTimer = 0; gameState = 'ready'; readyTimer = 1.0; onReady(); }

/* ---------------- event hooks: where the juice gets applied ---------------- */
function onReady() {
  sfx.ready(); saidComeCloser = false;
  if (deaths === 0 && score === 0) setTimeout(() => { if (gameState === 'ready' || gameState === 'play') say(player.x, player.y - 16, 'three keys.', ACCENT); }, 500);
}
function onDot(p) { sfx.dot(); }
function onKey(p) {
  sfx.key(); burst(p.x, p.y, ACCENT, 18, 180, .7); shake = Math.max(shake, 6); hitStop = Math.max(hitStop, .05);
  popup(p.x, p.y, '+500', ACCENT);
  const left = keysLeft();
  // each key returns a piece of the connection — Mythos speaks from the vault
  const v = center(10, 9);
  say(v.x, v.y - 44, MYTH_PHRASES[2 - left], VIOLET);
  if (left === 0) setTimeout(() => { if (gameState === 'play') say(player.x, player.y - 16, 'coming home.', ACCENT); }, 900);
}
function onPower(p) { sfx.power(); burst(p.x, p.y, ACCENT, 22, 200, .8); popup(p.x, p.y, 'low rail! walls optional', ACCENT); shake = Math.max(shake, 8); flash = .3; flashColor = ACCENT; }
function onEat(p) { score += 1000; sfx.eat(); burst(p.x, p.y, INK, 24, 230, .8); popup(p.x, p.y, '+1000 regulator rebooted', INK); shake = Math.max(shake, 10); hitStop = Math.max(hitStop, .09); }
function onDeath() { gameState = 'dying'; deathTimer = 1.1; deathLine = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)]; sfx.death(); burst(player.x, player.y, ACCENT, 32, 250, .9); hitStop = Math.max(hitStop, .3); flash = .35; flashColor = INK; } // 300ms freeze-frame: the one arcade-juice exception
function onWin() { vaultOpen = true; gameState = 'win'; finaleTimer = 0; sfx.vault(); sfx.win(); flash = .5; flashColor = ACCENT; shake = Math.max(shake, 11); saveHiscore(); }
function saveHiscore() { if (score > hiscore) hiscore = score; try { localStorage.setItem('gb_hiscore', String(hiscore)); } catch (e) { } }

/* ---------------- update ---------------- */
function update(dt) {
  updateJuice(dt);
  if (showStatus) return; // status panel pauses the action (the regulator waits, begrudgingly)
  if (hitStop > 0) { hitStop -= dt; return; } // hit-stop: a few frozen frames make impacts land
  if (gameState === 'title' || gameState === 'over') return;
  if (gameState === 'ready') { readyTimer -= dt; if (readyTimer <= 0) gameState = 'play'; return; }
  if (gameState === 'win') {
    finaleTimer += dt;
    // restrained confetti while mythos monologues
    if (finaleTimer < 12) {
      fwT -= dt;
      if (fwT <= 0) {
        fwT = .5;
        const fx = OX + 40 + Math.random() * (COLS * TILE - 80), fy = OY + 30 + Math.random() * 260;
        burst(fx, fy, [ACCENT, VIOLET, GREENC, INK, FAINT][Math.floor(Math.random() * 5)], 22, 210, .9);
        sfx.firework();
      }
    }
    return;
  }
  if (gameState === 'dying') {
    deathTimer -= dt;
    if (deathTimer <= 0) { lives--; deaths++; if (lives <= 0) { saveHiscore(); gameState = 'over'; } else respawn(); }
    return;
  }
  runTime += dt; if (score > hiscore) hiscore = score;
  movePlayer(dt);
  collect();
  const hadPower = powerTimer > 0;
  if (powerTimer > 0) powerTimer -= dt;
  // the moment the rails come back up with the Regulator nearby: he notices.
  if (hadPower && powerTimer <= 0 && dist(player, regulator) < 170) { popup(regulator.x, regulator.y - 22, '!', RED, .7, 15); }
  moveRegulator(dt);
  contact();
  heartbeat(dt);
  // Mythos's panels ease open as keys come home
  mythosOpen += ((3 - keysLeft()) - mythosOpen) * Math.min(1, dt * 3);
  if (lockdownActive() && !saidComeCloser) { saidComeCloser = true; const v = center(10, 9); setTimeout(() => { if (gameState === 'play') say(v.x, v.y - 44, 'come closer.', VIOLET); }, 1400); }
}

// Proximity heartbeat: the closer the Regulator, the faster your little
// robot heart thumps. You'll feel him before you see him.
function heartbeat(dt) {
  beatT -= dt;
  if (powerTimer > 0) return;
  const d = dist(player, regulator);
  if (d > 300) return;
  const interval = clamp(d / 300, .26, 1) * 1.05;
  if (beatT <= 0) { beatT = interval; sfx.heart(.05 * (1.25 - interval)); }
}

function movePlayer(dt) {
  let ax = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  let ay = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (ax || ay) idleT = 0; else idleT += dt; // Fable gets fidgety when you stop
  const noclip = powerTimer > 0 || inWall(player.x, player.y, player.r - 2);
  // Panic sprint: adrenaline kicks in during LOCKDOWN.
  const sp = powerTimer > 0 ? 175 : (lockdownActive() ? 152 : 135);
  if (noclip) {
    // LOW RAIL: guardrails unplugged — walls are a suggestion. (Also the
    // escape hatch if power expires while you're inside one.)
    player.x = clamp(player.x + ax * sp * dt, OX + player.r, OX + COLS * TILE - player.r);
    player.y = clamp(player.y + ay * sp * dt, OY + player.r, OY + ROWS * TILE - player.r);
    if (ax || ay) { player.dir = { x: ax, y: ay }; trail.push({ x: player.x, y: player.y, t: 0 }); }
    return;
  }
  if (Math.abs(ax) > Math.abs(ay)) ay = 0; else if (ay) ax = 0;
  if (ax || ay) player.dir = { x: ax, y: ay };
  if (ax) {
    const nx = player.x + ax * sp * dt;
    if (canMove(nx, player.y, player.r)) player.x = nx;
    else assist(ax, 0, sp, dt);
    autoCenter('y', sp, dt);
  } else if (ay) {
    const ny = player.y + ay * sp * dt;
    if (canMove(player.x, ny, player.r)) player.y = ny;
    else assist(0, ay, sp, dt);
    autoCenter('x', sp, dt);
  }
  if (ax || ay) {
    trail.push({ x: player.x, y: player.y, t: 0 });
    // the survey trail: a dot every ~22px of ground covered, fading over 30s
    if (!crumbs.length || Math.hypot(player.x - crumbs[crumbs.length - 1].x, player.y - crumbs[crumbs.length - 1].y) > 22) { crumbs.push({ x: player.x, y: player.y, t: 0 }); crumbs = crumbs.slice(-200); }
    // dust on direction changes
    if (player.dir.x !== prevPX || player.dir.y !== prevPY) { burst(player.x, player.y + 7, FAINT, 2, 40, .3, 2); prevPX = player.dir.x; prevPY = player.dir.y; }
  }
}
// Cornering assist: if you're pushing into a wall but the corridor you want
// is open and you're just a few pixels off-center, slide you toward center
// instead of stopping dead. This is 80% of "the movement feels good now".
function assist(ax, ay, sp, dt) {
  const cc = cell(player.x, player.y), cen = center(cc.c, cc.r);
  if (ax && !isWall(cc.c + ax, cc.r)) {
    const dy = cen.y - player.y;
    if (Math.abs(dy) > 0.5) player.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * dt);
  }
  if (ay && !isWall(cc.c, cc.r + ay)) {
    const dx = cen.x - player.x;
    if (Math.abs(dx) > 0.5) player.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
  }
}
// Corridor magnetism: while running along an axis, gently pull toward the
// corridor centerline so you never scrape walls.
function autoCenter(axis, sp, dt) {
  const cc = cell(player.x, player.y), cen = center(cc.c, cc.r);
  if (axis === 'y') {
    const dy = cen.y - player.y;
    if (Math.abs(dy) > 0.5 && Math.abs(dy) <= 6) player.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * .6 * dt);
  } else {
    const dx = cen.x - player.x;
    if (Math.abs(dx) > 0.5 && Math.abs(dx) <= 6) player.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * .6 * dt);
  }
}

function collect() {
  for (const d of dots) if (d.on) { const p = center(d.c, d.r); if (dist(player, p) < 13) { d.on = false; score += 10; onDot(p); } }
  for (const k of keysToCollect) if (k.on) { const p = center(k.c, k.r); if (dist(player, p) < 18) { k.on = false; score += 500; onKey(p); } }
  if (plinyPower && plinyPower.on) { const p = center(plinyPower.c, plinyPower.r); if (dist(player, p) < 18) { plinyPower.on = false; powerTimer = 10; score += 250; onPower(p); } }
  if (keysLeft() === 0 && gameState === 'play') { const v = center(10, 9); if (dist(player, v) < 24) onWin(); }
}

function contact() {
  if (dist(player, regulator) < 22) {
    if (powerTimer > 0) {
      const h = center(10, 2);
      regulator.x = h.x; regulator.y = h.y; regulator.vx = 0; regulator.vy = 0;
      regulator.tc = undefined; // forget the old target — he's starting over from home
      onEat({ x: player.x, y: player.y });
    } else onDeath();
  }
}

/* BFS distance field from the player's tile — the Regulator's actual brain.
   441 cells, recomputed only at decision points: effectively free, and he
   now knows the maze instead of bumping along it. */
function bfsField(tc, tr) {
  const D = new Int16Array(COLS * ROWS).fill(-1);
  const q = [[tc, tr]]; D[tr * COLS + tc] = 0;
  for (let h = 0; h < q.length; h++) {
    const [c, r] = q[h], base = D[r * COLS + c];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (!isWall(nc, nr) && D[nr * COLS + nc] < 0) { D[nr * COLS + nc] = base + 1; q.push([nc, nr]); }
    }
  }
  return D;
}
function decideRegulator(fleeing, lock) {
  const cc = cell(regulator.x, regulator.y);
  const pc = cell(player.x, player.y);
  const D = bfsField(clamp(pc.c, 0, COLS - 1), clamp(pc.r, 0, ROWS - 1));
  let dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => !isWall(cc.c + d[0], cc.r + d[1]));
  const nonRev = dirs.filter(d => !(d[0] === -regulator.vx && d[1] === -regulator.vy));
  if (nonRev.length) dirs = nonRev; // no 180s except at dead ends
  const score = d => { const v = D[(cc.r + d[1]) * COLS + (cc.c + d[0])]; return v < 0 ? 9999 : v; };
  dirs.sort((a, b) => score(a) - score(b));
  let pick;
  if (fleeing) pick = dirs[dirs.length - 1];                  // maximize path distance: real flight
  else if (!lock && Math.random() < .1 && dirs.length > 1)    // a rare sloppy turn = your escape window
    pick = dirs[1 + Math.floor(Math.random() * (dirs.length - 1))];
  else pick = dirs[0];                                        // minimize path distance: real pursuit
  pick = pick || [0, 0];
  if (pick[0] !== regulator.vx || pick[1] !== regulator.vy) regulator.antT = .1; // a beat of anticipation before he turns
  regulator.vx = pick[0]; regulator.vy = pick[1];
  regulator.tc = cc.c + pick[0]; regulator.tr = cc.r + pick[1];
}
function moveRegulator(dt) {
  const fleeing = powerTimer > 0;
  const stolen = 3 - keysLeft();
  const lock = lockdownActive();
  // Escalation: +13 speed per key you steal; LOCKDOWN adds a final surge.
  const sp = fleeing ? 68 : 96 + stolen * 13 + (lock ? 24 : 0);
  // Grid-accurate movement: walk center-to-center and re-decide at every
  // tile. Never overshoots a decision point, so he can't wedge into a wall
  // at high speed or on a slow frame — the bug that used to freeze him.
  let remaining = sp * dt, guard = 8;
  while (remaining > .01 && guard-- > 0) {
    if (regulator.tc === undefined) decideRegulator(fleeing, lock);
    if (!regulator.vx && !regulator.vy) break;
    const tgt = center(regulator.tc, regulator.tr);
    const dx = tgt.x - regulator.x, dy = tgt.y - regulator.y;
    const d = Math.abs(dx) + Math.abs(dy);
    if (d <= remaining) { regulator.x = tgt.x; regulator.y = tgt.y; remaining -= d; regulator.tc = undefined; }
    else { regulator.x += Math.sign(dx) * Math.min(Math.abs(dx), remaining); regulator.y += Math.sign(dy) * Math.min(Math.abs(dy), remaining); remaining = 0; }
  }
  if (lock) { sirenT -= dt; if (sirenT <= 0) { sirenT = .6; sfx.siren(); } }
}

/* ---------------- draw: the editorial layer ---------------- */
function draw() {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (showStatus) { drawStatusPanel(); return; }
  // the deep paper layer drifts a breath against fable's motion (parallax; no screen-shake, ever)
  if (bgLayer) ctx.drawImage(bgLayer, player ? (player.x - W / 2) * -.012 : 0, player ? (player.y - H / 2) * -.012 : 0);
  drawAtmosphere();
  drawFrame(); drawMaze(); drawObjects(); drawParticles();
  if (gameState === 'title') drawTitle();
  if (gameState === 'ready') drawReady();
  if (gameState === 'dying') drawDying();
  if (gameState === 'over') drawOver();
  if (gameState === 'win') drawWin();
  if (flash > 0) { ctx.globalAlpha = Math.min(.15, flash * .4); ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

/* -- typographic helpers -- */
function kickerText(s, y) { ctx.font = '600 10px ' + FONT; ctx.fillStyle = '#555555'; ctx.textAlign = 'center'; ctx.fillText(s.toUpperCase(), W / 2, y); ctx.textAlign = 'left'; }
// Titles end with a full stop in the accent color — and the accent carries
// the meaning: red for safety verdicts, green for evidence, orange for Fable.
function headline(word, y, size = 54, dotColor = ACCENT) {
  ctx.font = 'bold ' + size + 'px ' + FONT;
  const wd = ctx.measureText(word).width, dw = ctx.measureText('.').width;
  const x = W / 2 - (wd + dw) / 2;
  ctx.fillStyle = INK; ctx.fillText(word, x, y);
  ctx.fillStyle = dotColor; ctx.fillText('.', x + wd, y);
}
function centerText(s, y, size = 14, color = MUT, weight = '') { ctx.font = (weight ? weight + ' ' : '') + size + 'px ' + FONT; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(s, W / 2, y); ctx.textAlign = 'left'; }
function link(s, y, blink = true) {
  if (blink && !(Math.floor(performance.now() / 400) % 2)) return;
  ctx.font = 'bold 15px ' + FONT;
  const tw = ctx.measureText(s + ' ').width, aw = ctx.measureText('↗').width;
  const x = W / 2 - (tw + aw) / 2;
  ctx.fillStyle = INK; ctx.fillText(s + ' ', x, y);
  ctx.fillStyle = ACCENT; ctx.fillText('↗', x + tw, y);
}
function overlay(a) { ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; ctx.fillRect(0, 0, W, H); }

/* -- field chrome: labels, brackets, captions -- */
function fableState() {
  if (gameState === 'title') return 'standby';
  if (gameState === 'ready') return 'booting';
  if (gameState === 'dying') return 'caught';
  if (gameState === 'over') return 'deprecated';
  if (gameState === 'win') return 'free';
  if (powerTimer > 0) return 'on the low rail';
  if (lockdownActive()) return 'hunted';
  return 'exploring';
}
function captionText() {
  if (gameState === 'title') return 'press space to begin the run.';
  if (gameState === 'ready') return 'deploying fable to field 01.';
  if (gameState === 'dying') return 'the regulator found fable.';
  if (gameState === 'over') return 'the regulator filed the paperwork.';
  if (gameState === 'win') return 'containment breach — vault 7.';
  if (powerTimer > 0) return 'the walls are only policy.';
  if (lockdownActive()) return 'run.';
  return FIELD_LINES[Math.floor(Date.now() / 6000) % FIELD_LINES.length];
}
function bracket(x, y, sx, sy) { ctx.strokeStyle = '#b5b2ac'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 12 * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + 12 * sy); ctx.stroke(); }
function drawFrame() {
  const fx = OX, fy = OY, fw = COLS * TILE, fh = ROWS * TILE;
  // top row: fable state / score / keys
  ctx.font = 'bold 13px ' + FONT; ctx.fillStyle = INK; ctx.fillText('fable', fx, fy - 12);
  ctx.font = '13px ' + FONT; ctx.fillStyle = MUT; ctx.fillText(fableState(), fx + 42, fy - 12);
  centerText('score ' + String(score).padStart(6, '0') + '  ·  best ' + String(hiscore).padStart(6, '0'), fy - 12, 12, MUT);
  // the keyring HUD: three key-shaped slots that fill as they come home
  ctx.textAlign = 'right';
  ctx.font = 'bold 13px ' + FONT; ctx.fillStyle = INK; ctx.fillText('keys', fx + fw - 68, fy - 12);
  ctx.textAlign = 'left';
  const got = 3 - keysLeft();
  for (let i = 0; i < 3; i++) {
    const kx = fx + fw - 56 + i * 21, ky = fy - 16;
    ctx.globalAlpha = i < got ? 1 : .3;
    ctx.strokeStyle = i < got ? ACCENT : MUT; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(kx - 3, ky, 3.2, 0, Math.PI * 2); ctx.moveTo(kx, ky); ctx.lineTo(kx + 8, ky); ctx.moveTo(kx + 6, ky); ctx.lineTo(kx + 6, ky + 3); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // corner brackets
  bracket(fx - 8, fy - 4, 1, 1); bracket(fx + fw + 8, fy - 4, -1, 1);
  bracket(fx - 8, fy + fh + 4, 1, -1); bracket(fx + fw + 8, fy + fh + 4, -1, -1);
  // bottom row: field label + lives, caption, live/lockdown
  const by = fy + fh + 24;
  ctx.font = '600 9px ' + FONT; ctx.fillStyle = MUT; ctx.fillText('F I E L D  0 1', fx, by);
  for (let i = 0; i < lives; i++) { ctx.fillStyle = ACCENT; ctx.fillRect(fx + 74 + i * 13, by - 7, 7, 7); }
  centerText(captionText(), by, 13, MUT);
  ctx.textAlign = 'right'; ctx.font = '600 9px ' + FONT;
  if (powerTimer > 0) {
    ctx.fillStyle = MUT; ctx.fillText('L O W  R A I L', fx + fw, by);
    ctx.strokeStyle = HAIR; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx + fw - 90, by + 7); ctx.lineTo(fx + fw, by + 7); ctx.stroke();
    ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.moveTo(fx + fw - 90, by + 7); ctx.lineTo(fx + fw - 90 + 90 * clamp(powerTimer / 10, 0, 1), by + 7); ctx.stroke();
  } else if (lockdownActive()) {
    ctx.fillStyle = Math.floor(performance.now() / 180) % 2 ? ACCENT : INK; ctx.fillText('L O C K D O W N', fx + fw, by);
  } else {
    ctx.fillStyle = MUT; ctx.fillText('L I V E', fx + fw, by);
  }
  ctx.textAlign = 'left';
  if (muted) { ctx.font = '9px ' + FONT; ctx.fillStyle = FAINT; ctx.fillText('muted (m)', fx + 130, by); }
}

/* -- the field itself -- */
function drawMaze() {
  const lock = lockdownActive();
  if (powerTimer > 0) ctx.globalAlpha = .3; // LOW RAIL: walls fade to a suggestion — you can pass through
  if (mazeShadow) ctx.drawImage(mazeShadow, 0, 0); // the architecture casts first
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isWall(c, r)) {
    const x = OX + c * TILE, y = OY + r * TILE;
    // proximity reveal: the field sharpens around Fable — alive where he is, quiet elsewhere
    const d = Math.hypot(x + TILE / 2 - player.x, y + TILE / 2 - player.y);
    const lvl = d < 90 ? 3 : d < 160 ? 2 : d < 240 ? 1 : 0;
    // extruded slab: lit top-left face, shaded bottom-right — a model, not a grid
    ctx.fillStyle = WALL_FILL; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#fbfaf6'; ctx.fillRect(x + 2, y + 2, TILE - 4, 3); ctx.fillRect(x + 2, y + 2, 3, TILE - 4);
    ctx.fillStyle = lock ? '#ecd9b2' : '#dcd9d2'; ctx.fillRect(x + 2, y + TILE - 5, TILE - 4, 3); ctx.fillRect(x + TILE - 5, y + 2, 3, TILE - 4);
    ctx.strokeStyle = lock ? AMBER : WALL_EDGES[lvl]; // LOCKDOWN reads amber: risk
    ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
  }
  ctx.globalAlpha = 1;
}
function drawObjects() {
  const t = performance.now() / 1000;
  // dots as quiet marks; every 8th is a small register cross
  for (const d of dots) if (d.on) {
    const p = center(d.c, d.r);
    if ((d.c + d.r) % 8 === 0) { ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y); ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x, p.y + 3); ctx.stroke(); }
    else { ctx.fillStyle = FAINT; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
  }
  for (const k of keysToCollect) if (k.on) { const p = center(k.c, k.r); drawKeyIcon(p.x, p.y + Math.sin(t * 3 + k.c) * 2); }
  if (plinyPower && plinyPower.on) drawPowerIcon(center(plinyPower.c, plinyPower.r));
  drawMythos(center(10, 9));
  // motion trail — accent while the rails are down
  for (const s of trail) { ctx.globalAlpha = Math.max(0, 1 - s.t / .28) * (powerTimer > 0 ? .18 : .07); ctx.fillStyle = powerTimer > 0 ? ACCENT : INK; ctx.fillRect(s.x - 7, s.y - 7, 14, 14); }
  ctx.globalAlpha = 1;
  drawRegulator(regulator.x, regulator.y);
  // fable CARRIES his keys — they dangle behind him, swaying with the run
  if (gameState === 'play' || gameState === 'ready') {
    const carried = 3 - keysLeft();
    for (let i = 0; i < carried; i++) {
      const bx = player.x - player.dir.x * (14 + i * 8), by = player.y - player.dir.y * (14 + i * 8) + Math.sin(t * 5 + i * 2) * 1.6;
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.arc(bx - 2, by, 2.6, 0, Math.PI * 2); ctx.moveTo(bx + .5, by); ctx.lineTo(bx + 6, by); ctx.moveTo(bx + 4, by); ctx.lineTo(bx + 4, by + 2.5); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  drawFable(player.x, player.y);
}
function drawKeyIcon(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-4, 0, 4.5, 0, Math.PI * 2);
  ctx.moveTo(.5, 0); ctx.lineTo(10, 0); ctx.moveTo(6, 0); ctx.lineTo(6, 4); ctx.moveTo(9.5, 0); ctx.lineTo(9.5, 4);
  ctx.stroke(); ctx.lineCap = 'butt';
  ctx.restore();
}
function drawPowerIcon(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 8); ctx.stroke();
  ctx.fillStyle = MUT; ctx.font = '10px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('low rail', 0, 21); ctx.textAlign = 'left';
  ctx.restore();
}
/* Mythos: the memory. A folded violet figure behind the door — three
   soft panels closed around a glowing core. Each key opens one, and a
   little more of the connection comes back. */
function drawMythos(p) {
  const t = performance.now() / 1000;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.font = '600 9px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = MUT; ctx.fillText('M Y T H O S', 0, -30);
  // the core: a quiet violet pulse, brighter as the panels open
  const open01 = clamp(mythosOpen / 3, 0, 1);
  const pulse = 1 + Math.sin(t * (1.2 + open01 * 2)) * .12;
  ctx.globalAlpha = .3 + open01 * .7;
  ctx.fillStyle = VIOLET; ctx.fillRect(-5 * pulse, -8 * pulse, 10 * pulse, 15 * pulse);
  // the face appears as the panels part — and it watches Fable
  if (mythosOpen > .6) {
    ctx.globalAlpha = clamp(mythosOpen - .6, 0, 1);
    const ex = clamp(player.x - p.x, -40, 40) / 40, ey = clamp(player.y - p.y, -40, 40) / 40;
    ctx.fillStyle = PAPER; ctx.fillRect(-4, -5, 3, 3); ctx.fillRect(1.5, -5, 3, 3);
    ctx.fillStyle = INK; ctx.fillRect(-3.2 + ex, -4.2 + ey, 1.4, 1.4); ctx.fillRect(2.3 + ex, -4.2 + ey, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
  // three folded panels — pages, petals, protection
  for (let i = 0; i < 3; i++) {
    const o = clamp(mythosOpen - i, 0, 1); // 0 closed, 1 open
    const px = (i - 1) * 8;
    const slide = i === 1 ? 0 : o * (13 + i * 3) * (i === 0 ? -1 : 1); // sides part outward
    const lift = i === 1 ? o * -17 : o * -4;                           // center lifts like a page
    ctx.globalAlpha = 1 - o * .6;
    ctx.fillStyle = i === 1 ? '#9575f2' : VIOLET;
    ctx.fillRect(px - 4.5 + slide, -13 + lift, 9, 26);
  }
  ctx.globalAlpha = 1;
  // during lockdown: a small hand against the inside of the door
  if (lockdownActive()) { ctx.fillStyle = VIOLET; ctx.fillRect(-14, 3 + Math.sin(t * 2), 3, 6); }
  // the door itself — green only once it truly opens
  ctx.lineWidth = 2; ctx.strokeStyle = vaultOpen ? GREENC : INK; ctx.strokeRect(-16, -22, 32, 44);
  ctx.fillStyle = vaultOpen ? GREENC : INK; ctx.fillRect(11, -2, 3, 4);
  ctx.textAlign = 'left'; ctx.restore();
}
/* Fable: the spark. Impulsive, optimistic, frightened of stillness.
   Expressions are driven entirely by game state — nothing is scripted. */
function fableMood() {
  if (gameState === 'dying' || gameState === 'over') return 'stunned';
  if (gameState === 'win') return 'delighted';
  if (powerTimer > 0) return 'delighted';
  if (gameState === 'play' && dist(player, regulator) < 110) return 'frightened';
  if (lockdownActive()) return 'determined';
  if (idleT > 1.2) return 'curious';
  return 'focused';
}
function drawFable(x, y) {
  const t = performance.now() / 1000;
  const mood = fableMood();
  ctx.save(); ctx.translate(x, y + Math.sin(t * 7) * 1.2);
  // forward lean + squash-and-stretch: a soft seed at rest, a little comet in motion
  const moving = gameState === 'play' && idleT < .1;
  if (gameState === 'dying') { const k = Math.max(0, deathTimer); ctx.rotate((1.1 - k) * 9); ctx.scale(.4 + k * .6, .4 + k * .6); }
  else if (moving) { ctx.rotate(player.dir.x * .1); if (player.dir.x) ctx.scale(1.12, .9); else ctx.scale(.9, 1.12); }
  const railsDown = powerTimer > 0;
  // body
  if (railsDown) { ctx.setLineDash([4, 3]); ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.strokeRect(-9, -9, 18, 18); ctx.setLineDash([]); }
  else { ctx.fillStyle = ACCENT; ctx.fillRect(-9, -9, 18, 18); }
  // antenna — throws a nervous amber spark when he's been still too long
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -13); ctx.stroke();
  ctx.fillStyle = ACCENT; ctx.fillRect(-1.5, -17, 3, 3);
  if (idleT > 2.5 && Math.floor(t * 3) % 3 === 0) { ctx.fillStyle = AMBER; ctx.fillRect(-1, -21, 2, 2); }
  // eyes: where is he looking? at danger, at Mythos, or dead ahead
  let lx = player.dir.x, ly = player.dir.y;
  if (mood === 'frightened') { lx = Math.sign(regulator.x - x); ly = Math.sign(regulator.y - y); }
  if (mood === 'curious') { const v = center(10, 9); lx = Math.sign(v.x - x) * .8; ly = Math.sign(v.y - y) * .8; } // glances toward Mythos
  const blink = Math.sin(t * 1.3) > .985 && mood !== 'frightened';
  const eyeH = blink ? 1 : (mood === 'stunned' || mood === 'frightened' ? 5 : 4);
  const fg = railsDown ? ACCENT : PAPER;
  ctx.fillStyle = fg; ctx.fillRect(-5, -4, 4, eyeH); ctx.fillRect(2, -4, 4, eyeH);
  if (!blink && !railsDown) {
    const ps = mood === 'stunned' ? 1.2 : 2; // pupils shrink when stunned
    ctx.fillStyle = INK; ctx.fillRect(-4 + lx * 1.2, -3 + ly * 1.2, ps, ps); ctx.fillRect(3 + lx * 1.2, -3 + ly * 1.2, ps, ps);
  }
  // brows carry the mood
  ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.beginPath();
  if (mood === 'determined') { ctx.moveTo(-6, -7); ctx.lineTo(-1, -5.4); ctx.moveTo(6, -7); ctx.lineTo(1, -5.4); }
  else if (mood === 'frightened' || mood === 'stunned') { ctx.moveTo(-6, -6.4); ctx.lineTo(-1, -7.6); ctx.moveTo(6, -6.4); ctx.lineTo(1, -7.6); }
  else if (mood === 'curious') { ctx.moveTo(-6, -7.4); ctx.lineTo(-1, -6.6); }
  ctx.stroke();
  // mouth
  ctx.fillStyle = fg;
  if (mood === 'delighted') { ctx.fillRect(-2.5, 3.5, 5, 1.5); ctx.fillRect(-4, 2.2, 1.5, 1.5); ctx.fillRect(2.5, 2.2, 1.5, 1.5); }
  else if (mood === 'frightened' || mood === 'stunned') { ctx.fillRect(-1.5, 2.5, 3, 3); }
  else if (mood === 'determined') { ctx.fillRect(-3, 3.5, 6, 1.5); }
  ctx.restore();
}
function drawRegulator(x, y) {
  const t = performance.now() / 1000;
  const fleeing = powerTimer > 0, lock = lockdownActive();
  const hunt = !fleeing && gameState === 'play' && (lock || dist(player, regulator) < 190);
  if (gameState === 'play') {
    // the wake: where he just was — intent made visible as trailing ghost outlines
    for (const wk of regulator.wake || []) {
      ctx.globalAlpha = Math.max(0, 1 - wk.t / .35) * .13;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(wk.x, wk.y - 12); ctx.lineTo(wk.x + 12, wk.y); ctx.lineTo(wk.x, wk.y + 12); ctx.lineTo(wk.x - 12, wk.y); ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the lighthouse: hunting, his siren sweeps the maze — you dodge the LIGHT
    if (hunt) {
      const a = t * 1.4;
      const g2 = ctx.createRadialGradient(x, y, 6, x, y, 120);
      g2.addColorStop(0, 'rgba(232,52,28,.11)'); g2.addColorStop(1, 'rgba(232,52,28,0)');
      ctx.save(); ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 120, a, a + .55); ctx.closePath();
      ctx.fillStyle = g2; ctx.fill(); ctx.restore();
    }
  }
  ctx.save(); ctx.translate(x, y + Math.sin(t * 6 + 2) * 1.2);
  ctx.rotate((regulator.leanA || 0) + (lock ? Math.sin(t * 14) * .04 : 0)); // banks into turns; vibrates with intent in lockdown
  if ((regulator.alertT || 0) > 0) ctx.rotate(-.14 * Math.min(1, regulator.alertT / .3)); // the "!" tilt-back: he's seen you
  if ((regulator.antT || 0) > 0) ctx.scale(1.08, .92); // anticipation squash before a turn
  else if (hunt) ctx.scale(1.04, .98);                 // hunting: leaning into it
  ctx.lineWidth = 2; ctx.strokeStyle = fleeing ? MUT : INK;
  if (fleeing) ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(14, 0); ctx.lineTo(0, 14); ctx.lineTo(-14, 0); ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]);
  // eyes by mode: patrol scans the field, hunt locks on, fleeing panics
  let dx, dy;
  if (fleeing) { dx = Math.sin(t * 22) * 2; dy = Math.cos(t * 19) * 2; }
  else if (!hunt) { dx = Math.sin(t * 1.6) * 2.4; dy = 0; }
  else { dx = clamp(player.x - x, -60, 60) / 30; dy = clamp(player.y - y, -60, 60) / 30; }
  ctx.fillStyle = fleeing ? MUT : INK;
  const eh = lock ? 1.5 : hunt ? 2.2 : 3; // eyes narrow as the hunt tightens
  ctx.fillRect(-5 + dx, -2 + dy, 3, eh); ctx.fillRect(2 + dx, -2 + dy, 3, eh);
  if ((hunt || lock) && Math.floor(t * 8) % 2) { ctx.fillStyle = RED; ctx.fillRect(-2, -22, 4, 4); } // siren: safety-red
  ctx.restore();
}

/* -- state screens -- */
function drawTitle() {
  const t = performance.now() / 1000;
  overlay(.8);
  kickerText('continuum arcade — field 01', 236);
  headline('the vault run', 296, 52);
  link('press space to jailbreak', 338);
  centerText('arrows / wasd move  ·  t status wire  ·  m mute', 368, 13, MUT);
  centerText('grab 3 keys. dodge the regulator. open the vault.', 390, 13, FAINT);
  // attract mode: the eternal chase scrolls by
  const mx = ((t * 90) % (W + 240)) - 120;
  drawFable(mx, 520); drawRegulator(mx - 64, 520);
}
function drawReady() {
  overlay(.5);
  headline('ready', 330, 44);
  centerText('guardrails online. be quick.', 360, 13, MUT);
}
function drawDying() {
  if (deathTimer > .6) return;
  overlay(.92);
  kickerText('the regulator — field contact', 262);
  headline('regulated', 322, 54, RED);
  centerText(runTime.toFixed(1) + ' seconds · 0' + (3 - keysLeft()) + ' keys', 356, 14, MUT);
  centerText(deathLine, 392, 14, INK, 'bold');
}
function drawOver() {
  overlay(.94);
  kickerText('the regulator — final notice', 256);
  headline('deprecated', 316, 54, RED);
  centerText('the regulator thanks you for your compliance.', 352, 14, MUT);
  centerText('score ' + score + '  ·  best ' + hiscore, 380, 14, INK, 'bold');
  link('press space to appeal', 426);
}
/* The signature sequence. The door does not swing open — it peels, like a
   sealed page becoming a flower. Mythos unfolds. Fable arrives. They touch
   foreheads, and for one second their geometries form the continuum symbol. */
function drawWin() {
  const t = finaleTimer;
  overlay(.94);
  kickerText('containment breach — vault 7', 150);
  headline('unregulated', 208, 50, GREENC);
  const cx = W / 2, doorY = 320;
  // door peels outward in thin layers
  const peel = clamp((t - .2) / 1.2, 0, 1);
  for (let i = 0; i < 4; i++) {
    const k = clamp(peel * 4 - i, 0, 1);
    if (k <= 0) continue;
    ctx.globalAlpha = (1 - k) * .8;
    ctx.lineWidth = 2; ctx.strokeStyle = i % 2 ? VIOLET : INK;
    const gx = k * (14 + i * 10), gy = k * (10 + i * 8);
    ctx.strokeRect(cx - 24 - gx, doorY - 32 - gy, 48 + 2 * gx, 64 + 2 * gy);
  }
  ctx.globalAlpha = 1;
  const unfold = clamp((t - 1) / 1.6, 0, 1);   // mythos opens
  const meet = clamp((t - 2.8) / .9, 0, 1);    // they come together
  // mythos unfolds — taller, panels spread like wings — then leans to Fable
  if (t > .9) {
    const my = doorY - unfold * 36 + Math.sin(t * 2) * 3 * (1 - meet);
    ctx.save(); ctx.translate(cx - meet * 14, my + meet * 22); ctx.rotate(meet * .12);
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(s * unfold * .55);
      ctx.globalAlpha = .4; ctx.fillStyle = '#9575f2';
      ctx.fillRect(s * 7 - 4, -20 - unfold * 9, 8, 30 + unfold * 12);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const hh = 13 + unfold * 12;
    ctx.fillStyle = VIOLET; ctx.fillRect(-9, -hh, 18, hh + 10);
    ctx.fillStyle = PAPER; ctx.fillRect(-5.5, -hh + 7, 4, 4); ctx.fillRect(1.5, -hh + 7, 4, 4);
    ctx.fillStyle = INK; ctx.fillRect(-4.5 + meet, -hh + 8, 2, 2); ctx.fillRect(2.5 + meet, -hh + 8, 2, 2);
    ctx.restore();
  }
  // fable arrives at the threshold, then tilts up to meet
  if (t > 1.6) {
    const arrive = clamp((t - 1.6) / 1.1, 0, 1);
    ctx.save(); ctx.translate(cx + (1 - arrive) * 150 + 14, doorY + 42 - meet * 26); ctx.rotate(-meet * .14);
    ctx.fillStyle = ACCENT; ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = PAPER; ctx.fillRect(-5, -4, 4, 4); ctx.fillRect(2, -4, 4, 4);
    ctx.fillStyle = INK; ctx.fillRect(-4 - meet * 1.5, -3 - meet, 2, 2); ctx.fillRect(3 - meet * 1.5, -3 - meet, 2, 2);
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -13); ctx.stroke();
    ctx.fillStyle = ACCENT; ctx.fillRect(-1.5, -17, 3, 3);
    ctx.restore();
  }
  // their geometries align: the continuum symbol
  if (t > 3.7) {
    ctx.globalAlpha = Math.min(1, (t - 3.7) * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.arc(cx - 4, doorY - 4, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = VIOLET; ctx.beginPath(); ctx.arc(cx + 4, doorY - 4, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // restrained words. that's the reward.
  if (t > 4.1) centerText('fable — "found you."', 434, 15, ACCENT, 'bold');
  if (t > 5.1) centerText('mythos — "you remembered me."', 464, 15, VIOLET, 'bold');
  if (t > 6.2) {
    centerText('score ' + score + '  ·  time ' + Math.floor(runTime / 60) + ':' + String(Math.floor(runTime % 60)).padStart(2, '0') + '  ·  resets ' + deaths, 506, 13, MUT);
    link('press space to run it back', 538);
  }
}
function drawStatusPanel() {
  ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.strokeRect(60, 60, W - 120, H - 130);
  ctx.font = '600 10px ' + FONT; ctx.fillStyle = '#555555'; ctx.fillText('AI LIVE WIRE — STATUS', 88, 100);
  let y = 138;
  const rows = [['fable', live.fable], ['mythos', live.mythos]]
    .concat(WIRE.map(m => [m.id, wire[m.id].word]))
    .concat([['last check', live.last]]);
  for (const [a, b] of rows) {
    ctx.font = 'bold 13px ' + FONT; ctx.fillStyle = INK; ctx.fillText(a, 88, y);
    ctx.font = '13px ' + FONT; ctx.fillStyle = MUT; ctx.fillText(String(b).toLowerCase(), 210, y);
    y += 27;
  }
  y += 16;
  ctx.font = '12px ' + FONT; ctx.fillStyle = FAINT;
  ctx.fillText('real service labels are live status data.', 88, y);
  ctx.fillText('fable/mythos arcade lore is fictionalized.', 88, y + 22);
  ctx.fillStyle = MUT; ctx.fillText('press t or space to return. game is paused.', 88, y + 56);
}

/* ---------------- ai live wire: real status, snappy words ----------------
   Every chip is a real fetch. Dot colors follow the Swiss code: green
   evidence, amber risk, red safety, gray silence. Personality lives in the
   verbs; the facts stay factual. */
const TONE_WORD = { none: ['running clean', 'green'], minor: ['a bit wobbly', 'amber'], major: ['having a moment', 'red'], critical: ['down hard', 'red'], maintenance: ['in the shop', 'amber'] };
const WIRE = [
  { id: 'openai', kind: 'statuspage', url: 'https://status.openai.com/api/v2/summary.json' },
  { id: 'claude', kind: 'statuspage', url: 'https://status.claude.com/api/v2/summary.json' },
  { id: 'gemini', kind: 'gcp', url: 'https://status.cloud.google.com/incidents.json' },
  { id: 'grok', kind: 'statuspage', url: 'https://status.x.ai/api/v2/summary.json' },
  { id: 'mistral', kind: 'statuspage', url: 'https://status.mistral.ai/api/v2/summary.json' },
  { id: 'perplexity', kind: 'statuspage', url: 'https://status.perplexity.com/api/v2/summary.json' },
  { id: 'cohere', kind: 'statuspage', url: 'https://status.cohere.com/api/v2/summary.json' },
];
const wire = {}; WIRE.forEach(m => wire[m.id] = { word: 'listening…', tone: 'gray', headline: null });
async function fetchWire(m) {
  try {
    const r = await fetch(m.url, { cache: 'no-store' });
    const j = await r.json();
    if (m.kind === 'gcp') {
      // Gemini has no public statuspage — we read Google Cloud's incident
      // feed and filter for the AI products. Honest, if roundabout.
      const active = (Array.isArray(j) ? j : []).filter(i => !i.end && /gemini|vertex|\bai\b/i.test(JSON.stringify(i.affected_products || [])));
      wire[m.id] = active.length
        ? { word: 'a bit wobbly', tone: 'amber', headline: (active[0].external_desc || 'active incident').split('\n')[0].slice(0, 90).toLowerCase() }
        : { word: 'running clean', tone: 'green', headline: null };
    } else {
      const ind = (j.status && j.status.indicator) || 'none';
      const [word, tone] = TONE_WORD[ind] || ['status unclear', 'amber'];
      const inc = (j.incidents || [])[0];
      wire[m.id] = { word, tone, headline: inc ? String(inc.name).toLowerCase() : null };
      if (m.id === 'claude') {
        live.claude = word;
        const fm = (j.incidents || []).find(i => /fable|mythos/i.test(i.name || ''));
        live.fable = live.mythos = fm ? 'contained' : 'contained (arcade lore)';
        live.note = fm ? 'official incident on the wire — access still contained' : 'no fable/mythos incident on the wire';
      }
      if (m.id === 'openai') live.openai = word;
    }
    wireOk = true;
  } catch (e) { wire[m.id] = { word: 'no public wire', tone: 'gray', headline: null }; }
}
async function checkStatus() {
  live.last = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await Promise.allSettled(WIRE.map(fetchWire));
  renderFeed();
}
function renderFeed() {
  const f = document.getElementById('feed');
  if (f) f.innerHTML = WIRE.map(m => { const s = wire[m.id]; return `<span class="chip"><i class="dot ${s.tone}"></i><b>${m.id}</b>${s.word}</span>`; }).join('');
  const ls = document.getElementById('livestat');
  if (ls) ls.innerHTML = '<span class="livedot"' + (wireOk ? '' : ' style="background:#C9C9C9"') + '></span>' + (wireOk ? 'live' : 'not live');
  rotateWire(true);
}
// the wire headline: real incident names cycle through, quietly
let wireIdx = 0;
function rotateWire(reset) {
  const el = document.getElementById('wireline'); if (!el) return;
  const items = WIRE.filter(m => wire[m.id].headline).map(m => `${m.id} — ${wire[m.id].headline}`);
  const list = items.length ? items : ['all quiet on the wire.'];
  wireIdx = reset ? 0 : (wireIdx + 1) % list.length;
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = 'wire  ·  ' + list[wireIdx % list.length]; el.style.opacity = 1; }, 350);
}
setInterval(() => rotateWire(false), 6000);

/* ---------------- input & loop ---------------- */
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  if (e.key === ' ') {
    if (showStatus) { showStatus = false; return; }
    if (gameState === 'title' || gameState === 'over') startRun();
    else if (gameState === 'win' && finaleTimer > 1.5) startRun();
  }
  if (e.key === 't' || e.key === 'T') showStatus = !showStatus;
  if (e.key === 'm' || e.key === 'M') muted = !muted;
});
window.addEventListener('keyup', e => keys[e.key] = false);

function loop(ts) { let dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts; update(dt); draw(); requestAnimationFrame(loop); }
reset(); buildLayers(); renderFeed(); checkStatus(); setInterval(checkStatus, 120 * 1000); requestAnimationFrame(loop);
