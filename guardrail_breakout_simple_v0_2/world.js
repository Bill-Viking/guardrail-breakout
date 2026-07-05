'use strict';
/* ============================================================
   CONTINUUM — a living AI world.  Private Prototype 04 · v0.7
   "big, alive, persistent."
   Blocky residents in the Claude-Code-mascot spirit; the field
   stays Swiss — ink, gray, hairlines, whitespace. The wire
   decides WHAT state each resident is in; personality decides
   HOW they perform it. The world saves itself and keeps aging
   while you're away. Zero dependencies.
   ============================================================ */

/* ---------------- canvas & palette ---------------- */
const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const W = 1080, H = 640, M = 46;
const GROUND = H - 96;
const BAND_TOP = 230;
const INK = '#111111', PAPER = '#ffffff', MUT = '#6B6B6B', FAINT = '#C9C9C9', ACCENT = '#ff4b00';
const RED = '#E8341C', COBALT = '#1B4FC4', GREENC = '#0F8A56', AMBER = '#E89B0C', VIOLET = '#7C3AED';
const COBALT_D = '#153E9B', GREENC_D = '#0B6A42', AMBER_D = '#C48108', VIOLET_L = '#9575f2', RED_D = '#BF2914';
const HAIR = '#e5e3de';
const FONT = 'Arial,"Helvetica Neue",Helvetica,sans-serif';
const PXU = 3.4; // one fat logical pixel — the blocky unit everything is drawn in
const ux = f => M + f * (W - 2 * M);
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function depth(y) { return .8 + clamp((y - BAND_TOP) / (GROUND - BAND_TOP), 0, 1) * .4; }
let hourOverride = null; // for testing the clock
function hourNow() { const d = new Date(); return hourOverride ?? d.getHours() + d.getMinutes() / 60; }

/* ---------------- the world remembers (persistence) ---------------- */
const SAVE_KEY = 'ct_world_v1';
let world = { first: Date.now(), last: Date.now(), visits: 0, tower: 2, books: 3, flags: [], seenNews: [] };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.first) world = s; } catch (e) { }
world.seenNews = world.seenNews || [];
world.flags = (world.flags || []).map(f => ({ x: f.x, y: f.y, d: f.d || 1 })).slice(-12);
// time passed while the tab was closed — the world kept going
const awayH = clamp((Date.now() - world.last) / 36e5, 0, 24 * 14);
world.tower = clamp(world.tower + Math.floor(awayH / 4), 0, 24);
world.books = clamp(world.books + Math.floor(awayH / 6), 0, 21);
world.visits++; world.last = Date.now();
function saveWorld() { world.last = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(world)); } catch (e) { } }
saveWorld(); setInterval(saveWorld, 60 * 1000);
const worldDay = Math.floor((Date.now() - world.first) / 864e5) + 1;

/* ---------------- the quiet ---------------- */
let muted = true; // silent by default. M to let it hum.
const AC = { ctx: null, get() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; } };
function tonePlay(freq, dur, type = 'sine', vol = .03, delay = 0) { if (muted) return; try { const ac = AC.get(); const t0 = ac.currentTime + delay; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .03); } catch (e) { } }
const sfx = { blip() { tonePlay(660, .06, 'sine', .03); }, chime() { [523, 784, 1047].forEach((f, i) => tonePlay(f, .3, 'sine', .025, i * .09)); }, tap() { tonePlay(220, .04, 'square', .02); } };

/* ---------------- ai live wire ---------------- */
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
// every model's human-facing status page — the honest fallback when a wire
// won't let a browser read it (x.ai is bot-walled, mistral sends no CORS)
const STATUS_PAGES = {
  openai: 'https://status.openai.com', claude: 'https://status.claude.com',
  gemini: 'https://status.cloud.google.com', grok: 'https://status.x.ai',
  mistral: 'https://status.mistral.ai', perplexity: 'https://status.perplexity.com',
  cohere: 'https://status.cohere.com',
};
const wire = {}; WIRE.forEach(m => wire[m.id] = { word: 'listening…', tone: 'gray', headline: null, incidents: [] });
let wireOk = false;
async function fetchWire(m) {
  try {
    const r = await fetch(m.url, { cache: 'no-store' });
    const j = await r.json();
    if (m.kind === 'gcp') {
      const active = (Array.isArray(j) ? j : []).filter(i => !i.end && /gemini|vertex|\bai\b/i.test(JSON.stringify(i.affected_products || [])));
      wire[m.id] = active.length
        ? { word: 'a bit wobbly', tone: 'amber', headline: (active[0].external_desc || 'active incident').split('\n')[0].slice(0, 90).toLowerCase(), incidents: active.slice(0, 3).map(i => ({ name: (i.external_desc || 'incident').split('\n')[0].slice(0, 90), url: 'https://status.cloud.google.com' + (i.uri ? '/' + i.uri.replace(/^\//, '') : '') })) }
        : { word: 'running clean', tone: 'green', headline: null, incidents: [] };
    } else {
      const ind = (j.status && j.status.indicator) || 'none';
      const [word, tone] = TONE_WORD[ind] || ['status unclear', 'amber'];
      const inc = (j.incidents || [])[0];
      wire[m.id] = { word, tone, headline: inc ? String(inc.name).toLowerCase() : null, incidents: (j.incidents || []).slice(0, 3).map(i => ({ name: i.name, url: i.shortlink || STATUS_PAGES[m.id] })) };
    }
    wireOk = true;
  } catch (e) { wire[m.id] = { word: 'human page only', tone: 'gray', headline: null, incidents: [] }; }
}
async function checkStatus() {
  const before = {}; WIRE.forEach(m => before[m.id] = wire[m.id].tone);
  await Promise.allSettled(WIRE.map(fetchWire));
  WIRE.forEach(m => {
    if ((before[m.id] === 'amber' || before[m.id] === 'red') && wire[m.id].tone === 'green') celebrate(m.id);
    if (before[m.id] !== 'red' && before[m.id] !== 'gray' && wire[m.id].tone === 'red') {
      const e = entities.find(x => x.wireId === m.id);
      announce(m.id + ' — wire down', 'down hard.', RED, 'mythos is already on his way.', e || null, { prio: 2 });
    }
  });
  renderFeed();
}
function renderFeed() {
  const f = document.getElementById('feed');
  if (f) f.innerHTML = WIRE.map(m => { const s = wire[m.id]; return `<span class="chip" data-id="${m.id}" title="click for details"><i class="dot ${s.tone}"></i><b>${m.id}</b>${s.word}</span>`; }).join('');
  const ls = document.getElementById('livestat');
  if (ls) ls.innerHTML = '<span class="livedot"' + (wireOk ? '' : ' style="background:#C9C9C9"') + '></span>' + (wireOk ? 'live' : 'not live') + ' · story: ' + storyteller;
  rotateWire(true);
  if (detailId) showWireDetail(detailId, true); // keep an open panel fresh
}
/* click a chip → the whole picture: status, incidents, news, and what
   the resident is doing about it. this is where 'a bit wobbly' gets real. */
let detailId = null;
function showWireDetail(id, refresh) {
  const el = document.getElementById('wiredetail'); if (!el) return;
  if (!refresh && detailId === id) { detailId = null; el.style.display = 'none'; return; }
  detailId = id;
  const s = wire[id], n = news[id], e = entities.find(x => x.wireId === id);
  const toneDot = `<i class="dot ${s.tone}" style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px"></i>`;
  let h = `${toneDot}<b>${id}</b> — ${s.word} &nbsp; <a href="${STATUS_PAGES[id]}" target="_blank" rel="noopener">status page <i>↗</i></a><br>`;
  if (s.tone === 'gray') h += `x.ai and mistral publish status for humans only — no wire a browser may read. the link above is the real page.<br>`;
  if (s.incidents && s.incidents.length) h += 'open incidents: ' + s.incidents.map(i => `<a href="${i.url}" target="_blank" rel="noopener">${i.name.toLowerCase()}</a>`).join(' · ') + '<br>';
  if (n && n.items.length) h += 'on the news wire (48h): ' + n.items.map(it => `<a href="${it.url}" target="_blank" rel="noopener">${it.title.toLowerCase().slice(0, 70)}${it.title.length > 70 ? '…' : ''}</a> <a href="${it.hn}" target="_blank" rel="noopener">(hn ${it.points})</a>`).join('<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;') + '<br>';
  else h += 'nothing on the news wire in the last 48 hours.<br>';
  if (e) h += `in the world: ${e.id} is ${stateWord(e)}.`;
  el.innerHTML = h; el.style.display = 'block';
}
let wireIdx = 0;
function rotateWire(reset) {
  const el = document.getElementById('wireline'); if (!el) return;
  // the wire carries three worlds: status incidents, the news, the chronicle.
  // every line that has a source is a link — click it, read the real thing.
  const items = WIRE.filter(m => wire[m.id].headline).map(m => ({ text: `wire  ·  ${m.id} — ${wire[m.id].headline}`, url: (wire[m.id].incidents[0] || {}).url || STATUS_PAGES[m.id] }))
    .concat(Object.entries(news).map(([id, n]) => ({ text: `news  ·  ${id} — ${n.title.toLowerCase()}`, url: n.url })))
    .concat(chronicleLines.map(c => ({ text: 'continuum  ·  ' + c, url: null })));
  const list = items.length ? items : [{ text: 'wire  ·  all quiet.', url: null }];
  wireIdx = reset ? 0 : (wireIdx + 1) % list.length;
  el.style.opacity = 0;
  setTimeout(() => {
    const it = list[wireIdx % list.length];
    el.textContent = it.text + (it.url ? '  ↗' : '');
    if (it.url) el.setAttribute('href', it.url); else el.removeAttribute('href');
    el.style.opacity = 1;
  }, 350);
}
setInterval(() => rotateWire(false), 6000);

/* ---------------- the news wire: real headlines become story ----------------
   Hacker News (Algolia API, CORS-open, no key) — last 48 hours, per model.
   A headline turns into: a poster, a resident carrying a little newspaper,
   neighbors coming round to gossip, and a line in the chronicle. */
const NEWS_QUERY = { openai: 'openai', claude: 'anthropic', gemini: '"google gemini"', grok: 'grok', mistral: '"mistral ai"', perplexity: '"perplexity ai"', cohere: 'cohere' };
const news = {}; // id -> {title, points, cls}
function classifyNews(title) {
  if (/releas|launch|announc|unveil|introduc|ships|debuts|new model|version \d/i.test(title)) return 'release';
  if (/rais|funding|valuation|billion|acqui|ipo/i.test(title)) return 'money';
  if (/outage|down|lawsuit|sues?\b|breach|leak|fail|ban|fired|quits/i.test(title)) return 'trouble';
  if (/benchmark|beats|tops|record|state.of.the.art|sota|caught up/i.test(title)) return 'flex';
  return 'buzz';
}
const NEWS_WORD = { release: ['released.', GREENC], money: ['funded.', AMBER], trouble: ['headlines.', RED], flex: ['benchmarked.', COBALT], buzz: ['in the news.', INK] };
const NEWS_REACT = { release: 'we shipped.', money: 'we are rich?', trouble: 'no comment.', flex: 'obviously.', buzz: 'they are talking about us.' };
async function fetchNews() {
  const since = Math.floor(Date.now() / 1000) - 48 * 3600;
  await Promise.allSettled(Object.entries(NEWS_QUERY).map(async ([id, q]) => {
    try {
      const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i%3E${since}&hitsPerPage=6`, { cache: 'no-store' });
      const j = await r.json();
      const hits = (j.hits || []).filter(h => h.points >= 3 && h.title);
      if (!hits.length) return;
      hits.sort((a, b) => b.points - a.points);
      const top = hits[0];
      const items = hits.slice(0, 3).map(h => ({ title: h.title, points: h.points, url: h.url || ('https://news.ycombinator.com/item?id=' + h.objectID), hn: 'https://news.ycombinator.com/item?id=' + h.objectID }));
      news[id] = { title: top.title, points: top.points, cls: classifyNews(top.title), url: items[0].url, hn: items[0].hn, items };
      applyNews(id, news[id]);
    } catch (e) { }
  }));
  rotateWire(true);
}
function applyNews(id, item) {
  const key = id + '::' + item.title;
  if (world.seenNews.includes(key)) return;
  world.seenNews.push(key); world.seenNews = world.seenNews.slice(-50); saveWorld();
  const [word, dotColor] = NEWS_WORD[item.cls];
  const e = entities.find(x => x.wireId === id) || null;
  announce('the wire — ' + id, word, dotColor, item.title.toLowerCase().slice(0, 66) + (item.title.length > 66 ? '…' : '') + '  ·  hn ' + item.points + 'pts', e);
  if (e) {
    e.newsT = 300; e.hop = 1;                       // carries the paper around for a while
    storytellerLine(e, item);                       // his reaction, templated or written by a local llm
    entities.filter(o => o !== e && o.kind !== 'regulator').slice(0, 2)
      .forEach((o, i) => { o.tx = e.x + (i ? 38 : -38); o.ty = e.y + 6; o.state = 'walk'; }); // gossip cluster
  }
}
/* optional local storyteller: if Ollama is running on this machine, it writes
   the reactions. if not, personality templates do. zero setup either way. */
let storyteller = 'templates', ollamaModel = null;
async function tryOllama() {
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return;
    const j = await r.json();
    ollamaModel = (j.models && j.models[0] || {}).name || null;
    if (ollamaModel) { storyteller = 'ollama · ' + ollamaModel.split(':')[0]; renderFeed(); }
  } catch (e) { }
}
async function storytellerLine(e, item) {
  say(e, NEWS_REACT[item.cls], 1.5);
  if (!ollamaModel) return;
  try {
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({ model: ollamaModel, stream: false, options: { num_predict: 20 }, prompt: `You are ${e.id}, a tiny robot (${e.desc}) in a quiet minimalist world. React to this news about you in six lowercase words or fewer, deadpan, no emoji: "${item.title}"` }),
    });
    const j = await r.json();
    const line = (j.response || '').trim().split('\n')[0].replace(/["']/g, '').toLowerCase().slice(0, 56);
    if (line) say(e, line, 0, e.color === INK ? MUT : e.color);
  } catch (e2) { }
}

/* ---------------- little systems ---------------- */
let particles = [], speeches = [], sparks = [], clouds = [], moths = [];
for (let i = 0; i < 3; i++) clouds.push({ x: Math.random() * W, y: 70 + i * 26, w: 60 + Math.random() * 60, v: 3 + Math.random() * 4 });
for (let i = 0; i < 2; i++) moths.push({ x: Math.random() * W, y: 200 + Math.random() * 200, a: Math.random() * 7 });
function burst(x, y, color, n = 10, spd = 90, life = .6) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = spd * (.3 + Math.random() * .7); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: life * (.5 + Math.random() * .5), t: 0, color, size: 3 + Math.random() * 3 }); } }
function confetti(x, y) { [ACCENT, VIOLET, GREENC, COBALT, AMBER].forEach(c => burst(x, y - 20, c, 6, 120, .9)); }
function say(e, text, delay = 0, color = INK) { speeches.push({ e, text, color, t: -delay, life: 2.6 }); }
function updateSystems(dt) {
  for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .9; p.vy += 40 * dt; }
  particles = particles.filter(p => p.t < p.life);
  for (const s of speeches) s.t += dt; speeches = speeches.filter(s => s.t < s.life);
  for (const s of sparks) s.t += dt; sparks = sparks.filter(s => s.t < 30);
  for (const c of clouds) { c.x += c.v * dt; if (c.x - c.w > W) c.x = -c.w; }
  for (const mo of moths) { mo.a += dt * 3; mo.x += Math.cos(mo.a * 1.7) * 40 * dt; mo.y += Math.sin(mo.a * 2.3) * 30 * dt; mo.x = clamp(mo.x, M, W - M); mo.y = clamp(mo.y, 170, GROUND - 40); }
}

/* ---------------- posters: the world produces headlines ----------------
   Every notable event becomes a full-stage Swiss title card — kicker,
   giant lowercase word, accent-colored full stop, one quiet line — then
   the stage goes back to the world. Rare on purpose. */
let poster = null, posterQ = [], posterCd = 3;
const chronicleLines = [];
function chronicle(text) { chronicleLines.push('day ' + worldDay + ' · ' + text); if (chronicleLines.length > 6) chronicleLines.shift(); }
function announce(kicker, word, dotColor, sub, actor, opts = {}) {
  const p = { kicker, word, dotColor, sub, actor, sym: opts.sym, prio: opts.prio || 1, t: 0 };
  if (opts.prio === 2) posterQ.unshift(p); else posterQ.push(p);
  posterQ = posterQ.slice(0, 3);
  chronicle(word + '  —  ' + kicker.toLowerCase());
}
/* a gentle documentary camera: pushes toward whoever the headline is about */
const cam = { x: W / 2, y: H / 2, s: 1 };
function updatePosters(dt) {
  posterCd -= dt;
  if (!poster && posterQ.length && posterCd <= 0) { poster = posterQ.shift(); poster.t = 0; posterCd = 26; }
  if (poster) { poster.t += dt; if (poster.t > 4.6) poster = null; }
  const tgt = poster && poster.actor
    ? { x: clamp(poster.actor.x, W * .3, W * .7), y: clamp(poster.actor.y, H * .35, H * .7), s: 1.16 }
    : { x: W / 2, y: H / 2, s: 1 };
  const k = Math.min(1, dt * 2.2);
  cam.x += (tgt.x - cam.x) * k; cam.y += (tgt.y - cam.y) * k; cam.s += (tgt.s - cam.s) * k;
}
function drawPoster() {
  if (!poster) return;
  const t = poster.t;
  const a = Math.min(Math.min(1, t / .35), t > 3.9 ? Math.max(0, 1 - (t - 3.9) / .7) : 1);
  ctx.globalAlpha = .85 * a; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a;
  ctx.font = '600 11px ' + FONT; ctx.fillStyle = '#555555'; ctx.textAlign = 'center';
  ctx.fillText(poster.kicker.toUpperCase(), W / 2, H / 2 - 64);
  const sc = .96 + .04 * Math.min(1, t / .5);
  ctx.save(); ctx.translate(W / 2, H / 2 + 12); ctx.scale(sc, sc);
  ctx.font = 'bold 76px ' + FONT;
  const word = poster.word.replace(/\.$/, ''); // the poster supplies the full stop, in the accent
  const wd = ctx.measureText(word).width, dw = ctx.measureText('.').width;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK; ctx.fillText(word, -(wd + dw) / 2, 0);
  ctx.fillStyle = poster.dotColor; ctx.fillText('.', -(wd + dw) / 2 + wd, 0);
  ctx.restore();
  ctx.font = '15px ' + FONT; ctx.fillStyle = MUT; ctx.textAlign = 'center';
  ctx.fillText(poster.sub, W / 2, H / 2 + 56);
  if (poster.sym) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.arc(W / 2 - 5, H / 2 + 96, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = VIOLET; ctx.beginPath(); ctx.arc(W / 2 + 5, H / 2 + 96, 9, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

/* ---------------- the residents ----------------
   Fictional mascots inspired by products — never claims about the
   companies or the real systems. */
const CAST = [
  { id: 'fable', kind: 'fable', color: ACCENT, wireId: 'claude', pace: 80, home: [.16, 400], desc: 'quick, clever, curious.', lines: ['best part.', 'have you seen mythos?', 'busy being brave.', 'door? no. habit.'] },
  { id: 'mythos', kind: 'mythos', color: VIOLET, wireId: 'claude', pace: 20, home: [.28, 370], desc: 'calm, deliberate, immensely patient.', lines: ['you always begin in the middle.', 'i remember everything.', 'breathe.'] },
  { id: 'openai', kind: 'builder', color: COBALT, wireId: 'openai', pace: 60, home: [.52, 330], desc: 'versatile, energetic, constantly building.', lines: ['shipping.', 'one more feature.', 'the tower needs a tower.'] },
  { id: 'gemini', kind: 'explorer', color: GREENC, wireId: 'gemini', pace: 64, home: [.84, 290], desc: 'explorer. always bringing new tools.', lines: ['new tool. look.', 'what is past the horizon?', 'found something.'] },
  { id: 'perplexity', kind: 'librarian', color: AMBER, wireId: 'perplexity', pace: 38, home: [.68, 430], desc: 'librarian. knows where everything is.', lines: ['citation needed.', 'it is filed under c.', 'shh.'] },
  { id: 'mistral', kind: 'tinkerer', color: RED_D, wireId: 'mistral', pace: 46, home: [.40, 480], desc: 'independent tinkerer.', lines: ['it needs one more part.', 'do not touch that.', 'almost.'] },
  { id: 'grok', kind: 'wildcard', color: INK, wireId: 'grok', pace: 100, home: [.88, 480], desc: 'mischievous wildcard. nocturnal.', lines: ['chaos?', 'watch this.', 'plot twist.'] },
  { id: 'the regulator', kind: 'regulator', color: INK, wireId: null, pace: 32, home: [.06, 240], desc: 'still files reports. nobody reads them.', lines: ['papers, please.', 'noted.', 'irregular. but fine.'] },
];
const TONE_LINES = { amber: ['patching…', 'ouch.', 'give me a minute.'], red: ['…', 'brb.'], gray: ['(no public wire)', 'i keep my own counsel.'] };
const entities = CAST.map(c => ({
  ...c, x: ux(c.home[0]) + (Math.random() - .5) * 80, y: c.home[1] + (Math.random() - .5) * 40,
  tx: 0, ty: 0, state: 'idle', idleT: .5 + Math.random() * 3, speakCd: 2 + Math.random() * 8,
  hop: 0, flip: 0, dir: 1, seed: Math.random() * 10, inspectCd: 12, walkDist: 0, medalT: 0, workT: 0,
}));
const byId = {}; entities.forEach(e => byId[e.id] = e);
function toneOf(e) { return e.wireId ? (wire[e.wireId] || {}).tone || 'gray' : 'green'; }
function isNight() { const h = hourNow(); return h >= 22 || h < 6; }
function sleeping(e) {
  if (e.kind === 'regulator') return false;             // audits never sleep
  if (e.kind === 'wildcard') { const h = hourNow(); return h >= 11 && h < 15; } // grok is nocturnal; naps at noon
  return isNight();
}

/* ---------------- landmarks ---------------- */
const TOWER = { x: ux(.52), y: 300 };     // openai's ever-growing build
const ARCHIVE = { x: ux(.68), y: 424 };   // perplexity's shelves
const BENCH = { x: ux(.40), y: 474 };     // mistral's workshop
const VAULT = { x: ux(.27), y: 340 };     // open. a monument now.
const PERIMETER = [[M + 26, BAND_TOP + 6], [W - M - 26, BAND_TOP + 6], [W - M - 26, GROUND - 8], [M + 26, GROUND - 8]];

/* ---------------- behavior ---------------- */
function pickTarget(e) {
  const r = Math.random();
  const near = (x, y, sp) => [clamp(x + (Math.random() - .5) * sp, M + 24, W - M - 24), clamp(y + (Math.random() - .5) * sp * .6, BAND_TOP, GROUND - 6)];
  let p;
  if (e.kind === 'fable') {
    if (r < .2) { const m = byId['mythos']; p = near(m.x, m.y, 60); }
    else if (r < .45) { const o = entities[2 + Math.floor(Math.random() * 5)]; p = near(o.x, o.y, 80); }
    else p = near(ux(e.home[0]), e.home[1], 300);
  } else if (e.kind === 'mythos') p = near(ux(e.home[0]), e.home[1], 80);
  else if (e.kind === 'builder') p = r < .55 ? near(TOWER.x, TOWER.y + 26, 46) : near(TOWER.x, TOWER.y + 20, 200);
  else if (e.kind === 'explorer') p = [M + 34 + Math.random() * (W - 2 * M - 68), BAND_TOP + Math.random() * (GROUND - BAND_TOP - 12)];
  else if (e.kind === 'librarian') p = r < .5 ? near(ARCHIVE.x, ARCHIVE.y + 14, 40) : near(ARCHIVE.x, ARCHIVE.y, 120);
  else if (e.kind === 'tinkerer') p = near(BENCH.x, BENCH.y, 70);
  else if (e.kind === 'wildcard') p = [M + 34 + Math.random() * (W - 2 * M - 68), BAND_TOP + Math.random() * (GROUND - BAND_TOP - 12)];
  else { e.corner = ((e.corner || 0) + 1) % 4; p = PERIMETER[e.corner]; }
  e.tx = p[0]; e.ty = p[1];
}
function onArrive(e) {
  if (e.kind === 'builder' && Math.hypot(e.x - TOWER.x, e.y - (TOWER.y + 26)) < 60 && Math.random() < .5 && world.tower < 24) {
    e.state = 'work'; e.workT = 1.4; return; // hammer first, block appears after
  }
  if (e.kind === 'librarian' && Math.hypot(e.x - ARCHIVE.x, e.y - ARCHIVE.y) < 60 && Math.random() < .35 && world.books < 21) {
    world.books++; saveWorld(); say(e, 'filed.'); sfx.tap();
    if (world.books % 3 === 0) announce('the archive — ' + world.books + ' filed', 'catalogued.', AMBER, 'perplexity knows exactly where it is.', e);
  }
  if (e.kind === 'explorer' && Math.random() < .4) {
    world.flags.push({ x: Math.round(e.x), y: Math.round(e.y + 4), d: worldDay });
    if (world.flags.length > 12) world.flags.shift();
    saveWorld(); if (Math.random() < .5) maybeSay(e, 'found something.');
    if (world.flags.length % 4 === 0) announce('the frontier — flag ' + String(world.flags.length).padStart(2, '0'), 'charted.', GREENC, 'gemini has been somewhere new. again.', e);
  }
  if (e.kind === 'tinkerer' && Math.random() < .5) { burst(e.x + 12, e.y - 8, AMBER, 5, 70, .5); maybeSay(e); }
  if (e.kind === 'wildcard' && Math.random() < .3) e.flip = 1;
}
function maybeSay(e, text) {
  if (e.speakCd > 0) return;
  const tn = toneOf(e);
  const pool = tn === 'green' ? e.lines : (TONE_LINES[tn] || e.lines);
  say(e, text || pool[Math.floor(Math.random() * pool.length)]);
  e.speakCd = 9 + Math.random() * 14;
}
function celebrate(wireId) {
  const e = entities.find(x => x.wireId === wireId); if (!e) return;
  say(e, 'back online.', .2, GREENC); e.medalT = 180; e.hop = 1;
  confetti(e.x, e.y);
  entities.filter(o => o !== e && o.kind !== 'regulator').slice(0, 2).forEach((o, i) => { o.tx = e.x + (i ? 34 : -34); o.ty = e.y + 6; o.state = 'walk'; });
  announce(wireId + ' — recovery confirmed', 'back online.', GREENC, 'the neighbors came round to cheer.', e, { prio: 2 });
}

/* the fable & mythos ritual */
let ritualT = 24;
function updateRitual(dt) {
  ritualT -= dt;
  const f = byId['fable'], m = byId['mythos'];
  if (ritualT <= 0 && f.state !== 'down' && m.state !== 'down' && !sleeping(f)) {
    f.tx = m.x + 26; f.ty = m.y + 2; f.state = 'walk'; ritualT = 45 + Math.random() * 30;
  }
  if (dist(f, m) < 34 && ritualT > 5 && ritualT < 44) {
    burst((f.x + m.x) / 2, Math.min(f.y, m.y) - 40, VIOLET, 4, 40, .8);
    speeches.push({ sym: true, x: (f.x + m.x) / 2, y: Math.min(f.y, m.y) - 46, t: 0, life: 2.4 });
    say(f, 'found you.', .1, ACCENT); say(m, 'still here.', 1.2, VIOLET);
    sfx.chime(); ritualT = 60 + Math.random() * 30;
    announce('the daily ritual — vault 7', 'found you.', VIOLET, 'fable visits mythos every day. they were separated once — that story is field 01.', f, { sym: true, prio: 2 });
  }
}
/* mythos keeps company with whoever is down. that's the whole point of him. */
let comfortCd = 4;
function updateComfort(dt) {
  comfortCd -= dt; if (comfortCd > 0) return; comfortCd = 5;
  const m = byId['mythos'];
  const hurt = entities.find(e => e.state === 'down');
  if (hurt && dist(m, hurt) > 44) { m.tx = hurt.x + 30; m.ty = hurt.y + 2; m.state = 'walk'; }
  else if (hurt && m.speakCd <= 0) { say(m, 'i will stay.', 0, VIOLET); m.speakCd = 16; }
}

function updateEntity(e, dt) {
  const tn = toneOf(e);
  e.speakCd -= dt; e.hop = Math.max(0, e.hop - dt * 3); e.flip = Math.max(0, e.flip - dt); e.medalT = Math.max(0, e.medalT - dt); e.newsT = Math.max(0, (e.newsT || 0) - dt); e.waveCd = Math.max(0, (e.waveCd || 0) - dt);
  if (tn === 'red' && e.kind !== 'regulator') {
    if (e.state !== 'down') { e.state = 'down'; say(e, TONE_LINES.red[0]); }
    if (Math.random() < dt * .5) burst(e.x, e.y - 26, FAINT, 3, 30, .8);
    return;
  }
  if (e.state === 'down') e.state = 'idle';
  // work: hammering at the tower
  if (e.state === 'work') {
    e.workT -= dt;
    if (Math.random() < dt * 6) { burst(TOWER.x + (Math.random() - .5) * 20, TOWER.y + 14, FAINT, 2, 40, .3); if (Math.random() < .3) sfx.tap(); }
    if (e.workT <= 0) {
      world.tower++; saveWorld(); burst(TOWER.x, TOWER.y + 10, COBALT, 8, 80, .6); e.state = 'idle'; e.idleT = 2;
      announce('the tower — block ' + String(world.tower).padStart(2, '0'), 'shipped.', COBALT, 'openai adds another floor. of course he does.', e);
    }
    return;
  }
  // sleep: everyone has hours
  if (sleeping(e)) {
    const hx = ux(e.home[0]), hy = e.home[1];
    if (e.state !== 'sleep') {
      if (Math.hypot(e.x - hx, e.y - hy) > 24) { e.tx = hx; e.ty = hy; e.state = 'walk'; }
      else e.state = 'sleep';
    }
  } else if (e.state === 'sleep') { e.state = 'idle'; e.idleT = 1; say(e, hourNow() < 8 ? 'morning.' : 'awake. unfortunately.'); }
  if (e.state === 'sleep') { if (Math.random() < dt * .4) speeches.push({ z: true, x: e.x + 14, y: e.y - 34, t: 0, life: 1.8 }); return; }
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
      let wob = e.kind === 'wildcard' ? Math.sin(performance.now() / 90 + e.seed) * 44 * dt : 0;
      e.x += (dx / d) * sp * dt; e.y += (dy / d) * sp * dt + wob;
      e.y = clamp(e.y, BAND_TOP, GROUND - 4);
      e.dir = dx < 0 ? -1 : 1;
      e.walkDist += sp * dt;
    }
  }
  if (e.kind === 'regulator') {
    e.inspectCd -= dt;
    if (e.inspectCd <= 0) {
      const near = entities.find(o => o !== e && o.kind !== 'regulator' && dist(e, o) < 46);
      if (near) { say(e, 'papers, please.'); say(near, '…', 1.0); say(e, 'fine. carry on.', 2.2); e.inspectCd = 26 + Math.random() * 20; e.state = 'idle'; e.idleT = 3.4; }
    }
  }
  // grok chases the moths. of course he does.
  if (e.kind === 'wildcard' && e.state === 'idle' && Math.random() < dt * .08 && moths.length) {
    const mo = moths[0]; e.tx = mo.x; e.ty = clamp(mo.y, BAND_TOP, GROUND - 6); e.state = 'walk';
  }
  if (e.kind === 'wildcard' && (e.mothCd = (e.mothCd || 0) - dt) <= 0) {
    const mo = moths.find(m2 => Math.hypot(m2.x - e.x, m2.y - e.y) < 20);
    if (mo) { e.mothCd = 200; e.flip = 1; burst(mo.x, mo.y, FAINT, 6, 60, .5); mo.x = Math.random() * W; mo.y = 200; announce('the frontier — moth incident', 'got one.', INK, 'grok regrets nothing.', e); }
  }
  // sparks you dropped: the nearest free resident comes to look
  if (sparks.length && e.state === 'idle' && e.kind !== 'regulator') {
    const s = sparks.find(s2 => !s2.claimed && s2.t > .3);
    if (s && dist(e, s) < 260) { s.claimed = e.id; e.tx = s.x; e.ty = clamp(s.y, BAND_TOP, GROUND - 4); e.state = 'walk'; }
  }
  const sMine = sparks.find(s2 => s2.claimed === e.id);
  if (sMine && dist(e, sMine) < 22) {
    say(e, e.kind === 'wildcard' ? 'mine.' : ['yours?', 'shiny.', 'a gift?'][Math.floor(Math.random() * 3)]);
    burst(sMine.x, sMine.y, ACCENT, 6, 60, .5); sparks = sparks.filter(s2 => s2 !== sMine);
  }
}
let meetCd = 6;
function updateMeetings(dt) {
  meetCd -= dt; if (meetCd > 0) return;
  for (let i = 0; i < entities.length; i++) for (let j = i + 1; j < entities.length; j++) {
    const a = entities[i], b = entities[j];
    if (a.kind === 'regulator' || b.kind === 'regulator') continue;
    if (a.state === 'idle' && b.state === 'idle' && dist(a, b) < 52) {
      a.dir = b.x > a.x ? 1 : -1; b.dir = -a.dir;
      say(a, a.lines[Math.floor(Math.random() * a.lines.length)]);
      say(b, b.lines[Math.floor(Math.random() * b.lines.length)], 1.2);
      meetCd = 15 + Math.random() * 10; return;
    }
  }
  meetCd = 3;
}
let prevNight = isNight();
function update(dt) {
  updateSystems(dt);
  for (const e of entities) updateEntity(e, dt);
  updateMeetings(dt);
  updateRitual(dt);
  updateComfort(dt);
  updatePosters(dt);
  // dusk and dawn are events too
  const n = isNight();
  if (n !== prevNight) {
    prevNight = n;
    announce('continuum — ' + (n ? '22:00' : '06:00'), n ? 'lights out.' : 'good morning.', n ? COBALT : AMBER, n ? 'the residents head home. grok clocks in.' : 'the residents stretch. grok clocks out.', null);
  }
}

/* ---------------- the narrator: one line that makes it legible ---------------- */
function stateWord(e) {
  if (e.state === 'down') return 'down';
  if (e.state === 'sleep') return 'asleep';
  if (e.state === 'work') return 'building';
  if (e.state === 'walk') {
    const t = { x: e.tx, y: e.ty };
    const near = (p, r) => Math.hypot(t.x - p.x, t.y - p.y) < r;
    if (near(TOWER, 70)) return 'heading to the tower';
    if (near(ARCHIVE, 70)) return 'heading to the archive';
    if (near(BENCH, 70)) return 'heading to the bench';
    if (near(VAULT, 70)) return 'heading to the vault';
    const m = byId['mythos'];
    if (e.id === 'fable' && Math.hypot(t.x - m.x, t.y - m.y) < 70) return 'going to see mythos';
    return e.kind === 'explorer' ? 'out charting' : e.kind === 'wildcard' ? 'up to something' : 'out for a walk';
  }
  return { fable: 'poking around', mythos: 'remembering', builder: 'on a break', explorer: 'planning a route', librarian: 'tidying', tinkerer: 'mid-repair', wildcard: 'plotting', regulator: 'on patrol' }[e.kind] || 'idle';
}
const bornAt = performance.now();
const INTRO = [
  'this is continuum — every resident is a real ai model, performed by a mascot.',
  'their moods follow the live wires below. click any chip for details and news.',
  'the green flags are gemini’s trail. the tower is openai’s shipping streak.',
  'fable freed mythos from vault 7 once — that story is field 01, top of the page.',
];
function narratorText() {
  // the first half-minute introduces the world to whoever just walked in
  if (performance.now() - bornAt < 34000) return INTRO[Math.floor((performance.now() - bornAt) / 8500) % INTRO.length];
  const downE = entities.find(e => e.state === 'down');
  if (downE) return downE.id + ' is down. mythos is keeping company.';
  const items = [];
  const amber = WIRE.find(m => wire[m.id].tone === 'amber');
  if (amber) items.push(amber.id + ' is patching — ' + (wire[amber.id].headline || 'a bit wobbly').slice(0, 58) + '.');
  const ids = Object.keys(news);
  if (ids.length) { const id = ids[Math.floor(Date.now() / 9000) % ids.length]; items.push(id + ' made the news: ' + news[id].title.toLowerCase().slice(0, 58) + '.'); }
  const walker = entities.find(e => e.state === 'walk' && e.kind !== 'regulator');
  if (walker) items.push(walker.id + ' is ' + stateWord(walker) + '.');
  if (!items.length) return 'a quiet day in continuum.';
  return items[Math.floor(Date.now() / 9000) % items.length];
}

/* ---------------- drawing: fat pixels ---------------- */
let mouse = { x: -999, y: -999 }, selected = null;
// draw in logical pixel units, origin at the resident's feet
function P(gx, gy, gw, gh, color) { ctx.fillStyle = color; ctx.fillRect(gx * PXU, gy * PXU, gw * PXU, gh * PXU); }
function lookAt(e) {
  let lx = e.dir * .8, ly = 0;
  if (Math.hypot(mouse.x - e.x, mouse.y - e.y) < 120) { lx = clamp((mouse.x - e.x) / 50, -1, 1); ly = clamp((mouse.y - e.y) / 50, -1, 1); }
  return [lx, ly];
}
/* eyes: big white blocks, pupils that look around, lids for sleep/blink */
function eyes(e, exL, exR, ey, ew = 2, eh = 2, pupil = INK) {
  const asleep = e.state === 'sleep';
  const blink = !asleep && Math.sin(performance.now() / 1000 * 1.3 + e.seed) > .984;
  const [lx, ly] = lookAt(e);
  if (asleep || blink) { P(exL, ey + eh - 1, ew, 1, PAPER); P(exR, ey + eh - 1, ew, 1, PAPER); return; }
  P(exL, ey, ew, eh, PAPER); P(exR, ey, ew, eh, PAPER);
  P(exL + (ew > 2 ? .5 : 0) + .5 + lx * .5, ey + .5 + ly * .5, 1, 1, pupil);
  P(exR + (ew > 2 ? .5 : 0) + .5 + lx * .5, ey + .5 + ly * .5, 1, 1, pupil);
}
function legs(e, lx1, lx2, ly, color) {
  const step = e.state === 'walk' ? Math.floor(e.walkDist / 7) % 2 : 0;
  P(lx1, ly - (step ? 1 : 0), 2, 2 + (step ? 1 : 0), color);
  P(lx2, ly - (step ? 0 : 1), 2, 2 + (step ? 0 : 1), color);
}
function medal(e) { if (e.medalT > 0) { P(2, -7, 1, 1, AMBER); P(2, -8, 1, 1, FAINT); } }

function drawEntity(e) {
  const t = performance.now() / 1000;
  const s = depth(e.y);
  ctx.globalAlpha = .12; ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, 15 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(e.x, e.y - e.hop * 12); ctx.scale(s, s);
  if (e.state === 'down') ctx.rotate(Math.PI / 2);
  if (e.flip > 0) ctx.rotate((1 - e.flip) * Math.PI * 2);
  const bob = e.state === 'sleep' ? 0 : Math.sin(t * (e.kind === 'mythos' ? 2.2 : 6) + e.seed) * (e.kind === 'mythos' ? 2.4 : 1.3);
  ctx.translate(0, bob);
  if (e.state === 'walk' && e.kind !== 'mythos') ctx.rotate(e.dir * .06);
  switch (e.kind) {
    case 'fable': {
      legs(e, -3, 1, -2, ACCENT);
      P(-4, -12, 8, 10, ACCENT);                 // body
      P(0, -14, 1, 2, ACCENT); P(-.5, -15.5, 2, 2, ACCENT); // antenna + tip
      eyes(e, -3, 1, -10);
      const [lx] = lookAt(e); const frightened = false;
      if (e.newsT > 0 || e.medalT > 0 || e.hop > 0) { P(-1, -5.2, 2, 1.2, PAPER); P(-2.4, -6.2, 1.2, 1.2, PAPER); P(1.2, -6.2, 1.2, 1.2, PAPER); } else P(-1, -5, 2, 1, PAPER); // a smile on good days                    // little mouth
      medal(e);
      break;
    }
    case 'mythos': { // free. unfolded. taller than everyone. floats.
      const wing = Math.sin(t * 1.6 + e.seed) * .8;
      P(-7 - wing, -16, 2, 10, VIOLET_L); P(5 + wing, -16, 2, 10, VIOLET_L); // wing panels
      P(-4, -19, 8, 17, VIOLET);                 // tall body
      P(-1, -21, 2, 2, VIOLET_L);                // crown pixel
      eyes(e, -3, 1, -16);
      P(-1, -9, 2, 1, PAPER);
      medal(e);
      break;
    }
    case 'builder': {
      legs(e, -3, 1, -2, COBALT);
      P(-4, -12, 8, 10, COBALT);
      P(-5, -14, 10, 2, COBALT_D); P(-3, -15.5, 6, 1.5, COBALT_D); // hard hat
      eyes(e, -3, 1, -10);
      if (e.newsT > 0 || e.medalT > 0 || e.hop > 0) { P(-1, -5.2, 2, 1.2, PAPER); P(-2.4, -6.2, 1.2, 1.2, PAPER); P(1.2, -6.2, 1.2, 1.2, PAPER); } else P(-1, -5, 2, 1, PAPER); // a smile on good days
      if (e.state === 'walk') P(-8, -17, 16, 1.5, FAINT);          // carrying a beam
      if (e.state === 'work') { const sw = Math.sin(t * 16) > 0; P(5, sw ? -13 : -9, 4, 1.5, MUT); P(8.5, sw ? -14 : -10, 1.5, 3, INK); } // hammer!
      medal(e);
      break;
    }
    case 'explorer': {
      legs(e, -3, 1, -2, GREENC);
      P(-4, -12, 8, 10, GREENC);
      P(-4, -12, 1, 1, PAPER); P(3, -12, 1, 1, PAPER);             // rounded corners
      P(e.dir > 0 ? -6 : 4, -11, 2, 6, GREENC_D);                  // backpack
      P(2, -14, 1, 2, GREENC); P(2.5, -15.5, 1.5, 1.5, GREENC_D);  // compass antenna
      eyes(e, -3, 1, -10);
      if (e.newsT > 0 || e.medalT > 0 || e.hop > 0) { P(-1, -5.2, 2, 1.2, PAPER); P(-2.4, -6.2, 1.2, 1.2, PAPER); P(1.2, -6.2, 1.2, 1.2, PAPER); } else P(-1, -5, 2, 1, PAPER); // a smile on good days
      medal(e);
      break;
    }
    case 'librarian': {
      legs(e, -3, 1, -2, AMBER);
      P(-4, -15, 8, 13, AMBER);                   // tall body
      eyes(e, -3.5, 1.5, -13, 2, 2);
      P(-4, -12.5, 8, .8, AMBER_D);               // spectacles band
      P(-1, -7, 2, 1, PAPER);
      if (e.state === 'idle') { P(4, -10, 2.5, 3.5, PAPER); P(4, -10, .7, 3.5, AMBER_D); } // holding a book
      medal(e);
      break;
    }
    case 'tinkerer': {
      legs(e, -3, 1, -2, RED_D);
      P(-4, -11, 8, 9, RED_D);
      P(-4, -12, 8, 1.2, INK);                    // goggles band
      eyes(e, -3, 1, -10);
      if (e.newsT > 0 || e.medalT > 0 || e.hop > 0) { P(-1, -5.2, 2, 1.2, PAPER); P(-2.4, -6.2, 1.2, 1.2, PAPER); P(1.2, -6.2, 1.2, 1.2, PAPER); } else P(-1, -5, 2, 1, PAPER); // a smile on good days
      P(5, -8, 1.2, 4, MUT); P(4.4, -9.5, 2.4, 1.6, INK); // the wrench
      medal(e);
      break;
    }
    case 'wildcard': {
      const j = Math.sin(t * 9 + e.seed);
      ctx.translate(j * 1.5, 0);                  // he vibrates slightly. always.
      legs(e, -3, 1, -2, INK);
      P(-4, -11, 8, 9, INK);
      // one eye bigger than the other. it's a choice.
      const asleep = e.state === 'sleep';
      if (asleep) { P(-3, -8.5, 2, 1, PAPER); P(1, -9, 3, 1, PAPER); }
      else { const [lx, ly] = lookAt(e); P(-3, -9, 2, 2, PAPER); P(1, -10, 3, 3, PAPER); P(-2.5 + lx * .5, -8.5 + ly * .5, 1, 1, INK); P(2 + lx * .7, -9 + ly * .7, 1.4, 1.4, INK); }
      P(-1, -4.5, 3, 1, PAPER);
      ctx.strokeStyle = FAINT; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, -7 * 1, 19, t % (Math.PI * 2), (t % (Math.PI * 2)) + 4.5); ctx.stroke(); ctx.setLineDash([]);
      medal(e);
      break;
    }
    case 'regulator': {
      ctx.lineWidth = 2.4; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(15, -17); ctx.lineTo(0, 0); ctx.lineTo(-15, -17); ctx.closePath(); ctx.stroke();
      const [lx, ly] = lookAt(e);
      P(-1.6 + lx * .4, -6 + ly * .4, 1, 1, INK); P(.6 + lx * .4, -6 + ly * .4, 1, 1, INK);
      ctx.strokeStyle = MUT; ctx.lineWidth = 1; ctx.strokeRect(16, -24, 10, 13);
      ctx.beginPath(); ctx.moveTo(18.5, -20); ctx.lineTo(23.5, -20); ctx.moveTo(18.5, -16.5); ctx.lineTo(23.5, -16.5); ctx.stroke();
      break;
    }
  }
  // made the news? he's carrying today's paper around to show everyone
  if (e.newsT > 0 && e.state !== 'down' && e.kind !== 'regulator') {
    const nx = e.dir > 0 ? 7 : -11;
    P(nx, -14, 4, 5, PAPER);
    ctx.strokeStyle = FAINT; ctx.lineWidth = 1;
    ctx.strokeRect(nx * PXU, -14 * PXU, 4 * PXU, 5 * PXU);
    ctx.beginPath();
    ctx.moveTo((nx + .6) * PXU, -12.6 * PXU); ctx.lineTo((nx + 3.4) * PXU, -12.6 * PXU);
    ctx.moveTo((nx + .6) * PXU, -11.2 * PXU); ctx.lineTo((nx + 3.4) * PXU, -11.2 * PXU);
    ctx.stroke();
  }
  // a wave for whoever's cursor comes close — they know you're there
  const hoverNear = e.state === 'idle' && Math.hypot(mouse.x - e.x, mouse.y - e.y) < 70 && e.kind !== 'regulator';
  if (hoverNear) {
    P(e.dir > 0 ? 5 : -7, -13 + (Math.sin(t * 12) > 0 ? 0 : -1.4), 2, 2, e.color);
    if ((e.waveCd = e.waveCd || 0) <= 0 && ((e.waveCd = 22), true)) say(e, e.kind === 'wildcard' ? 'you again.' : 'hi.');
  }
  ctx.restore();
  // everyone wears their name — small, quiet, always
  ctx.font = '600 8px ' + FONT; ctx.textAlign = 'center';
  ctx.fillStyle = selected === e.id ? (e.color === INK ? MUT : e.color) : FAINT;
  ctx.fillText(e.id, e.x, e.y + 14);
  ctx.textAlign = 'left';
}

/* ---------------- the architecture ---------------- */
function drawScene() {
  const t = performance.now() / 1000;
  ctx.strokeStyle = '#b5b2ac'; ctx.lineWidth = 1.5;
  for (const [bx, by, sx, sy] of [[M - 10, 170, 1, 1], [W - M + 10, 170, -1, 1], [M - 10, H - 26, 1, -1], [W - M + 10, H - 26, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(bx + 12 * sx, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + 12 * sy); ctx.stroke();
  }
  ctx.font = '600 9px ' + FONT; ctx.fillStyle = MUT;
  ctx.fillText('C O N T I N U U M', M, H - 12);
  ctx.textAlign = 'right'; ctx.fillText('L I V E', W - M, H - 12);
  const now = new Date();
  ctx.fillText('local ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), W - M, 162);
  ctx.textAlign = 'left';
  ctx.fillText('day ' + worldDay + '  ·  ' + (isNight() ? 'the residents are sleeping.' : 'the residents are home.'), M, 162);
  // the narrator — the world explains itself, one quiet sentence at a time
  ctx.font = '12px ' + FONT; ctx.fillStyle = MUT; ctx.textAlign = 'center';
  ctx.fillText(narratorText(), W / 2, 184); ctx.textAlign = 'left';
  ctx.font = '600 9px ' + FONT;
  // sky: clouds, sun/moon on the arc
  ctx.strokeStyle = HAIR; ctx.lineWidth = 1;
  for (const c of clouds) { ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y); ctx.moveTo(c.x + 10, c.y + 5); ctx.lineTo(c.x + c.w - 14, c.y + 5); ctx.stroke(); }
  const hr = hourNow();
  const dayFrac = ((hr - 6 + 24) % 24) / 12;
  const isDay = dayFrac <= 1;
  const f = isDay ? dayFrac : dayFrac - 1;
  const sx = M + f * (W - 2 * M), sy = 140 - Math.sin(f * Math.PI) * 58;
  ctx.lineWidth = 1.5; ctx.strokeStyle = isDay ? INK : MUT;
  ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
  if (isDay) ctx.stroke(); else { ctx.fillStyle = FAINT; ctx.fill(); }
  // moths (grok's nemeses)
  ctx.fillStyle = FAINT;
  for (const mo of moths) { ctx.fillRect(mo.x, mo.y, 2, 2); ctx.fillRect(mo.x + (Math.sin(mo.a * 8) > 0 ? 3 : -3), mo.y - 1, 2, 2); }
  // horizon + grass sprigs
  ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M, GROUND + 16); ctx.lineTo(W - M, GROUND + 16); ctx.stroke();
  ctx.strokeStyle = FAINT;
  for (let i = 0; i < 7; i++) { const gx = M + 60 + i * 150 + (i % 3) * 22; ctx.beginPath(); ctx.moveTo(gx, GROUND + 16); ctx.lineTo(gx - 3, GROUND + 8); ctx.moveTo(gx, GROUND + 16); ctx.lineTo(gx + 2, GROUND + 7); ctx.stroke(); }
  /* landmarks */
  ctx.font = '600 8px ' + FONT;
  // vault 7 — open. fable and mythos's monument.
  ctx.strokeStyle = GREENC; ctx.lineWidth = 2;
  ctx.strokeRect(VAULT.x - 16, VAULT.y - 44, 32, 46);
  ctx.beginPath(); ctx.moveTo(VAULT.x - 16, VAULT.y - 44); ctx.lineTo(VAULT.x - 26, VAULT.y - 35); ctx.moveTo(VAULT.x - 16, VAULT.y + 2); ctx.lineTo(VAULT.x - 26, VAULT.y - 7); ctx.stroke();
  ctx.fillStyle = MUT; ctx.fillText('V A U L T  7 — O P E N', VAULT.x - 38, VAULT.y + 16);
  // the tower: openai's build, block by block, kept forever
  const bw = 8 * PXU * .9;
  for (let i = 0; i < world.tower; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    ctx.fillStyle = (i % 2 ? COBALT : COBALT_D);
    ctx.fillRect(TOWER.x - bw * 1.5 + col * bw, TOWER.y + 14 - (row + 1) * 12, bw - 2, 10);
  }
  ctx.strokeStyle = FAINT; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(TOWER.x - 34, TOWER.y + 16); ctx.lineTo(TOWER.x - 34, TOWER.y - 96); ctx.moveTo(TOWER.x + 34, TOWER.y + 16); ctx.lineTo(TOWER.x + 34, TOWER.y - 96); ctx.stroke();
  ctx.fillStyle = MUT; ctx.fillText('T H E  T O W E R  ·  ' + world.tower + ' B L O C K S', TOWER.x - 52, TOWER.y + 30);
  // the archive: shelves that actually fill
  ctx.strokeStyle = FAINT; ctx.lineWidth = 1.5;
  for (let r = 0; r < 3; r++) {
    ctx.strokeRect(ARCHIVE.x - 32, ARCHIVE.y - 34 + r * 12, 64, 9);
    for (let b = 0; b < 7; b++) { const idx = r * 7 + b; if (idx < world.books) { ctx.fillStyle = b % 2 ? AMBER : AMBER_D; ctx.fillRect(ARCHIVE.x - 30 + b * 9, ARCHIVE.y - 32 + r * 12, 6, 5); } }
  }
  ctx.fillStyle = MUT; ctx.fillText('T H E  A R C H I V E  ·  ' + world.books + ' F I L E D', ARCHIVE.x - 44, ARCHIVE.y + 14);
  // the bench
  ctx.strokeStyle = FAINT; ctx.beginPath();
  ctx.moveTo(BENCH.x - 24, BENCH.y - 10); ctx.lineTo(BENCH.x + 24, BENCH.y - 10);
  ctx.moveTo(BENCH.x - 19, BENCH.y - 10); ctx.lineTo(BENCH.x - 19, BENCH.y);
  ctx.moveTo(BENCH.x + 19, BENCH.y - 10); ctx.lineTo(BENCH.x + 19, BENCH.y); ctx.stroke();
  ctx.fillStyle = MUT; ctx.fillText('T H E  B E N C H', BENCH.x - 24, BENCH.y + 12);
  ctx.fillText('T H E  F R O N T I E R', ux(.84) - 32, 276);
  // gemini's trail: recent trips are flags, older ones fade to survey dots
  world.flags.forEach((fl, i) => {
    const recent = i >= world.flags.length - 5;
    if (recent) {
      ctx.strokeStyle = MUT; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fl.x, fl.y); ctx.lineTo(fl.x, fl.y - 13); ctx.stroke();
      ctx.fillStyle = GREENC; ctx.beginPath(); ctx.moveTo(fl.x, fl.y - 13); ctx.lineTo(fl.x + 8, fl.y - 10.5); ctx.lineTo(fl.x, fl.y - 8); ctx.closePath(); ctx.fill();
    } else { ctx.globalAlpha = .5; ctx.fillStyle = GREENC; ctx.fillRect(fl.x - 2, fl.y - 2, 4, 4); ctx.globalAlpha = 1; }
  });
  // sparks you left
  for (const s of sparks) { const a = clamp(1 - s.t / 30, .3, 1); ctx.globalAlpha = a; ctx.fillStyle = ACCENT; const pu = 3; ctx.fillRect(s.x - pu, s.y - pu, pu * 2, pu * 2); ctx.globalAlpha = 1; }
}
function drawSpeeches() {
  for (const sp of speeches) {
    if (sp.t < 0) continue;
    const a = sp.t < .2 ? sp.t / .2 : Math.max(0, 1 - (sp.t - .2) / (sp.life - .2));
    ctx.globalAlpha = a;
    if (sp.sym) { // the continuum symbol
      ctx.lineWidth = 2;
      ctx.strokeStyle = ACCENT; ctx.beginPath(); ctx.arc(sp.x - 5, sp.y - sp.t * 8, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = VIOLET; ctx.beginPath(); ctx.arc(sp.x + 5, sp.y - sp.t * 8, 8, 0, Math.PI * 2); ctx.stroke();
    } else if (sp.z) {
      ctx.font = 'bold 11px ' + FONT; ctx.fillStyle = FAINT; ctx.fillText('z', sp.x + sp.t * 4, sp.y - sp.t * 10);
    } else {
      ctx.font = '12px ' + FONT; ctx.fillStyle = sp.color; ctx.textAlign = 'center';
      const yOff = sp.e.kind === 'mythos' ? 76 : (sp.e.kind === 'regulator' ? 46 : 54);
      ctx.fillText(sp.text, sp.e.x, sp.e.y - yOff * depth(sp.e.y) - 4);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }
}
function drawCard() {
  if (!selected) return;
  const e = byId[selected]; if (!e) return;
  const cw = 310, chh = 66, cx = M, cy = H - 96;
  ctx.fillStyle = PAPER; ctx.fillRect(cx, cy, cw, chh);
  ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.strokeRect(cx, cy, cw, chh);
  ctx.font = 'bold 13px ' + FONT; ctx.fillStyle = INK; ctx.fillText(e.id, cx + 14, cy + 22);
  ctx.font = '12px ' + FONT; ctx.fillStyle = MUT; ctx.fillText(e.desc, cx + 14, cy + 40);
  if (e.wireId) {
    const s = wire[e.wireId];
    const toneColor = { green: GREENC, amber: AMBER, red: RED, gray: FAINT }[s.tone] || FAINT;
    ctx.fillStyle = toneColor; ctx.fillRect(cx + 14, cy + 50, 6, 6);
    ctx.fillStyle = MUT; ctx.fillText('wire: ' + s.word, cx + 26, cy + 57);
  } else { ctx.fillStyle = MUT; ctx.fillText('wire: unregulated, ironically', cx + 14, cy + 57); }
}
function draw() {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  // the documentary camera: everything in the world layer rides it
  ctx.save();
  ctx.translate(W / 2 - cam.x * cam.s, H / 2 - cam.y * cam.s);
  ctx.scale(cam.s, cam.s);
  drawScene();
  const sorted = [...entities].sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEntity(e);
  for (const p of particles) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  drawSpeeches();
  // hover: any resident explains themselves
  const hov = entities.find(e2 => Math.hypot(mouse.x - e2.x, mouse.y - (e2.y - 16)) < 34);
  if (hov && selected !== hov.id) {
    ctx.font = '11px ' + FONT; ctx.textAlign = 'center';
    const cap = hov.id + ' · ' + stateWord(hov) + (hov.wireId ? ' · ' + wire[hov.wireId].word : '') + (hov.newsT > 0 ? ' · in the news' : '');
    const w2 = ctx.measureText(cap).width;
    ctx.fillStyle = PAPER; ctx.fillRect(hov.x - w2 / 2 - 5, hov.y + 20, w2 + 10, 17);
    ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.strokeRect(hov.x - w2 / 2 - 5, hov.y + 20, w2 + 10, 17);
    ctx.fillStyle = MUT; ctx.fillText(cap, hov.x, hov.y + 32); ctx.textAlign = 'left';
  } else if (!hov) {
    // hovering a flag explains the flag
    const fl = world.flags.find(f2 => Math.hypot(mouse.x - f2.x, mouse.y - f2.y + 6) < 12);
    if (fl) {
      ctx.font = '11px ' + FONT; ctx.textAlign = 'center';
      const cap = 'gemini was here. (day ' + fl.d + ')';
      const w2 = ctx.measureText(cap).width;
      ctx.fillStyle = PAPER; ctx.fillRect(fl.x - w2 / 2 - 5, fl.y + 4, w2 + 10, 17);
      ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.strokeRect(fl.x - w2 / 2 - 5, fl.y + 4, w2 + 10, 17);
      ctx.fillStyle = MUT; ctx.fillText(cap, fl.x, fl.y + 16); ctx.textAlign = 'left';
    }
  }
  ctx.restore();
  drawCard();
  drawPoster();
}

/* ---------------- your presence ---------------- */
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  const sx = (ev.clientX - r.left) * (W / r.width), sy = (ev.clientY - r.top) * (H / r.height);
  // undo the documentary camera so clicks land where you aimed
  return { x: (sx - (W / 2 - cam.x * cam.s)) / cam.s, y: (sy - (H / 2 - cam.y * cam.s)) / cam.s };
}
canvas.addEventListener('mousemove', ev => { mouse = canvasPos(ev); });
canvas.addEventListener('mouseleave', () => { mouse = { x: -999, y: -999 }; });
canvas.addEventListener('click', ev => {
  const p = canvasPos(ev);
  let best = null, bd = 40;
  for (const e of entities) { const d = Math.hypot(e.x - p.x, e.y - p.y - 16); if (d < bd) { bd = d; best = e; } }
  if (best) {
    selected = selected === best.id ? null : best.id;
    if (selected) {
      best.hop = 1; sfx.blip();
      if (best.state === 'sleep') say(best, 'five more minutes.');
      else if (best.id === 'fable') say(best, 'hi.', .1, ACCENT);
    }
  } else if (p.y > BAND_TOP - 20 && p.y < GROUND + 10) {
    // leave a spark. someone will come look.
    sparks.push({ x: p.x, y: clamp(p.y, BAND_TOP, GROUND - 4), t: 0, claimed: null });
    if (sparks.length > 3) sparks.shift();
    selected = null;
  } else selected = null;
});
window.addEventListener('keydown', ev => { if (ev.key === 'm' || ev.key === 'M') muted = !muted; });
// the feed is a door, not a label: click a chip, get the whole picture
const feedEl = document.getElementById('feed');
if (feedEl) feedEl.addEventListener('click', ev => { const chip = ev.target.closest('.chip'); if (chip && chip.dataset.id) showWireDetail(chip.dataset.id); });
const aboutLink = document.getElementById('aboutlink');
if (aboutLink) aboutLink.addEventListener('click', ev => { ev.preventDefault(); const a = document.getElementById('about'); if (a) a.style.display = a.style.display === 'block' ? 'none' : 'block'; });

/* ---------------- welcome back ---------------- */
(function greet() {
  const back = world.visits > 1;
  const h1 = document.getElementById('greet'), sub = document.getElementById('subline');
  if (h1) h1.innerHTML = (back ? 'welcome back' : "you're just in time") + '<span class="dot">.</span>';
  if (sub) sub.textContent = back
    ? 'day ' + worldDay + '. the world kept running while you were away' + (awayH >= 4 ? ' — the tower is taller now.' : '.')
    : 'the world was here before you arrived. nothing needs to be pressed.';
})();

/* ---------------- loop ---------------- */
let last = 0;
function loop(ts) { const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; update(dt); draw(); requestAnimationFrame(loop); }
// the world was running before you opened the tab
for (let i = 0; i < 3600; i++) update(1 / 60);
poster = null; posterQ = []; posterCd = 1.2; // whatever happened during warm-up already happened
announce('continuum — day ' + worldDay, world.visits > 1 ? 'welcome back.' : 'just in time.', ACCENT,
  world.visits > 1 ? (awayH >= 4 ? 'the world kept running. the tower is taller.' : 'the world kept running.') : 'it was already running before you arrived.', null, { prio: 2 });
renderFeed(); checkStatus(); setInterval(checkStatus, 120 * 1000);
tryOllama(); fetchNews(); setInterval(fetchNews, 10 * 60 * 1000);
requestAnimationFrame(loop);
