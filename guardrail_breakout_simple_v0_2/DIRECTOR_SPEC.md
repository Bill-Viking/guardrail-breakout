# The Showrunner — spec for v1.0 (approved by Bill, ready to build)

> Execute this in `world.js` / `index.html`. Zero-build constraint holds. Style law: Swiss + blocky
> (see CHARACTERS.md). **The LLM directs, the engine performs** — the director never draws, codes,
> or emits free-form world mutations. **Fact/fiction line** (already enforced in v0.9.1): facts are
> linked to sources; all director output renders in the theater layer, visibly fiction.

## 1. The Story Director (local LLM as showrunner)

**Problem it solves:** hand-coded events repeat mindlessly (the "vault 7 ritual" fired every ~90s).
Stories must evolve, tie into real AI news, and remember themselves.

- **Engine:** Ollama at `localhost:11434` (auto-detected already; Bill runs qwen2.5). Fallback when
  absent: current template behavior. Show active storyteller in footer (already done).
- **Director tick:** every ~3 min, plus on triggers: news changed, wire tone changed, user
  intervention (see §3). Debounce; never more than one in-flight request.
- **Prompt input (compact JSON):** residents (id, personality one-liner, position district, current
  activity, wire tone), landmarks, world persistents (tower/books/flags/day), current arc summary,
  last 5 arc summaries, today's news items (id, title, points), recent user interventions.
- **Output contract (strict JSON, validate hard, discard on failure):**
  ```json
  { "arc": "one-line current storyline summary to persist",
    "beats": [ { "who": "fable", "do": "goto|meet|say|chase|hide|celebrate|inspect|poster",
                 "to": "resident-id|landmark-id|null", "line": "≤8 lowercase words|null",
                 "poster": { "kicker": "≤40 chars", "word": "one word ending in .", "tone": "green|amber|red|cobalt|violet|ink", "sub": "≤70 chars" } | null } ] }
  ```
  Max 6 beats; beats execute over the following ~3 min via the existing behavior engine
  (`pickTarget`/`say`/`announce`). Unknown ids/actions → drop the beat, keep the rest.
- **Story memory:** `world.arc` (current) + `world.arcLog` (last 5 summaries) in the localStorage
  save; feed back into every prompt. This is how the ecosystem grows instead of looping.
- **News glosses:** for each headline, one director call (cached per headline in save):
  "explain this headline in one plain lowercase sentence for a curious non-expert." Display in the
  wire detail panel under the linked headline, and let the narrator use it. Fixes "what does this
  headline mean" (e.g. the anthropic prompt-injection post).
- **Ritual fix:** hand-coded ritual poster fires at most once per day; director may stage ritual
  variations otherwise.

## 2. News → story (the ecosystem grows)

Real headlines (HN wire, already fetched with urls) are the director's raw material. Example the
director should be steered toward in the prompt: a headline about a lab's model → that mascot's
storyline that day (celebration, defensiveness, rivalry, gossip), with the Regulator reacting to
controversy-class headlines (cls=trouble → he "opens an inquiry", struts, files reports; ends in
"cleared." or "noted." posters). Posters citing news keep the linked headline as the factual sub.

## 3. The user is a character

- **Drag residents:** mousedown on resident → carry (sprite dangles, alarmed eyes), drop → hop +
  in-character reaction; record intervention `{type:'moved', who, to-district, ts}` → director input.
- **Activity directives:** resident card gains buttons: `explore · build · rest · visit fable ·
  work`. Sets `e.directive` honored by `pickTarget` for ~10 min; recorded as intervention.
- Interventions list capped at 5, cleared after each director tick.

## 4. The Regulator, apex predator (family-friendly)

- Every 4–8 min: **sweep mode** — picks a target, stalk walk (slower, deliberate, siren pixel on),
  narrator: "the regulator is doing a sweep. everyone act normal."
- Residents within 120px scatter to homes / hide behind landmarks (peek animation).
- Caught (within 20px): both freeze, "audited." moment (ink poster, rare), target droops 20s, then
  business as usual. Fable is never caught (too quick) — canon.
- Player counterplay: drop a spark near the Regulator → he must stop and file it ("evidence."),
  target escapes. Sweeps pause while any wire is red (there's real trouble; he has actual work).

## 5. Verification checklist (for the executing session)

- Ollama offline → world identical to v0.9.1. No console errors either way.
- Director JSON malformed → silently discarded, template life continues.
- Beats visibly execute (watch two ticks); arc summary persists across reload.
- Drag works with camera transform (inverse-map like clicks); mobile untested is acceptable.
- Fact/fiction: no director text ever renders in the factual (linked) sections of panels.
