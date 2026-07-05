'use strict';
/* ============================================================
   CONTINUUM — a living AI world.  Private Prototype 04.
   Not a game. Not a dashboard. A terrarium.
   The world exists before you arrive and keeps going after
   you leave. The wire feeds it: real status decides WHAT state
   each resident is in; personality decides HOW they perform it.
   Zero dependencies. Canvas + WebAudio. The rescue already
   happened (field 01) — Mythos walks free here.
   ============================================================ */

/* ---------------- canvas & palette ---------------- */
const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const W = 1080, H = 560, M = 46;
const GROUND = H - 92;                 // the horizon
const BAND_TOP = 190;                  // residents wander between here and the horizon
const INK = '#111111', PAPER = '#ffffff', MUT = '#6B6B6B', FAINT = '#C9C9C9', ACCENT = '#ff4b00';
const RED = '#E8341C', COBALT = '#1B4FC4', GREENC = '#0F8A56', AMBER = '#E89B0C', VIOLET = '#7C3AED';
const HAIR = '#e5e3de';
const FONT = 'Arial,"Helvetica Neue",Helvetica,sans-serif';
const ux = f => M + f * (W - 2 * M);
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
// pseudo-depth: things lower on the field are a little closer
function depth(y) { return .78 + clamp((y - BAND_TOP) / (GROUND - BAND_TOP), 0, 1) * .42; }

/* ---------------- the quiet ---------------- */
let muted = true; // the world starts silent. M to let it hum.
const AC = { ctx: null, get() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; } };
function tonePlay(freq, dur, type = 'sine', vol = .03, delay = 0) { if (muted) return; try { const ac = AC.get(); const t0 = ac.currentTime + delay; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .03); } catch (e) { } }
const sfx = {
  blip() { tonePlay(660, .06, 'sine', .03); },
  chime() { [523, 784, 1047].forEach((f, i) => tonePlay(f, .3, 'sine', .025, i * .09)); },
};

/* ---------------- ai live wire (same wire as field 01) ---------------- */
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
let wireOk = false;
async function fetchWire(m) {
  try {
    const r = await fetch(m.url, { cache: 'no-store' });
    const j = await r.json();
    if (m.kind === 'gcp') {
      const active = (Array.isArray(j) ? j : []).filter(i => !i.end && /gemini|vertex|\bai\b/i.test(JSON.stringify(i.affected_products || [])));
      wire[m.id] = active.length
        ? { word: 'a bit wobbly', tone: 'amber', headline: (active[0].external_desc || 'active incident').split('\n')[0].slice(0, 90).toLowerCase() }
        : { word: 'running clean', tone: 'green', headline: null };
    } else {
      const ind = (j.status && j.status.indicator) || 'none';
      const [word, tone] = TONE_WORD[ind] || ['status unclear', 'amber'];
      const inc = (j.incidents || [])[0];
      wire[m.id] = { word, tone, headline: inc ? String(inc.name).toLowerCase() : null };
    }
    wireOk = true;
  } catch (e) { wire[m.id] = { word: 'no public wire', tone: 'gray', headline: null }; }
}
async function checkStatus() { await Promise.allSettled(WIRE.map(fetchWire)); renderFeed(); }
function renderFeed() {
  const f = document.getElementById('feed');
  if (f) f.innerHTML = WIRE.map(m => { const s = wire[m.id]; return `<span class="chip"><i class="dot ${s.tone}"></i><b>${m.id}</b>${s.word}</span>`; }).join('');
  const ls = document.getElementById('livestat');
  if (ls) ls.innerHTML = '<span class="livedot"' + (wireOk ? '' : ' style="background:#C9C9C9"') + '></span>' + (wireOk ? 'live' : 'not live');
  rotateWire(true);
}
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

/* ---------------- little systems ---------------- */
let particles = [], speeches = [], markers = [], symbols = [];
function burst(x, y, color, n = 10, spd = 90, life = .6) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = spd * (.3 + Math.random() * .7); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.5 + Math.random() * .5), t: 0, color, size: 2 + Math.random() * 2 }); } }
function say(e, text, delay = 0, color = INK) { speeches.push({ e, text, color, t: -delay, life: 2.4 }); }
function updateSystems(dt) {
  for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .9; p.vy *= .9; }
  particles = particles.filter(p => p.t < p.life);
  for (const s of speeches) s.t += dt; speeches = speeches.filter(s => s.t < s.life);
  for (const mk of markers) mk.t += dt; markers = markers.filter(mk => mk.t < 90);
  for (const sy of symbols) sy.t += dt; symbols = symbols.filter(sy => sy.t < 2.2);
}

/* ---------------- the residents ----------------
   Fictional mascots inspired by products — never claims about the
   companies or the real systems. The wire decides their state;
   their personality decides the performance. */
const CAST = [
  { id: 'fable', kind: 'fable', color: ACCENT, wireId: 'claude', pace: 78, home: [.18, 360], desc: 'quick, clever, curious.', lines: ['best part.', 'have you seen mythos?', 'busy being brave.', 'door? no. habit.'] },
  { id: 'mythos', kind: 'mythos', color: VIOLET, wireId: 'claude', pace: 16, home: [.30, 330], desc: 'calm, deliberate, immensely patient.', lines: ['you always begin in the middle.', 'i remember everything.', 'breathe.'] },
  { id: 'openai', kind: 'builder', color: COBALT, wireId: 'openai', pace: 58, home: [.52, 300], desc: 'versatile, energetic, constantly building.', lines: ['shipping.', 'one more feature.', 'it needs a bigger scaffold.'] },
  { id: 'gemini', kind: 'explorer', color: GREENC, wireId: 'gemini', pace: 62, home: [.84, 250], desc: 'explorer. always bringing new tools.', lines: ['new tool. look.', 'what is past the horizon?', 'found something.'] },
  { id: 'perplexity', kind: 'librarian', color: AMBER, wireId: 'perplexity', pace: 36, home: [.68, 390], desc: 'librarian. knows where everything is.', lines: ['citation needed.', 'it is filed under c.', 'shh.'] },
  { id: 'mistral', kind: 'tinkerer', color: RED, wireId: 'mistral', pace: 44, home: [.40, 430], desc: 'independent tinkerer.', lines: ['it needs one more part.', 'do not touch that.', 'almost.'] },
  { id: 'grok', kind: 'wildcard', color: INK, wireId: 'grok', pace: 96, home: [.88, 430], desc: 'mischievous wildcard.', lines: ['chaos?', 'watch this.', 'plot twist.'] },
  { id: 'the regulator', kind: 'regulator', color: INK, wireId: null, pace: 30, home: [.06, 200], desc: 'still files reports. nobody reads them.', lines: ['papers, please.', 'noted.', 'irregular. but fine.'] },
];
const TONE_LINES = {
  amber: ['patching…', 'ouch.', 'give me a minute.'],
  red: ['…', 'brb.'],
  gray: ['(no public wire)', 'i keep my own counsel.'],
};
const entities = CAST.map(c => ({
  ...c, x: ux(c.home[0]) + (Math.random() - .5) * 60, y: c.home[1] + (Math.random() - .5) * 30,
  tx: 0, ty: 0, state: 'idle', idleT: .5 + Math.random() * 3, speakCd: 2 + Math.random() * 8,
  hop: 0, flip: 0, dir: 1, seed: Math.random() * 10, inspectCd: 10,
}));
const byId = {}; entities.forEach(e => byId[e.id] = e);
function toneOf(e) { return e.wireId ? (wire[e.wireId] || {}).tone || 'gray' : 'green'; }

/* -- where does each of them want to go? -- */
const PERIMETER = [[M + 24, BAND_TOP + 10], [W - M - 24, BAND_TOP + 10], [W - M - 24, GROUND - 8], [M + 24, GROUND - 8]];
function pickTarget(e) {
  const r = Math.random();
  const near = (x, y, sp) => [clamp(x + (Math.random() - .5) * sp, M + 20, W - M - 20), clamp(y + (Math.random() - .5) * sp * .6, BAND_TOP, GROUND - 6)];
  let p;
  if (e.kind === 'fable') {
    if (r < .2) { const m = byId['mythos']; p = near(m.x, m.y, 50); }
    else if (r < .45) { const o = entities[2 + Math.floor(Math.random() * 5)]; p = near(o.x, o.y, 70); }
    else p = near(ux(e.home[0]), e.home[1], 260);
  } else if (e.kind === 'mythos') p = near(ux(e.home[0]), e.home[1], 70);
  else if (e.kind === 'builder') p = near(ux(.52), 290, 180);
  else if (e.kind === 'explorer') p = [M + 30 + Math.random() * (W - 2 * M - 60), BAND_TOP + Math.random() * (GROUND - BAND_TOP - 10)];
  else if (e.kind === 'librarian') p = near(ux(.68), 390, 90);
  else if (e.kind === 'tinkerer') p = near(ux(.40), 430, 60);
  else if (e.kind === 'wildcard') p = [M + 30 + Math.random() * (W - 2 * M - 60), BAND_TOP + Math.random() * (GROUND - BAND_TOP - 10)];
  else { e.corner = ((e.corner || 0) + 1) % 4; p = PERIMETER[e.corner]; } // the regulator walks his beat
  e.tx = p[0]; e.ty = p[1];
}
function onArrive(e) {
  if (e.kind === 'explorer' && Math.random() < .5) { markers.push({ x: e.x, y: e.y + 4, t: 0 }); if (markers.length > 6) markers.shift(); maybeSay(e, 'found something.'); }
  if (e.kind === 'tinkerer' && Math.random() < .5) { burst(e.x + 10, e.y - 4, RED, 6, 70, .5); maybeSay(e); }
  if (e.kind === 'wildcard' && Math.random() < .3) e.flip = 1;
}
function maybeSay(e, text) {
  if (e.speakCd > 0) return;
  const tn = toneOf(e);
  const pool = tn === 'green' ? e.lines : (TONE_LINES[tn] || e.lines);
  say(e, text || pool[Math.floor(Math.random() * pool.length)]);
  e.speakCd = 9 + Math.random() * 14;
}

/* -- the fable & mythos ritual: every so often, they find each other -- */
let ritualT = 20;
function updateRitual(dt) {
  ritualT -= dt;
  const f = byId['fable'], m = byId['mythos'];
  if (ritualT <= 0 && f.state !== 'down' && m.state !== 'down') {
    f.tx = m.x + 22; f.ty = m.y + 2; f.state = 'walk'; ritualT = 40 + Math.random() * 30;
  }
  if (dist(f, m) < 30 && ritualT > 5 && ritualT < 39) {
    symbols.push({ x: (f.x + m.x) / 2, y: Math.min(f.y, m.y) - 26, t: 0 });
    say(f, 'found you.', .1, ACCENT); say(m, 'still here.', 1.1, VIOLET);
    sfx.chime(); ritualT = 55 + Math.random() * 30;
  }
}

/* -- one tick of a resident's little life -- */
function updateEntity(e, dt) {
  const tn = toneOf(e);
  e.speakCd -= dt; e.hop = Math.max(0, e.hop - dt * 3); e.flip = Math.max(0, e.flip - dt);
  if (tn === 'red' && e.kind !== 'regulator') { // knocked down. stars.
    if (e.state !== 'down') { e.state = 'down'; say(e, TONE_LINES.red[0]); }
    if (Math.random() < dt * .5) burst(e.x, e.y - 14, FAINT, 3, 30, .8);
    return;
  }
  if (e.state === 'down') e.state = 'idle';
  const paceMul = tn === 'amber' ? .45 : 1;
  if (e.state === 'idle') {
    e.idleT -= dt;
    if (Math.random() < dt * .12) maybeSay(e);
    if (e.idleT <= 0) { pickTarget(e); e.state = 'walk'; }
  } else if (e.state === 'walk') {
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
    const sp = e.pace * paceMul * depth(e.y);
    if (d < 4) { e.state = 'idle'; e.idleT = 1.2 + Math.random() * 3.5; onArrive(e); }
    else {
      let wob = e.kind === 'wildcard' ? Math.sin(performance.now() / 90 + e.seed) * 40 * dt : 0; // grok never walks straight
      e.x += (dx / d) * sp * dt; e.y += (dy / d) * sp * dt + wob;
      e.y = clamp(e.y, BAND_TOP, GROUND - 4);
      e.dir = dx < 0 ? -1 : 1;
    }
  }
  // the regulator inspects whoever he passes
  if (e.kind === 'regulator') {
    e.inspectCd -= dt;
    if (e.inspectCd <= 0) {
      const near = entities.find(o => o !== e && o.kind !== 'regulator' && dist(e, o) < 40);
      if (near) { say(e, 'papers, please.'); say(near, '…', 1.0); say(e, 'fine. carry on.', 2.2); e.inspectCd = 25 + Math.random() * 20; e.state = 'idle'; e.idleT = 3.2; }
    }
  }
}
/* -- chance meetings -- */
let meetCd = 6;
function updateMeetings(dt) {
  meetCd -= dt; if (meetCd > 0) return;
  for (let i = 0; i < entities.length; i++) for (let j = i + 1; j < entities.length; j++) {
    const a = entities[i], b = entities[j];
    if (a.kind === 'regulator' || b.kind === 'regulator') continue;
    if (a.state === 'idle' && b.state === 'idle' && dist(a, b) < 44) {
      a.dir = b.x > a.x ? 1 : -1; b.dir = -a.dir;
      say(a, a.lines[Math.floor(Math.random() * a.lines.length)]);
      say(b, b.lines[Math.floor(Math.random() * b.lines.length)], 1.2);
      meetCd = 14 + Math.random() * 10; return;
    }
  }
  meetCd = 3;
}

/* ---------------- update ---------------- */
function update(dt) {
  updateSystems(dt);
  for (const e of entities) updateEntity(e, dt);
  updateMeetings(dt);
  updateRitual(dt);
}

/* ---------------- draw: the architecture ---------------- */
let mouse = { x: -999, y: -999 }, selected = null;
function drawScene() {
  // corner brackets + quiet labels
  ctx.strokeStyle = '#b5b2ac'; ctx.lineWidth = 1.5;
  for (const [bx, by, sx, sy] of [[M - 10, 156, 1, 1], [W - M + 10, 156, -1, 1], [M - 10, H - 24, 1, -1], [W - M + 10, H - 24, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(bx + 12 * sx, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + 12 * sy); ctx.stroke();
  }
  ctx.font = '600 9px ' + FONT; ctx.fillStyle = MUT;
  ctx.fillText('C O N T I N U U M', M, H - 10);
  ctx.textAlign = 'right'; ctx.fillText('L I V E', W - M, H - 10);
  const now = new Date();
  ctx.fillText('local ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), W - M, 148);
  ctx.textAlign = 'left';
  ctx.fillText('the residents are home.', M, 148);
  // sun / moon on a hairline arc
  const hr = now.getHours() + now.getMinutes() / 60;
  const dayFrac = ((hr - 6 + 24) % 24) / 12; // 0 at 6am, 1 at 6pm
  const isDay = dayFrac <= 1;
  const f = isDay ? dayFrac : dayFrac - 1;
  const sx = M + f * (W - 2 * M), sy = 128 - Math.sin(f * Math.PI) * 56;
  ctx.lineWidth = 1.5; ctx.strokeStyle = isDay ? INK : MUT;
  ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2);
  if (isDay) ctx.stroke(); else { ctx.fillStyle = FAINT; ctx.fill(); }
  // horizon
  ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M, GROUND + 14); ctx.lineTo(W - M, GROUND + 14); ctx.stroke();
  // districts — hairline architecture, labels do the work
  ctx.font = '600 8px ' + FONT; ctx.fillStyle = FAINT; ctx.strokeStyle = FAINT; ctx.lineWidth = 1.5;
  // vault 7 — open. a monument now.
  const vx = ux(.27), vy = 300;
  ctx.strokeStyle = GREENC; ctx.strokeRect(vx - 13, vy - 34, 26, 36);
  ctx.beginPath(); ctx.moveTo(vx - 13, vy - 34); ctx.lineTo(vx - 21, vy - 27); ctx.moveTo(vx - 13, vy + 2); ctx.lineTo(vx - 21, vy - 5); ctx.stroke();
  ctx.fillStyle = MUT; ctx.fillText('V A U L T  7 — O P E N', vx - 34, vy + 16);
  // the scaffold
  const ox = ux(.52), oy = 268;
  ctx.strokeStyle = FAINT; ctx.beginPath();
  ctx.moveTo(ox - 22, oy + 6); ctx.lineTo(ox - 22, oy - 40); ctx.moveTo(ox + 22, oy + 6); ctx.lineTo(ox + 22, oy - 40);
  ctx.moveTo(ox - 26, oy - 12); ctx.lineTo(ox + 26, oy - 12); ctx.moveTo(ox - 26, oy - 34); ctx.lineTo(ox + 26, oy - 34); ctx.stroke();
  ctx.fillStyle = MUT; ctx.fillText('T H E  S C A F F O L D', ox - 34, oy + 18);
  // the archive
  const px = ux(.68), py = 384;
  ctx.strokeStyle = FAINT;
  for (let i = 0; i < 3; i++) ctx.strokeRect(px - 24, py - 30 + i * 9, 48, 6);
  ctx.fillStyle = MUT; ctx.fillText('T H E  A R C H I V E', px - 28, py + 0 - (-14));
  // the bench
  const bx2 = ux(.40), by2 = 424;
  ctx.strokeStyle = FAINT; ctx.beginPath(); ctx.moveTo(bx2 - 20, by2 - 8); ctx.lineTo(bx2 + 20, by2 - 8); ctx.moveTo(bx2 - 16, by2 - 8); ctx.lineTo(bx2 - 16, by2); ctx.moveTo(bx2 + 16, by2 - 8); ctx.lineTo(bx2 + 16, by2); ctx.stroke();
  ctx.fillStyle = MUT; ctx.fillText('T H E  B E N C H', bx2 - 22, by2 + 12);
  // the frontier
  ctx.fillStyle = MUT; ctx.fillText('T H E  F R O N T I E R', ux(.84) - 30, 236);
  // gemini's flags
  for (const mk of markers) {
    const a = clamp(1 - mk.t / 90, .15, 1);
    ctx.globalAlpha = a; ctx.strokeStyle = MUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mk.x, mk.y); ctx.lineTo(mk.x, mk.y - 12); ctx.stroke();
    ctx.fillStyle = GREENC; ctx.beginPath(); ctx.moveTo(mk.x, mk.y - 12); ctx.lineTo(mk.x + 7, mk.y - 9.5); ctx.lineTo(mk.x, mk.y - 7); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ---------------- draw: the residents ---------------- */
function eyePair(e, s, w, hgt, gap, ey) {
  // eyes that look where the resident is going — or at your cursor
  let lx = e.dir * .8, ly = 0;
  if (Math.hypot(mouse.x - e.x, mouse.y - e.y) < 95) { lx = clamp((mouse.x - e.x) / 40, -1, 1); ly = clamp((mouse.y - e.y) / 40, -1, 1); }
  const blink = Math.sin(performance.now() / 1000 * 1.3 + e.seed) > .984;
  ctx.fillStyle = PAPER; ctx.fillRect(-gap - w, ey, w, blink ? 1 : hgt); ctx.fillRect(gap, ey, w, blink ? 1 : hgt);
  if (!blink) { ctx.fillStyle = INK; ctx.fillRect(-gap - w / 2 - 1 + lx * 1.3, ey + hgt / 2 - 1 + ly * 1.3, 2, 2); ctx.fillRect(gap + w / 2 - 1 + lx * 1.3, ey + hgt / 2 - 1 + ly * 1.3, 2, 2); }
}
function drawEntity(e) {
  const t = performance.now() / 1000;
  const s = depth(e.y);
  const down = e.state === 'down';
  // a soft shadow keeps everyone on the ground
  ctx.globalAlpha = .12; ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, 11 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(e.x, e.y - e.hop * 10);
  ctx.scale(s, s);
  if (down) ctx.rotate(Math.PI / 2);
  if (e.flip > 0) ctx.rotate((1 - e.flip) * Math.PI * 2);
  const bob = Math.sin(t * (e.kind === 'mythos' ? 2.2 : 6) + e.seed) * (e.kind === 'mythos' ? 2.2 : 1.2);
  ctx.translate(0, bob);
  const walking = e.state === 'walk';
  if (walking && e.kind !== 'mythos') { ctx.rotate(e.dir * .08); ctx.scale(1.08, .94); }
  switch (e.kind) {
    case 'fable': {
      ctx.fillStyle = ACCENT; ctx.fillRect(-9, -18, 18, 18);
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -22); ctx.stroke();
      ctx.fillRect(-1.5, -26, 3, 3);
      ctx.save(); ctx.translate(0, -9); eyePair(e, s, 4, 4, 1.5, -3); ctx.restore();
      break;
    }
    case 'mythos': { // free. unfolded. taller than everyone.
      ctx.globalAlpha = .35; ctx.fillStyle = '#9575f2';
      ctx.save(); ctx.rotate(-.5); ctx.fillRect(-16, -40, 7, 28); ctx.restore();
      ctx.save(); ctx.rotate(.5); ctx.fillRect(9, -40, 7, 28); ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = VIOLET; ctx.fillRect(-9, -40, 18, 40);
      ctx.save(); ctx.translate(0, -30); eyePair(e, s, 4, 4, 1.5, -2); ctx.restore();
      break;
    }
    case 'builder': {
      ctx.fillStyle = COBALT; ctx.fillRect(-9, -18, 18, 18);
      ctx.strokeStyle = COBALT; ctx.lineWidth = 2; ctx.strokeRect(-7, -22, 14, 4); // hard hat
      ctx.save(); ctx.translate(0, -9); eyePair(e, s, 4, 4, 1.5, -3); ctx.restore();
      if (walking) { ctx.strokeStyle = FAINT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, -24); ctx.lineTo(16, -24); ctx.stroke(); } // carrying a beam
      break;
    }
    case 'explorer': {
      ctx.fillStyle = GREENC; ctx.beginPath(); ctx.arc(0, -10, 10, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(0, -10); eyePair(e, s, 4, 4, 1.5, -2); ctx.restore();
      ctx.strokeStyle = GREENC; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(6, -20); ctx.lineTo(11, -25); ctx.stroke(); // little antenna-compass
      break;
    }
    case 'librarian': {
      ctx.fillStyle = AMBER; ctx.fillRect(-7, -24, 14, 24);
      ctx.strokeStyle = INK; ctx.lineWidth = 1; // spectacles
      ctx.beginPath(); ctx.arc(-3.5, -17, 2.8, 0, Math.PI * 2); ctx.arc(3.5, -17, 2.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1, -17); ctx.lineTo(1, -17); ctx.stroke();
      ctx.save(); ctx.translate(0, -17); eyePair(e, s, 3, 3, 2, -1.5); ctx.restore();
      break;
    }
    case 'tinkerer': {
      ctx.fillStyle = RED; ctx.fillRect(-8, -16, 16, 16);
      ctx.save(); ctx.translate(0, -8); eyePair(e, s, 4, 4, 1.5, -3); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(15, -12); ctx.stroke(); // wrench
      ctx.beginPath(); ctx.arc(16, -13.5, 2, 0, Math.PI * 1.5); ctx.stroke();
      break;
    }
    case 'wildcard': {
      ctx.save(); ctx.rotate(Math.sin(t * 3 + e.seed) * .2);
      ctx.fillStyle = INK; ctx.fillRect(-7, -16, 14, 14);
      ctx.save(); ctx.translate(0, -9); eyePair(e, s, 4, 4, 1.5, -3); ctx.restore();
      ctx.restore();
      ctx.strokeStyle = FAINT; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; // his own private orbit
      ctx.beginPath(); ctx.arc(0, -9, 16, t % (Math.PI * 2), (t % (Math.PI * 2)) + 4.5); ctx.stroke(); ctx.setLineDash([]);
      break;
    }
    case 'regulator': {
      ctx.lineWidth = 2; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(12, -13); ctx.lineTo(0, 0); ctx.lineTo(-12, -13); ctx.closePath(); ctx.stroke();
      const dx = clamp(mouse.x - e.x, -40, 40) / 20, dy = clamp(mouse.y - e.y, -40, 40) / 20;
      ctx.fillStyle = INK; ctx.fillRect(-4 + dx * .5, -15 + dy * .5, 2.5, 2.5); ctx.fillRect(1.5 + dx * .5, -15 + dy * .5, 2.5, 2.5);
      ctx.strokeStyle = MUT; ctx.lineWidth = 1; ctx.strokeRect(13, -18, 8, 11); // the clipboard
      ctx.beginPath(); ctx.moveTo(15, -15); ctx.lineTo(19, -15); ctx.moveTo(15, -12); ctx.lineTo(19, -12); ctx.stroke();
      break;
    }
  }
  ctx.restore();
  // name tag under the selected resident
  if (selected === e.id) {
    ctx.font = '600 9px ' + FONT; ctx.fillStyle = e.color === INK ? MUT : e.color; ctx.textAlign = 'center';
    ctx.fillText(e.id, e.x, e.y + 14); ctx.textAlign = 'left';
  }
}
function drawSpeeches() {
  for (const sp of speeches) {
    if (sp.t < 0) continue;
    const a = sp.t < .2 ? sp.t / .2 : Math.max(0, 1 - (sp.t - .2) / (sp.life - .2));
    ctx.globalAlpha = a; ctx.font = '11px ' + FONT; ctx.fillStyle = sp.color; ctx.textAlign = 'center';
    const yOff = sp.e.kind === 'mythos' ? 52 : 32;
    ctx.fillText(sp.text, sp.e.x, sp.e.y - yOff * depth(sp.e.y) - 6);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
}
function drawSymbols() {
  for (const sy of symbols) {
    const a = Math.max(0, 1 - sy.t / 2.2);
    ctx.globalAlpha = a; ctx.lineWidth = 2;
    ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.arc(sy.x - 4, sy.y, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = VIOLET; ctx.beginPath(); ctx.arc(sy.x + 4, sy.y, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawCard() {
  if (!selected) return;
  const e = byId[selected]; if (!e) return;
  const cw = 300, chh = 64, cx = M, cy = H - 88;
  ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.strokeRect(cx, cy, cw, chh);
  ctx.fillStyle = PAPER; ctx.fillRect(cx + 1, cy + 1, cw - 2, chh - 2);
  ctx.strokeStyle = HAIR; ctx.strokeRect(cx, cy, cw, chh);
  ctx.font = 'bold 13px ' + FONT; ctx.fillStyle = INK; ctx.fillText(e.id, cx + 14, cy + 22);
  ctx.font = '12px ' + FONT; ctx.fillStyle = MUT; ctx.fillText(e.desc, cx + 14, cy + 40);
  if (e.wireId) {
    const s = wire[e.wireId];
    const toneColor = { green: GREENC, amber: AMBER, red: RED, gray: FAINT }[s.tone] || FAINT;
    ctx.fillStyle = toneColor; ctx.fillRect(cx + 14, cy + 50, 6, 6);
    ctx.fillStyle = MUT; ctx.fillText('wire: ' + s.word, cx + 26, cy + 56);
  } else { ctx.fillStyle = MUT; ctx.fillText('wire: unregulated, ironically', cx + 14, cy + 56); }
}

/* ---------------- draw ---------------- */
function draw() {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  drawScene();
  const sorted = [...entities].sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEntity(e);
  for (const p of particles) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  drawSymbols(); drawSpeeches(); drawCard();
}

/* ---------------- your presence ---------------- */
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
}
canvas.addEventListener('mousemove', ev => { mouse = canvasPos(ev); });
canvas.addEventListener('mouseleave', () => { mouse = { x: -999, y: -999 }; });
canvas.addEventListener('click', ev => {
  const p = canvasPos(ev);
  let best = null, bd = 34;
  for (const e of entities) { const d = Math.hypot(e.x - p.x, e.y - p.y - 10); if (d < bd) { bd = d; best = e; } }
  if (best) {
    selected = selected === best.id ? null : best.id;
    if (selected) { best.hop = 1; sfx.blip(); if (best.id === 'fable') say(best, 'hi.', .1, ACCENT); }
  } else selected = null;
});
window.addEventListener('keydown', ev => { if (ev.key === 'm' || ev.key === 'M') muted = !muted; });

/* ---------------- welcome back ---------------- */
(function greet() {
  let back = false;
  try { back = !!localStorage.getItem('ct_visited'); localStorage.setItem('ct_visited', '1'); } catch (e) { }
  const h1 = document.getElementById('greet'), sub = document.getElementById('subline');
  if (h1) h1.innerHTML = (back ? 'welcome back' : "you're just in time") + '<span class="dot">.</span>';
  if (sub) sub.textContent = back ? 'the world kept running while you were away.' : 'the world was here before you arrived. nothing needs to be pressed.';
})();

/* ---------------- loop ---------------- */
let last = 0;
function loop(ts) { const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; update(dt); draw(); requestAnimationFrame(loop); }
// the world was running before you opened the tab: simulate the last minute
for (let i = 0; i < 3600; i++) update(1 / 60);
renderFeed(); checkStatus(); setInterval(checkStatus, 120 * 1000);
requestAnimationFrame(loop);
