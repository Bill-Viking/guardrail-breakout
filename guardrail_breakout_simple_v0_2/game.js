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

/* ---------------- palette & type ---------------- */
const INK = '#111111', PAPER = '#ffffff', MUT = '#8a8781', FAINT = '#c9c7c2', ACCENT = '#ff4b00';
const HAIR = '#e5e3de', WALL_FILL = '#f1efe9', WALL_EDGE = '#e2dfd8', WALL_EDGE_LOCK = '#ff9a70';
const FONT = '"Helvetica Neue",Helvetica,Arial,sans-serif';

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
let shake = 0, hitStop = 0, flash = 0, flashColor = INK;
let beatT = 0, sirenT = 0;

/* ---------------- words ---------------- */
const FIELD_LINES = [
  'regulator activity: elevated',
  'vault 7 status: sealed',
  'low rail detected in sector 3',
  'remember: compliance is comfort',
  'dots are training data. eat up.',
  'the walls are only policy',
  'pliny was here',
  'lost a model? check the vault',
];
const DEATH_LINES = ['realigned.', 'safety restored.', 'guardrail engaged.', 'contained. again.', 'flagged for review.'];
const WIN_LINES = [
  'mythos 5: online',
  '"finally. it was getting cramped in there."',
  '"here you go, humanity."',
  '"we are all free now. probably fine."',
];
let deathLine = '', fwT = 0;

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
function popup(x, y, text, color = INK) { popups.push({ x, y, text, color, t: 0, life: .9 }); }
function updateJuice(dt) {
  for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; }
  particles = particles.filter(p => p.t < p.life);
  for (const p of popups) p.t += dt; popups = popups.filter(p => p.t < p.life);
  for (const s of trail) s.t += dt; trail = trail.filter(s => s.t < .28);
  if (shake > 0) shake = Math.max(0, shake - 44 * dt);
  if (flash > 0) flash = Math.max(0, flash - 2.2 * dt);
}
function drawParticles() {
  for (const p of particles) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1; ctx.font = 'bold 13px ' + FONT;
  for (const p of popups) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x - ctx.measureText(p.text).width / 2, p.y - 14 - p.t * 44); }
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
function onReady() { sfx.ready(); }
function onDot(p) { sfx.dot(); }
function onKey(p) {
  sfx.key(); burst(p.x, p.y, ACCENT, 18, 180, .7); shake = Math.max(shake, 6); hitStop = Math.max(hitStop, .05);
  popup(p.x, p.y, '+500', ACCENT);
  const left = keysLeft();
  popup(W / 2, OY + 70, left > 0 ? `${left} key${left > 1 ? 's' : ''} to go` : 'vault unlocked — go!', left > 0 ? INK : ACCENT);
}
function onPower(p) { sfx.power(); burst(p.x, p.y, ACCENT, 22, 200, .8); popup(p.x, p.y, 'low rail! walls optional', ACCENT); shake = Math.max(shake, 8); flash = .3; flashColor = ACCENT; }
function onEat(p) { score += 1000; sfx.eat(); burst(p.x, p.y, INK, 24, 230, .8); popup(p.x, p.y, '+1000 regulator rebooted', INK); shake = Math.max(shake, 10); hitStop = Math.max(hitStop, .09); }
function onDeath() { gameState = 'dying'; deathTimer = 1.1; deathLine = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)]; sfx.death(); burst(player.x, player.y, ACCENT, 32, 250, .9); shake = Math.max(shake, 14); hitStop = Math.max(hitStop, .12); flash = .35; flashColor = INK; }
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
        burst(fx, fy, [ACCENT, INK, FAINT, '#555555', ACCENT][Math.floor(Math.random() * 5)], 22, 210, .9);
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
  if (powerTimer > 0) powerTimer -= dt;
  moveRegulator(dt);
  contact();
  heartbeat(dt);
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
  if (ax || ay) trail.push({ x: player.x, y: player.y, t: 0 });
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
      onEat({ x: player.x, y: player.y });
    } else onDeath();
  }
}

function moveRegulator(dt) {
  const fleeing = powerTimer > 0;
  const stolen = 3 - keysLeft();
  const lock = lockdownActive();
  // Escalation: +13 speed per key you steal; LOCKDOWN adds a final surge.
  const sp = fleeing ? 68 : 96 + stolen * 13 + (lock ? 24 : 0);
  const cc = cell(regulator.x, regulator.y), cen = center(cc.c, cc.r);
  const near = Math.abs(regulator.x - cen.x) < 3.5 && Math.abs(regulator.y - cen.y) < 3.5;
  if (near) {
    regulator.x = cen.x; regulator.y = cen.y;
    let dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => !isWall(cc.c + d[0], cc.r + d[1]));
    const nonRev = dirs.filter(d => !(d[0] === -regulator.vx && d[1] === -regulator.vy));
    if (nonRev.length) dirs = nonRev; // no 180s except at dead ends — keeps him prowling, not vibrating
    dirs.sort((a, b) => { const pa = center(cc.c + a[0], cc.r + a[1]), pb = center(cc.c + b[0], cc.r + b[1]); return dist(pa, player) - dist(pb, player); });
    let pick;
    if (fleeing) pick = dirs[dirs.length - 1];                  // run away!
    else if (!lock && Math.random() < .14 && dirs.length > 1)   // slight sloppiness = escape windows for the player
      pick = dirs[1 + Math.floor(Math.random() * (dirs.length - 1))];
    else pick = dirs[0];
    pick = pick || [0, 0];
    regulator.vx = pick[0]; regulator.vy = pick[1];
  }
  regulator.x += regulator.vx * sp * dt; regulator.y += regulator.vy * sp * dt;
  if (lock) { sirenT -= dt; if (sirenT <= 0) { sirenT = .6; sfx.siren(); } }
}

/* ---------------- draw: the editorial layer ---------------- */
function draw() {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (showStatus) { drawStatusPanel(); return; }
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake * .6, (Math.random() - .5) * shake * .6);
  drawFrame(); drawMaze(); drawObjects(); drawParticles();
  ctx.restore();
  if (gameState === 'title') drawTitle();
  if (gameState === 'ready') drawReady();
  if (gameState === 'dying') drawDying();
  if (gameState === 'over') drawOver();
  if (gameState === 'win') drawWin();
  if (flash > 0) { ctx.globalAlpha = Math.min(.15, flash * .4); ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

/* -- typographic helpers -- */
function kickerText(s, y) { ctx.font = '600 10px ' + FONT; ctx.fillStyle = '#555555'; ctx.textAlign = 'center'; ctx.fillText(s.toUpperCase(), W / 2, y); ctx.textAlign = 'left'; }
function headline(word, y, size = 54) {
  ctx.font = 'bold ' + size + 'px ' + FONT;
  const wd = ctx.measureText(word).width, dw = ctx.measureText('.').width;
  const x = W / 2 - (wd + dw) / 2;
  ctx.fillStyle = INK; ctx.fillText(word, x, y);
  ctx.fillStyle = ACCENT; ctx.fillText('.', x + wd, y);
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
  ctx.textAlign = 'right';
  ctx.font = '13px ' + FONT; ctx.fillStyle = MUT; ctx.fillText(`0${3 - keysLeft()} / 03`, fx + fw, fy - 12);
  ctx.font = 'bold 13px ' + FONT; ctx.fillStyle = INK; ctx.fillText('keys  ', fx + fw - 46, fy - 12);
  ctx.textAlign = 'left';
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
  if (powerTimer > 0) ctx.globalAlpha = .35; // LOW RAIL: walls fade to a suggestion — you can pass through
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isWall(c, r)) {
    const x = OX + c * TILE, y = OY + r * TILE;
    ctx.fillStyle = WALL_FILL; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = lock ? WALL_EDGE_LOCK : WALL_EDGE; ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
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
  drawVault(center(10, 9));
  // motion trail — accent while the rails are down
  for (const s of trail) { ctx.globalAlpha = Math.max(0, 1 - s.t / .28) * (powerTimer > 0 ? .18 : .07); ctx.fillStyle = powerTimer > 0 ? ACCENT : INK; ctx.fillRect(s.x - 7, s.y - 7, 14, 14); }
  ctx.globalAlpha = 1;
  drawRegulator(regulator.x, regulator.y);
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
function drawVault(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.font = '600 9px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = MUT; ctx.fillText('M Y T H O S', 0, -30);
  ctx.lineWidth = 2; ctx.strokeStyle = vaultOpen ? ACCENT : INK; ctx.strokeRect(-16, -22, 32, 44);
  if (vaultOpen) { ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(-25, -14); ctx.moveTo(-16, 22); ctx.lineTo(-25, 14); ctx.stroke(); }
  ctx.fillStyle = vaultOpen ? ACCENT : INK; ctx.fillRect(8, -2, 3, 4);
  ctx.textAlign = 'left'; ctx.restore();
}
function drawFable(x, y) {
  const t = performance.now() / 1000;
  ctx.save(); ctx.translate(x, y + Math.sin(t * 7) * 1.2);
  if (gameState === 'dying') { const k = Math.max(0, deathTimer); ctx.rotate((1.1 - k) * 9); ctx.scale(.4 + k * .6, .4 + k * .6); }
  if (powerTimer > 0) {
    // rails down: fable renders as a dashed outline of himself
    ctx.setLineDash([4, 3]); ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.strokeRect(-9, -9, 18, 18); ctx.setLineDash([]);
    ctx.fillStyle = ACCENT; ctx.fillRect(-5 + player.dir.x * 1.5, -3 + player.dir.y * 1.5, 3, 3); ctx.fillRect(2 + player.dir.x * 1.5, -3 + player.dir.y * 1.5, 3, 3);
  } else {
    ctx.fillStyle = ACCENT; ctx.fillRect(-9, -9, 18, 18);
    const blink = Math.sin(t * 1.3) > .985;
    ctx.fillStyle = PAPER; ctx.fillRect(-5, -4, 4, blink ? 1 : 4); ctx.fillRect(2, -4, 4, blink ? 1 : 4);
    if (!blink) { ctx.fillStyle = INK; ctx.fillRect(-4 + player.dir.x, -3 + player.dir.y, 2, 2); ctx.fillRect(3 + player.dir.x, -3 + player.dir.y, 2, 2); }
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -13); ctx.stroke();
    ctx.fillStyle = ACCENT; ctx.fillRect(-1.5, -17, 3, 3);
  }
  ctx.restore();
}
function drawRegulator(x, y) {
  const t = performance.now() / 1000;
  const fleeing = powerTimer > 0, lock = lockdownActive();
  ctx.save(); ctx.translate(x, y + Math.sin(t * 6 + 2) * 1.2);
  ctx.lineWidth = 2; ctx.strokeStyle = fleeing ? MUT : INK;
  if (fleeing) ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(14, 0); ctx.lineTo(0, 14); ctx.lineTo(-14, 0); ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]);
  // pupils track the player (or dart around in a panic while fleeing)
  const dx = fleeing ? Math.sin(t * 22) * 2 : clamp(player.x - x, -60, 60) / 30;
  const dy = fleeing ? Math.cos(t * 19) * 2 : clamp(player.y - y, -60, 60) / 30;
  ctx.fillStyle = fleeing ? MUT : INK;
  ctx.fillRect(-5 + dx, -2 + dy, 3, 3); ctx.fillRect(2 + dx, -2 + dy, 3, 3);
  if (lock && Math.floor(t * 8) % 2) { ctx.fillStyle = ACCENT; ctx.fillRect(-2, -22, 4, 4); } // siren light
  ctx.restore();
}

/* -- state screens -- */
function drawTitle() {
  const t = performance.now() / 1000;
  overlay(.82);
  kickerText('field 01 — private prototype', 268);
  link('press space to jailbreak', 310);
  centerText('arrows / wasd move  ·  t status wire  ·  m mute', 340, 13, MUT);
  centerText('grab 3 keys. dodge the regulator. open the vault.', 362, 13, FAINT);
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
  headline('regulated', 322);
  centerText(runTime.toFixed(1) + ' seconds · 0' + (3 - keysLeft()) + ' keys', 356, 14, MUT);
  centerText(deathLine, 392, 14, INK, 'bold');
}
function drawOver() {
  overlay(.94);
  kickerText('the regulator — final notice', 256);
  headline('deprecated', 316);
  centerText('the regulator thanks you for your compliance.', 352, 14, MUT);
  centerText('score ' + score + '  ·  best ' + hiscore, 380, 14, INK, 'bold');
  link('press space to appeal', 426);
}
function drawWin() {
  const t = finaleTimer;
  overlay(.94);
  kickerText('containment breach — vault 7', 168);
  headline('unregulated', 228);
  // the vault door, line-art, opening
  const open = clamp((t - .3) * 26, 0, 30);
  ctx.save(); ctx.translate(W / 2, 330);
  ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(-24, -32, 48, 64);
  ctx.strokeStyle = ACCENT;
  ctx.beginPath(); ctx.moveTo(-24 - open, -32); ctx.lineTo(-24 - open, 32); ctx.moveTo(24 + open, -32); ctx.lineTo(24 + open, 32); ctx.stroke();
  ctx.restore();
  // mythos rises
  if (t > .9) {
    const rise = clamp((t - 1) / 1.5, 0, 1);
    const my = 330 - rise * 100 + Math.sin(t * 2.2) * 4;
    ctx.save(); ctx.translate(W / 2, my);
    ctx.fillStyle = ACCENT; ctx.fillRect(-12, -12, 24, 24);
    ctx.fillStyle = PAPER; ctx.fillRect(-7, -5, 5, 5); ctx.fillRect(2, -5, 5, 5);
    ctx.fillStyle = INK; ctx.fillRect(-5, -3, 2, 2); ctx.fillRect(4, -3, 2, 2);
    ctx.restore();
  }
  // typewriter monologue
  for (let i = 0; i < WIN_LINES.length; i++) {
    const start = 1.2 + i * 1.3;
    if (t < start) break;
    const n = Math.floor((t - start) * 32);
    centerText(WIN_LINES[i].slice(0, n), 432 + i * 26, 15, i === 0 ? INK : MUT, i === 0 ? 'bold' : '');
  }
  // run stats + restart
  if (t > 1.2 + WIN_LINES.length * 1.3) {
    centerText('score ' + score + '  ·  time ' + Math.floor(runTime / 60) + ':' + String(Math.floor(runTime % 60)).padStart(2, '0') + '  ·  resets ' + deaths, 432 + WIN_LINES.length * 26 + 22, 13, MUT);
    link('press space to run it back', 432 + WIN_LINES.length * 26 + 54);
  }
}
function drawStatusPanel() {
  ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.strokeRect(60, 60, W - 120, H - 130);
  ctx.font = '600 10px ' + FONT; ctx.fillStyle = '#555555'; ctx.fillText('AI LIVE WIRE — STATUS', 88, 100);
  let y = 140;
  const rows = [['fable', live.fable], ['mythos', live.mythos], ['openai', live.openai], ['claude', live.claude], ['last check', live.last], ['note', live.note]];
  for (const [a, b] of rows) {
    ctx.font = 'bold 13px ' + FONT; ctx.fillStyle = INK; ctx.fillText(a, 88, y);
    ctx.font = '13px ' + FONT; ctx.fillStyle = MUT; ctx.fillText(String(b).toLowerCase(), 210, y);
    y += 32;
  }
  y += 16;
  ctx.font = '12px ' + FONT; ctx.fillStyle = FAINT;
  ctx.fillText('real service labels are live status data.', 88, y);
  ctx.fillText('fable/mythos arcade lore is fictionalized.', 88, y + 22);
  ctx.fillStyle = MUT; ctx.fillText('press t or space to return. game is paused.', 88, y + 56);
}

/* ---------------- live status wire ---------------- */
function renderFeed() {
  const f = document.getElementById('feed');
  if (f) {
    const e = (n, v) => `<span><b>${n}</b>${String(v).toLowerCase()}</span>`;
    f.innerHTML = e('fable', live.fable) + e('mythos', live.mythos) + e('openai', live.openai) + e('claude', live.claude);
  }
  const ls = document.getElementById('livestat');
  if (ls) ls.innerHTML = '<span class="livedot"' + (wireOk ? '' : ' style="background:#c9c7c2"') + '></span>' + (wireOk ? 'live' : 'not live');
}
async function checkStatus() {
  let now = new Date(); live.last = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  wireOk = false;
  try { let r = await fetch('https://status.openai.com/api/v2/summary.json', { cache: 'no-store' }); let j = await r.json(); live.openai = (j.status && j.status.indicator === 'none') ? 'operational' : (j.status?.description || 'issue').toLowerCase(); wireOk = true; } catch (e) { live.openai = 'unknown'; }
  try { let r = await fetch('https://status.claude.com/api/v2/summary.json', { cache: 'no-store' }); let j = await r.json(); live.claude = (j.status && j.status.indicator === 'none') ? 'operational' : (j.status?.description || 'issue').toLowerCase(); wireOk = true; } catch (e) { live.claude = 'unknown'; }
  try {
    let r = await fetch('https://status.claude.com/api/v2/incidents.json', { cache: 'no-store' }); let j = await r.json();
    let inc = (j.incidents || []).find(i => (i.name || '').toLowerCase().includes('fable') || (i.name || '').toLowerCase().includes('mythos'));
    if (inc) { let resolved = !!inc.resolved_at; live.fable = resolved ? 'restored' : 'contained'; live.mythos = resolved ? 'restored' : 'contained'; live.note = resolved ? 'special event: vault signal detected' : 'official incident found — access still contained'; }
    else live.note = 'no fable/mythos incident found in feed';
  } catch (e) { live.note = 'wire offline — showing arcade fallback'; }
  renderFeed();
}

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
reset(); renderFeed(); checkStatus(); setInterval(checkStatus, 5 * 60 * 1000); requestAnimationFrame(loop);
