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
