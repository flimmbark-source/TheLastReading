# Adventure Mode — Prototype GDD v1.0

> Status: **frozen design doc** for the prototype. This is the spec the
> implementation tracks. Content tuning (card meanings, event text, balance
> numbers) lives in the data files and may change without changing systems.

## Overview

Adventure Mode is a narrative roguelite variant of The Last Reading. Players
progress through a sequence of **Events** rather than score thresholds. The
core tarot gameplay is unchanged — draw cards, use abilities, build a 5-card
spread, form scoring patterns, score the spread.

The spread's **score** decides whether the player succeeds. The cards in the
spread also generate **hidden meanings** that decide *which* outcome occurs.
Meanings are never shown to the player. The intended feeling is conducting a
reading, not solving a visible stat check.

## Design goals

- **Preserve existing gameplay.** The spread-building puzzle stays primary.
  "How do I make the strongest spread?" remains the question, not "which card
  does the designer want?"
- **Encourage discovery.** Players form theories about cards, statuses, and
  events through play.
- **Mystery over calculation.** Players recognise tendencies, not formulas.
- **Different, not better.** Outcome paths are trade-offs; none is strictly
  superior.
- **Explainable, not predictable.** Outcomes make sense afterward without being
  obvious beforehand.

## Core loop

```
Reveal Event → Build Spread → Resolve Score → Resolve Interpretation
→ Apply Outcome → Choose Reward → Next Event
```

## Run structure

```
Event → Event → Event → Recovery → Event → Event → Event → Boss → Victory
```

- 6 standard events, 1 recovery, 1 boss (full prototype target — **implemented**).
- The run draws 6 events from a pool of 10 (recovery falls after the third),
  then the three-phase boss, The Woman in the Well.

## Resolve

- Starting Resolve: **4**
- Maximum Resolve: **6**
- Reaching **0** ends the run.

## Reused systems (no changes required)

Deck building, draw, hand, spread, card abilities, scoring patterns, and the
scoring engine (`src/systems/scoring.mjs` via `computeScore`) are reused as-is.
Adventure Mode adds systems alongside them and never mutates Score Mode state.

## Event system

Each event has: title, description, target score, triumph score, traits,
outcome variants, and a failure outcome.

| Result  | Condition                       | Effect                                   |
| ------- | ------------------------------- | ---------------------------------------- |
| Failure | `score < targetScore`           | Lose 1 Resolve, apply failure outcome    |
| Success | `score >= targetScore`          | Apply interpretation outcome, gain reward |
| Triumph | `score >= triumphScore`         | Apply improved outcome, gain extra reward |

### Event traits

`HOSTILE`, `SOCIAL`, `OBSTACLE`, `TRAVEL`, `MYSTERY`, `SUPERNATURAL`. Traits are
read by statuses, relics, and resolution rules.

## Hidden interpretation system

Hidden from players: meaning values, categories, and calculations. Players only
ever observe outcomes (and, in dev builds, the debug panel).

### Meaning tags

`courage, fear, curiosity, compassion, authority, violence, persistence,
change, intuition, secrets`.

### Calculation (`calculateSpreadMeanings(spread, statuses)`)

1. Add bespoke per-card meanings (`CARD_MEANINGS`, keyed by card id).
2. Add suit defaults (minor/court cards).
3. Add court defaults (by rank).
4. Apply status modifications (e.g. Haunted amplifies supernatural axes).

Returns a `Record<MeaningTag, number>` with every tag present.

### Outcome selection

After a success, each outcome's weight is the sum of its `triggerMeanings`
values in the spread's meaning record. Highest weight wins; ties break by
declaration order.

## Status system

Statuses persist between events and prefer to modify *meanings* over raw
numbers.

| Status     | Prototype behaviour                                              |
| ---------- | --------------------------------------------------------------- |
| Haunted    | Amplifies supernatural meaning axes already in the spread        |
| Exposed    | Hostile failures cost +1 Resolve                                 |
| Prepared   | Reveals the next event (HUD)                                     |
| Distrusted | Disables the social triumph bonus                                |
| Blessed    | Next triumph grants one extra reward, then the status is removed |

## Rewards

Types: `ADD_CARD`, `REMOVE_CARD`, `RESTORE_RESOLVE`, `REMOVE_STATUS`,
`GAIN_RELIC`.

- Success: show 3, choose 1.
- Triumph: show 4, choose 2.

Relics/statuses adjust these counts (Traveler's Charm +1 success offer; Blessed
+1 triumph reward; Distrusted removes the social triumph bonus).

## Relics

Traveler's Charm, Lucky Coin, Lantern, Iron Ring, Prayer Beads. Adventure relics
are a separate catalogue from Score Mode relics and intentionally do not touch
the scoring formula.

## Recovery event

Occurs once (after event 3). No spread. Choose one: Restore 1 Resolve, Remove 1
Status, or Gain a Random Relic.

## Boss event — The Woman In The Well *(implemented)*

Three phases with target scores 24 / 30 / 36, each graded by the live engine
like any reading. The boss silently records the dominant meaning of each phase
(`recordBossPhase` → `bossInterpretationHistory`); after the third phase the
final outcome is chosen from the accumulated leanings (`resolveBossFinal`) —
mercy (compassion/intuition), force (violence/courage), or secrets
(secrets/fear/change). Failing a phase costs Resolve and re-deals that phase.

## Resolution presentation

1. Result + score (e.g. `Success 29 / 24`).
2. Narrative outcome (+ any status changes).
3. Reward choices.

## Developer tools

A dev-only debug panel renders the full hidden meaning record for the current
spread. It is gated by `isAdventureDebugEnabled()` (localhost / `__TLR_DEV__` /
`?advdebug=1`) and never renders in production. The player HUD is verified by
tests to never contain any meaning tag.

## File map

```
docs/adventure-mode-gdd.md            this document
src/game/gameMode.mjs                 GAME_MODES selector
src/data/adventure/interpretations.mjs meaning tags, card/suit/court values
src/data/adventure/statuses.mjs       status definitions + meaning hooks
src/data/adventure/relics.mjs         adventure relic catalogue
src/data/adventure/rewards.mjs        reward types + offer rules
src/data/adventure/events.mjs         event schema, 3 events + recovery
src/systems/adventure/meanings.mjs    calculateSpreadMeanings + helpers
src/systems/adventure/run.mjs         run state, resolution, rewards, recovery
src/ui/adventure/adventureHud.mjs     minimal HUD + dev debug panel
scripts/validate-adventure.mjs        node validation for the whole loop
```

## Success criteria (slice)

- Adventure Mode runs independently from Score Mode. ✓
- Events resolve correctly (failure/success/triumph). ✓
- Hidden meanings influence outcomes. ✓
- Rewards function. ✓
- Resolve loss and loss condition function. ✓
- Hidden meanings are debug-visible but player-hidden. ✓
- The boss can be completed; its ending reflects the run's accumulated meanings. ✓
- The deck persists and evolves across a run (ADD_CARD / REMOVE_CARD). ✓
