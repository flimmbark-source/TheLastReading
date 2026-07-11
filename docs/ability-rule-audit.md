# Ability Rule Audit

This document records the gameplay contract that ability code, player-facing text, upgrades, and multiplayer replay must all follow.

## Source-of-truth order

1. `src/data/abilities.mjs` defines each base ability: type, base reveal/draw count, take count, and player-facing rule.
2. `abilityWithRevealUpgrades()` applies only the upgrades named in market text.
3. `abilityHeldCards()` determines which deck cards are eligible, in live deck order.
4. `buildAbilityChoiceAsync()` limits the eligible cards to the upgraded count before sorting them for presentation.
5. Multiplayer must submit and replay the same capped card set. It must not independently reinterpret the rule.
6. The Abilities reference drawer is generated from the canonical ability definitions rather than maintained as separate prose.

## Current contract

| Ability | Base behavior | Relevant upgrade |
| --- | --- | --- |
| Draw 1/2/3 | Draw the listed number. | Ritual Depth draws +1. |
| Peek 3/5 | Reveal the listed number from the top; take 1; put the rest on the bottom. | Lens Mastery reveals +1. |
| Search | Search the deck; take 1; shuffle the remainder. | None affecting reveal count. |
| Full Reset / Shuffle | Shuffle deck, discard, and hand; redraw. Cards already in the spread remain in place. | Ritual Depth increases the new hand size through the existing draw rule. |
| Neighbor | Choose a legal anchor; reveal up to 2 adjacent cards; take 1. Major adjacency is numerical. Court adjacency is by neighboring rank in the same suit. | Lens Mastery +1; Deeper Threads +1. |
| Kin | Choose a legal anchor; reveal up to 2 cards of the same Arcana; take 1. | Lens Mastery +1; Deeper Threads +1. |
| Mirror | Choose a legal anchor; reveal up to 2 opposite cards; take 1. Majors mirror across the 0–21 centerline. Courts mirror Page–King and Knight–Queen across all suits. | Lens Mastery +1. |
| Between | Choose two legal anchors of the same Arcana; reveal up to 2 cards strictly between them; take 1. | Deeper Threads +1. |

## Corrections from the July 10 audit

The earlier target-validity change correctly restored legal-target greying, but its audit did not reconcile every implementation choice against existing player-facing rules. The following discrepancies were identified:

- Mirror was changed to reveal every eligible Court match instead of its stated cap of 2.
- Mirror was removed from Lens Mastery even though the upgrade explicitly affected it.
- Reveal candidates were sorted before the cap was applied, changing which cards were revealed from live deck order.
- Multiplayer did not preserve an explicit canonical reveal set and could replay a different capped set.
- Multiplayer Full Reset constructed an order containing spread cards, even though spread cards must remain in place.
- The static Abilities reference contained stale wording separate from the actual definitions.
- Neighbor's public card/detail label was blank.

Regression tests now cover the base Mirror cap, upgraded Mirror count, deck-order capping, legal-target greying, canonical reference text, multiplayer reveal reconciliation, and Full Reset spread exclusion.
