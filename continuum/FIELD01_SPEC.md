# Field 01 remaster — "the vault run" brought up to the world's standard

> Bill, Jul 11: "rebuild the video game... some parts of it are flat, like the bars and
> stuff." Scope ruling: the GAMEPLAY is fine (collect 3 keys, dodge the regulator, open
> the vault) — this is a visual/feel remaster, not a redesign. The law: field 01 must
> look and feel like the SAME world as the terrarium, just arcade. Zero-build holds;
> one file (game.js) + game.html styles; Swiss + blocky (CHARACTERS.md); no neon,
> no screen-shake — Swiss juice only.

## What's flat today (diagnosis from a live look)
- Wall blocks: single-color pale rects, no depth, on a washed-out hairline grid.
- The vault: its bars are flat lines; opening it — the game's WHOLE POINT — has no moment.
- Attract/standby: the field renders at such low alpha it looks broken, not idle.
- HUD: plain text ("keys 00/03", score) — no shape, no state.
- Cast sprites predate the terrarium's current drawEntity language.

## The remaster
1. **Depth without gradients.** Every wall unit gets the terrarium's fat-pixel treatment:
   face color + one darker bottom/side edge pixel + one lighter top edge — blocky relief,
   ink-family on paper. Kill or fade the background grid to near-nothing; the walls ARE
   the structure. (This is "the bars and stuff".)
2. **The cast, current-generation.** Port fable/the regulator (and mythos in the vault)
   to the terrarium's sprite language: looking pupils, step-animated legs, fable's
   antenna, the regulator's diamond + clipboard + siren pixel when hunting. Fable
   visibly CARRIES collected keys (they dangle behind him — count legible at a glance).
3. **The vault is the moment.** Proper bars with depth that visibly SLIDE as each key
   lands (three bars, one per key — the progress display IS the vault). On the third:
   bars retract, mythos unfolds (wings, crown pixel — his terrarium sprite), the
   continuum symbol (orange + violet circles), and a full poster card: "found you."
   This is the canon scene the whole project is built on — it deserves its staging.
4. **Swiss juice.** Key pickup: glint + a hop + HUD key-slot fills (three key-shaped
   slots, not "00/03" text). Regulator proximity: his siren pixel + fable's scared-eyes
   (both exist in world.js — port the drawing patterns). Direction changes: two dust
   pixels. Caught: the "audited." beat — freeze, droop, ink poster — not a bare reset.
5. **Attract mode that invites.** Standby = a readable title card (big lowercase title,
   one-line rules, "press any key"), with the field at half-alpha behind it and the
   regulator idly patrolling it. It should look intentional from across the room.
6. **Keep:** all mechanics, speeds, spawn logic, scoring, keys t/m, the back-to-the-world
   link, zero dependencies. This is paint and staging, not balance.

## Verification (house pattern)
osascript parse; live drive on the local server (game.html), play a full run: three keys
→ vault opens → mythos scene → score persists; standby card renders; no console errors;
side-by-side screenshot against the terrarium for family resemblance — they must read as
one hand.

## Art direction — ELEVATED (Bill, Jul 11: "be creative... special... extraordinary but
## still Swiss... environment impressive, characters stay, the auditor slick — make it pop")

Where this conflicts with the remaster list above, THIS wins. The discipline that makes
it pop: ink architecture, paper ground, and exactly four saturated colors, each meaning
one thing — orange = fable, amber = keys, violet = the vault/mythos, red = the siren.
Nothing else gets color. That restraint is the pop.

### The environment becomes architecture (the star of the upgrade)
1. **Light as material.** One consistent light direction for the whole field. Every wall
   slab casts a long flat diagonal shadow (ink at ~6% alpha, sharp-edged polygons —
   Müller-Brockmann diagonals, not soft blur). Walls are extruded slabs: lighter top
   face, ink front face, 1px corner highlights. The maze reads as a MODEL, not a grid.
2. **Typographic depth.** Deep background: a giant cropped lowercase "field 01" and a
   huge numeral, 3–4% ink, poster-scale, bleeding off-canvas. Field edges get faint
   survey coordinates (a–n across, 1–12 down) — the map gemini would draw. Crop marks
   and registration marks frame the composition.
3. **Parallax paper.** Three layers — deep type, maze, foreground marks — shifting 2–4px
   against player motion. Depth without 3D, felt not seen.
4. **Atmosphere, not neon.** Dust motes drifting along the light direction at ~3% alpha.
   The vault BREATHES: a slow violet radial glow, ~6% alpha, 4s period — soft light is a
   material here, glow-as-decoration stays banned. Keys sit in faint amber light pools.
5. **Fable's trail.** His path persists as fading accent-orange survey dots (30s fade) —
   beautiful AND functional: you can see where you've already been. Canon echo of the
   charting language.

### The auditor — the most animated thing in the project (license granted)
6. **He glides.** No walk cycle — he banks into turns (8° lean), with a 2-frame squash of
   anticipation before direction changes, and a wake of 2–3 trailing hairline ghost
   outlines at falling alpha. Slick means: motion you can read as intent.
7. **The lighthouse.** Hunting, his siren doesn't just blink — it casts a narrow rotating
   red sweep across the maze (low-alpha cone, sharp edges). You track the sweep to stay
   ahead of him. The telegraph IS the terror.
8. **Three readable modes, all body language:** PATROL — slow glide, siren off, narrow
   eyes scanning left-right, occasional stop to jot on the clipboard (fable's window to
   move — gameplay rhythm from character behavior). ALERT — full-body tilt-back "!"
   beat, siren snaps on. HUNT — leans 12° forward, +15% speed, pupils locked on fable,
   lighthouse sweeping.
9. **The catch:** 300ms freeze-frame (hitstop — the one arcade-juice exception; still no
   screen-shake, ever), then the "audited." scene from the base spec.
10. **Fable stays fable** — current sprite, scared-eyes near the auditor, keys dangling,
    dust pixels on turns. The characters are the constant; the world and the villain got
    the budget.

Build note: all of the above is flat canvas 2D — polygons, alpha, transforms; zero
dependencies, zero images. If a technique needs a texture, pre-render it once to an
offscreen canvas at boot (paper grain, the type layer) and blit — never per-frame.
