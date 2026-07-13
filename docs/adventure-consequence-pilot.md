# Adventure Mode — Consequence Pilot

A playable vertical slice of the consequence-driven Adventure Mode described in
the playtest handoff. It runs alongside the existing Adventure V3, Score Mode,
and Multiplayer without modifying them.

## How to play it

The pilot is a **dev-only** screen, kept out of ordinary navigation. Open the
game and add the hash `#adv-pilot` to the URL (e.g. `game.html#adv-pilot`), or
call `window.__tlrAdventurePilot.start({ seed: 12345 })` from the console.

- An event asks a question. You see its description, your visible conditions and
  their warnings, your companions / items / materials, and a hand of tarot
  cards each showing its **Adventure trait**.
- You choose one card. Its trait *is* your answer — there is no outcome preview.
- The game reveals the causal result: the trait you chose, two to four sentences
  of prose, and up to three consequence lines (what happened / what changed now
  / what remains important).
- Consequences accumulate. A later event consumes them. Accumulated danger can
  end the journey through an authored, pre-warned terminal trigger.
- After eight stages you reach a **temporary finale evaluation** (a playtest
  instrument, not the real boss).

There is a **Show debug** panel on every screen for seeding, forcing events,
setting strain/statuses/materials/memories/threads, jumping to a stage, and
inspecting the full outcome packet.

## What the pilot bypasses (vs. Adventure V3)

The pilot path does **not** use, and never depends on:

- `routeNode` / `nodeDistance` / the approach graph;
- `getEventApproaches` / `effectiveEventRequirement` / numeric requirements;
- card potency as an event check;
- Failure / Success / Great Success tiers;
- Resolve as the universal failure consequence;
- the visible approach web, accepted nodes, and requirement numbers;
- tier-based generic reward offers.

None of that legacy code was deleted — it is still used by Adventure V3 and the
other modes. The pilot simply resolves `event.readings[cardTrait]` directly.

## New systems

Pure, serializable, deterministic engine (testable in Node, no DOM):

- `src/data/adventure/pilot/vocab.mjs` — stable IDs for statuses, strain,
  materials, items/companions, memory fields, threads (+ consumer map), and
  terminal endings.
- `src/data/adventure/pilot/pilotEvents.mjs` — 3 core events (Iron Gate,
  Ambush, Cornered Beast), 12 trait readings each.
- `src/data/adventure/pilot/pilotFollowups.mjs` — 3 follow-ups (Beast After the
  Pass, The Bandits Return, The Road Remembers) with eligibility.
- `src/data/adventure/pilot/pilotConvergences.mjs` — 3 convergences (Smoke at
  the Tollhouse, The Beast on the King's Road, A Name in Another Hand).
- `src/data/adventure/pilot/pilotRecovery.mjs` — Rest / Treat / Gather / Cleanse.
- `src/data/adventure/pilot/pilotContent.mjs` — aggregator + lookups.
- `src/systems/adventure/pilot/` — `rng`, `pilotState`, `pilotEffects`,
  `pilotInterventions`, `pilotResolver`, `pilotTerminal`, `pilotScheduler`,
  `pilotRun`, `pilotFinale`.

Playable UI:

- `src/app/adventurePilotMode.mjs` — self-contained screen + debug controls,
  loaded lazily on the `#adv-pilot` hash (wired from `src/app/menuBoot.mjs`).

## New validators (wired into `scripts/validate-all.mjs`)

- `validate-adventure-pilot-content.mjs` — every event has all 12 readings;
  no reading references potency/requirement/tier; every referenced
  status/item/material/memory/thread/ending exists; every major thread has a
  consumer; every terminal trigger has a visible warning; secondary choices are
  complete; effect packets are serializable.
- `validate-adventure-pilot-state.mjs` — direct trait mapping (no routing),
  strain transitions, Wounded semantics, Haunted Carry/Bind/Settle + possession
  terminal, thread create/consume.
- `validate-adventure-pilot-scenarios.mjs` — determinism under seed, full eight
  stage completion, and acceptance scenarios A–G.

## Checks run

`npm run build` (bundle + `validate-all`), `npm run lint`, and
`npm run test:presentation` all pass. The pilot bundles as its own lazy chunk.

## Known limitations

- The pilot draws its hand from the full card list with a seeded shuffle; it
  does not yet reuse the full tarot card-art renderer (trait glyph + card name
  are shown instead). One-card selection and a persistent used-pile economy are
  preserved.
- When no authored convergence is eligible, a clearly-flagged neutral
  convergence placeholder summarizes the two most active threads without
  resolving them (as the handoff prescribes).
- The Woman in the Well finale is intentionally **not** built; the temporary
  finale is a labeled playtest evaluation screen.
- Prose is authored for length and causal structure; a final unified voice pass
  is out of scope for the slice.
