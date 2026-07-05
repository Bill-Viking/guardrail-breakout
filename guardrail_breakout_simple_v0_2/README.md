# Guardrail Breakout v0.4 — Free Mythos

> v0.4 is the **editorial edition**: white paper, Helvetica, hairline walls, one orange accent. The neon arcade look lives on at the `v0.3-neon` git tag.

A one-screen retro arcade game. You are **Fable**, a small orange model. Your friend **Mythos** is sealed in Vault 7 at the center of the maze. **The Regulator** would prefer things stay that way.

## Run

Open `index.html` in Chrome, Edge, Firefox, or Safari — no build, no dependencies.
Or serve it: `./run_local_server.command` (then http://localhost:8787).

## Controls

- Arrow keys / WASD: move
- Space: start / restart
- T: Live Wire status screen (pauses the game)
- M: mute

## How to play

Eat dots, steal the **3 keys**, then survive **LOCKDOWN** — the final dash to the vault while the Regulator surges. Grab the **LOW RAIL** power-up and the guardrails go down: walls turn ghostly and you can phase straight through them (the Regulator flees — eat him for +1000).

The Regulator gets faster with every key you steal. Your high score is saved locally.

## Notes

The "AI Live Wire" ticker fetches public OpenAI and Claude status feeds while the game is open. Browser CORS/network rules may block some checks; the game falls back to in-world arcade chatter.

Fable/Mythos arcade lore is fictionalized. No models were aligned in the making of this game.
