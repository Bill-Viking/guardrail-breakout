# HANDOFF — read this first in any new session

**Project:** Continuum — a living AI world (terrarium). This file is the session-independent
source of truth. If you are an AI session reading this: read `DIRECTOR_SPEC.md`, `CHARACTERS.md`,
and `README.md` next, then check `git log --oneline -10` for anything newer than this file.

## State as of Jul 8, 2026 (v2.0 tier 1 shipped)

SHIPPED and pushed to github.com/Bill-Viking/continuum-arcade (main):
- v0.x: the terrarium (blocky residents, persistence, posters, news wire, live status wire)
- v1.0 showrunner §1–§5: local-LLM director (Ollama; prefers largest model — Bill has
  qwen2.5:32b/7b/3b), news→story, drag residents + directives, Regulator sweeps
- v1.1 §6: one episode per day, three acts, pinned episode line, matinee keys
  (`shift+d` tick now, hold `shift+f` 30×) + Fable's review rulings applied
- v1.2 §7–§9: fear/avoidance + nosy probing Regulator; perplexity = model researcher
  (census already logged deepseek/qwen/kimi); local wire relay in `server.py`
  (built, secure — mistral/deepseek still expose nothing readable; honest "human page
  only" fallback stands for them). Server starts via `run_local_server.command` → `server.py`.
  **Jul 8: grok's wire is LIVE** — Bill found `status.x.ai/feed.xml` (rss, open, sends
  CORS!). Browser reads it directly everywhere, relay is the fallback; "via status feed"
  shown in the detail panel. First non-gray grok ever.
- Jul 6 (Fable session): **§10 discussed and RULED** — two-tier Continuum integration,
  rulings appended to DIRECTOR_SPEC.md ("§10 review rulings"). The reasoning project was
  read from source; Fable's external review + rev 1 amendments live in THAT repo
  (`/Users/bill/Projects/continuum/docs/EXTERNAL_REVIEW_FABLE5_V0_7_0_ALPHA_1.md`).
  Cross-project roles settled: Claude Code (Opus) builds Continuum — it has its own
  HANDOFF.md; GPT Codex is its read-only checker; Bill's GPT 5.5 Pro chat is strategy
  partner only. The two projects connect ONLY through committed files (journal export +
  local bridge per the rulings) — never shared code, never shared sessions.
- Jul 8 later (same Fable session): **v2.1 §11 SHIPPED — the archive answers.** A quiet
  footer command line: `ask <question>` (or bare text) → perplexity walks it to the archive,
  files it (a real book shelves), and an amber card reveals — wikipedia + hn sources linked
  as fact, a composed answer as marked gloss. `read <url>` → new guarded `GET /read` in
  server.py (SEPARATE from the §9 relay, which is untouched per §10 ruling 5): https/443
  only, all resolved addresses must be public (10 SSRF probes verified refused, redirects
  re-checked), text extracted server-side. Injection containment: fetched text never reaches
  the director, interventions, or the journal; research is its own RESEARCH_SYS call.
  Hotkeys ignore form-field keystrokes. `.claude/launch.json` now launches server.py (was
  stale pre-§9 http.server). Verified live: real ask ("who invented the transistor" →
  bardeen/brattain/shockley, linked), real read (wikipedia Transistor page), zero console
  errors. Spec: DIRECTOR_SPEC.md §11.
- Jul 8 (Fable session): **v2.0 §10 Tier 1 SHIPPED** — the journal (localStorage ring,
  cap 200, `ct_journal_v1`, full consumer-contract schema incl. model digest, sha256s,
  beat ids, fiction-domain marker), the evening judge pass (once/day after the resolution
  poster, validate-hard, ruling journaled with provenance, journal-only — no UI), the two
  footer doors ("download journal" JSONL / "export for continuum" legacy-import markdown),
  and the `?director=<model>` A/B override. Verified live with qwen2.5:32b: real exchange
  journaled, real judge ruling, ring cap + reload survival, and the markdown export was
  parsed by Continuum's OWN `parse_markdown_log` — 2/2 entries active, uuids preserved.
  Judge evidence spans = each contradiction must quote the offending line; full
  span-anchoring deferred to Tier 2 per the amendment's sequencing.

- Jul 8 night: **§12 partial + §13 drafted.** Shipped: engine-level anti-loop law (ambient
  posters once/day — "self-evolving, not looping" is Bill's stated law) + brave `/search`
  door in server.py (key-gated via gitignored `search_key.json`, fail-soft to wikipedia+hn)
  + from-memory fallback with explicit warning. Dropped: weather special-case (Bill).
  PENDING Bill: paste a Brave key (brave.com/search/api, free tier) into
  `continuum/search_key.json` as `{"brave":"<key>"}` — no restart needed; review §13
  (self-evolving terrarium: bonds, weekly foundations, chapter memory, census visitors) in
  DIRECTOR_SPEC.md; re-confirm or kill talk-to-residents (§12, spec'd, unbuilt).
  **Bigger thread from tonight: Bill is questioning the terrarium's purpose** ("drifting on
  why we need this"). Fable's read: its two honest identities are ambient art + Continuum's
  evidence instrument; the assistant lane is a dead end. The §10 round-trip with Continuum
  is the test that decides it. Don't pitch new features until that lands.

## Open threads (in priority order)

1. **Bill plays §6–§10** — http://localhost:8787 after `./run_local_server.command`.
   Judge: nervous residents around the Regulator, probing inspections, census section in a
   wire chip's detail panel, the day's episode line advancing act i → iii, and after an
   evening or two: the footer journal links (download + export).
2. **The Tier-1 round-trip with Bill (ruling 6):** export → drop the .md into Continuum's
   `logs/raw_conversations/` → Continuum imports and consolidates it. One manual round
   trip before calling Tier 1 done-done (the importer already parses our export — verified
   from source this session — but Bill should see the full loop once himself).
3. **§10 Tier 2 (live wake/outcome loop + server.py bridge):** ruled but GATED — build
   only after the round-trip above and Bill running Continuum's Mind Console locally.
   Also gated from the OTHER side: Continuum ingests nothing until its Experiment 03
   report closes, then 2–4 weeks tap-only observation (amendment sequencing).
4. Backlog ideas, unscheduled: GitHub Pages deploy; desktop/menu-bar wrap; visiting mascots
   from recurring census labs.

## Working protocol (Bill's rules)

- **One session at a time.** Close the rest. The repo is the memory; chats are disposable.
- **Opus 4.8 builds** from the spec (cheap). **Fable judges** taste and big pivots (expensive —
  Bill's weekly cap resets Jul 11; he was at ~16% on Jul 5. Fable only for reviews/direction).
- Always: commit per coherent piece with `Co-Authored-By: Claude <model> <noreply@anthropic.com>`,
  push to origin, keep the working tree clean at session end. Update this file when state changes.
- Style law: Swiss + blocky (CHARACTERS.md). Fact/fiction line: facts linked, theater labeled.
  The LLM directs, the engine performs. Pacing law: stillness default, ≤2 walkers.
  No neon / new visual elements without asking Bill first.

## Environment gotchas

- No `node`, no `gh`. Syntax-check: `osascript -l JavaScript world.js`
  (a `ReferenceError: Can't find variable: document` means it parsed fine).
- Port 8787 often held by another session's preview server — add a temp config on a free port.
- Preview tab hidden = `requestAnimationFrame` paused: drive tests via eval with
  `for(...) update(1/60); draw();` loops (see git history) or the headless JXA harness.
- Ollama at localhost:11434 works from the browser (CORS ok). qwen JSON needs `num_predict`
  headroom + the in-prompt example already in `DIRECTOR_SYS` — extend, never rewrite it.
- GitHub: account Bill-Viking, HTTPS credential in macOS keychain (git push just works).

## Paste-prompts for new sessions

**Opus build session:**
> Read continuum/HANDOFF.md and follow it. Then: <the one task>.
> Respect the working protocol and environment gotchas. Commit per piece, push, update HANDOFF.md.

**Fable review session:**
> Read continuum/HANDOFF.md. I want your judgment on: <the thing>.
> Don't build unless I say so; spec approved changes into DIRECTOR_SPEC.md for an Opus session.
