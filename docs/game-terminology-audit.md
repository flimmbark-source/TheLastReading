# Mechanical-language audit

Generated from the branch before copy migration. This inventory is diagnostic; fiction and source documents are reviewed separately rather than bulk-replaced.

## Canonical vocabulary

- **Chips**
- **Mult**
- **Score**
- **Threshold**
- **Reserve**
- **Play**
- **Draw**
- **Discard**
- **Reveal**
- **Take**
- **Banish**
- **Hand**
- **Spread**
- **Deck**
- **Ability**
- **Pattern**
- **Relic**
- **Status**
- **Reading**
- **Resolve**
- **Event**
- **Potency**

## Files with canonical mechanical language

| File | Occurrences | Terms |
|---|---:|---|
| `src/styles/singlePlayerV2/index.css` | 654 | Mult:1, Score:124, Threshold:44, Reserve:13, Play:2, Draw:1, Discard:36, Reveal:1, Hand:108, Spread:174, Deck:4, Ability:42, Pattern:16, Relic:2, Reading:12, Event:74 |
| `src/app/mpGame.mjs` | 390 | Chips:13, Mult:34, Score:39, Threshold:4, Draw:17, Discard:27, Reveal:5, Take:2, Banish:1, Hand:58, Spread:60, Deck:6, Ability:86, Resolve:25, Event:13 |
| `docs/css-cascade-layer-migration.md` | 302 | Mult:2, Score:23, Play:1, Draw:4, Discard:3, Take:2, Hand:107, Spread:76, Ability:35, Pattern:1, Relic:16, Status:1, Reading:11, Resolve:6, Event:14 |
| `src/app/adventureModeV3.mjs` | 229 | Score:1, Draw:1, Reveal:2, Banish:6, Hand:21, Spread:3, Deck:32, Ability:2, Relic:1, Status:31, Reading:1, Resolve:38, Event:86, Potency:4 |
| `src/app/readingFlow.mjs` | 190 | Chips:4, Mult:6, Score:10, Threshold:6, Reserve:4, Draw:2, Discard:25, Reveal:1, Take:3, Hand:30, Spread:20, Deck:25, Ability:17, Pattern:5, Relic:14, Status:2, Reading:11, Resolve:4, Event:1 |
| `src/styles/market.css` | 189 | Chips:2, Mult:6, Score:17, Threshold:3, Reserve:5, Draw:8, Discard:8, Reveal:4, Take:1, Hand:44, Spread:15, Ability:33, Pattern:4, Relic:19, Reading:1, Event:19 |
| `src/data/legacyMarket.mjs` | 185 | Chips:51, Mult:38, Score:1, Reserve:2, Draw:16, Discard:8, Reveal:3, Hand:15, Spread:19, Ability:1, Pattern:14, Relic:10, Reading:7 |
| `src/ui/renderMarket.mjs` | 185 | Chips:15, Mult:14, Score:2, Threshold:2, Reserve:13, Play:2, Draw:5, Discard:9, Reveal:5, Take:1, Hand:4, Spread:2, Ability:5, Relic:92, Reading:5, Event:9 |
| `src/multiplayer/mpReducer.mjs` | 178 | Score:2, Draw:5, Discard:42, Reveal:1, Take:1, Banish:1, Hand:50, Spread:32, Deck:19, Ability:24, Resolve:1 |
| `src/game/reducer.mjs` | 166 | Chips:3, Mult:1, Score:7, Threshold:5, Reserve:8, Draw:1, Discard:26, Take:1, Hand:36, Spread:15, Deck:27, Ability:9, Relic:24, Reading:3 |
| `game.html` | 159 | Mult:1, Score:15, Threshold:3, Reserve:2, Draw:4, Discard:7, Reveal:3, Take:8, Hand:30, Spread:33, Deck:5, Ability:8, Pattern:2, Relic:10, Status:2, Reading:14, Resolve:3, Event:9 |
| `scripts/validate-personas.mjs` | 153 | Score:5, Draw:6, Discard:21, Banish:21, Hand:59, Spread:18, Deck:9, Ability:9, Resolve:5 |
| `src/styles/singlePlayerV2/desktop.css` | 152 | Score:38, Threshold:15, Reserve:3, Play:1, Discard:11, Hand:15, Spread:33, Ability:9, Reading:3, Event:24 |
| `src/styles/mobile.css` | 136 | Hand:47, Spread:24, Ability:23, Relic:18, Reading:1, Event:23 |
| `scripts/validate-multiplayer.mjs` | 119 | Score:6, Draw:8, Discard:14, Reveal:1, Take:3, Hand:38, Spread:21, Deck:12, Ability:16 |
| `src/app/adventureMode.mjs` | 119 | Score:28, Threshold:3, Reserve:1, Discard:2, Hand:2, Spread:3, Deck:27, Relic:4, Status:4, Reading:4, Resolve:12, Event:29 |
| `scripts/validate-mp-ability-flow.mjs` | 101 | Discard:6, Reveal:2, Take:7, Hand:12, Spread:2, Deck:12, Ability:52, Resolve:6, Event:2 |
| `src/systems/abilities.mjs` | 97 | Draw:1, Discard:10, Reveal:3, Take:2, Hand:17, Spread:3, Deck:45, Ability:15, Resolve:1 |
| `docs/adventure-mode-gdd.md` | 94 | Score:14, Threshold:1, Play:1, Draw:3, Reveal:2, Hand:1, Spread:13, Deck:2, Pattern:2, Relic:8, Status:8, Reading:3, Resolve:11, Event:25 |
| `src/systems/adventure/run.mjs` | 91 | Score:15, Spread:6, Deck:9, Relic:13, Status:4, Reading:1, Resolve:17, Event:26 |
| `scripts/validate-adventure.mjs` | 90 | Score:7, Threshold:2, Play:1, Spread:16, Deck:16, Relic:4, Status:2, Resolve:18, Event:24 |
| `src/styles/singlePlayerV2/base.css` | 89 | Mult:1, Score:27, Threshold:11, Discard:1, Hand:13, Spread:14, Ability:3, Relic:1, Reading:4, Event:14 |
| `scripts/validate-adventure-ui.mjs` | 86 | Score:16, Threshold:1, Reserve:2, Play:1, Discard:2, Hand:6, Spread:7, Deck:10, Relic:8, Status:11, Reading:5, Resolve:6, Event:11 |
| `scripts/validate-modifier-cases.mjs` | 85 | Chips:18, Mult:29, Score:22, Reserve:1, Discard:2, Hand:1, Deck:3, Pattern:4, Relic:5 |
| `scripts/check-architecture.mjs` | 84 | Score:10, Threshold:3, Reserve:11, Draw:1, Discard:7, Reveal:1, Hand:18, Spread:7, Deck:14, Relic:5, Reading:5, Resolve:2 |
| `docs/architecture-implementation-plan.md` | 83 | Mult:1, Score:6, Threshold:4, Reserve:2, Draw:3, Discard:10, Reveal:2, Take:1, Hand:7, Spread:5, Deck:2, Ability:11, Relic:20, Reading:5, Event:4 |
| `src/app/marketRebalance.mjs` | 82 | Chips:7, Mult:4, Score:9, Threshold:10, Reserve:2, Draw:2, Discard:8, Reveal:1, Hand:3, Spread:5, Ability:13, Relic:12, Reading:6 |
| `src/systems/relics.mjs` | 82 | Chips:7, Mult:11, Threshold:2, Pattern:1, Relic:61 |
| `src/styles/singlePlayerV2/components/spreadHints.css` | 79 | Score:1, Threshold:1, Play:1, Reveal:1, Hand:3, Spread:30, Ability:26, Pattern:14, Reading:1, Event:1 |
| `src/styles/presentation/adventureDeckActionFx.css` | 78 | Banish:3, Deck:73, Event:2 |
| `src/app/mpGameHost.mjs` | 77 | Mult:12, Score:4, Hand:13, Spread:6, Deck:1, Ability:30, Resolve:1, Event:10 |
| `src/app/tutorialCore.mjs` | 77 | Chips:1, Mult:1, Score:1, Threshold:9, Reserve:3, Play:2, Draw:1, Discard:5, Hand:16, Spread:6, Deck:1, Ability:3, Pattern:5, Relic:8, Reading:5, Resolve:1, Event:9 |
| `src/styles/actionDropTargets.css` | 75 | Score:2, Discard:2, Hand:29, Spread:26, Ability:10, Relic:2, Event:4 |
| `src/systems/scoring.mjs` | 73 | Chips:30, Mult:28, Score:2, Reserve:1, Play:1, Hand:2, Spread:1, Pattern:4, Relic:2, Reading:2 |
| `src/app/mainMenu.mjs` | 71 | Threshold:3, Reserve:4, Play:1, Draw:2, Discard:4, Reveal:3, Take:1, Hand:5, Spread:2, Deck:2, Ability:4, Relic:5, Status:2, Reading:25, Resolve:8 |
| `src/styles/mpFixes.css` | 71 | Mult:9, Score:13, Threshold:3, Discard:1, Hand:15, Spread:26, Ability:1, Reading:1, Resolve:1, Event:1 |
| `src/ui/renderTable.mjs` | 70 | Threshold:2, Reserve:5, Discard:9, Hand:7, Spread:5, Ability:33, Pattern:2, Event:7 |
| `docs/architecture-spine.md` | 69 | Chips:1, Score:5, Threshold:6, Reserve:1, Draw:2, Discard:5, Reveal:1, Take:1, Hand:4, Spread:4, Deck:6, Ability:9, Pattern:2, Relic:15, Status:1, Reading:5, Resolve:1 |
| `docs/migration-roadmap.md` | 69 | Mult:7, Score:6, Discard:4, Reveal:6, Take:1, Hand:10, Spread:11, Deck:2, Ability:20, Pattern:1, Reading:1 |
| `src/styles/singlePlayerV2/components/abilityPresentation.css` | 69 | Score:1, Reveal:32, Ability:36 |
| `docs/single-player-redesign/PHASE_1_LAYOUT_BLUEPRINT.md` | 68 | Score:11, Threshold:14, Reserve:6, Play:1, Discard:7, Hand:13, Spread:10, Status:1, Reading:5 |
| `src/ui/renderSpread.mjs` | 68 | Hand:27, Spread:11, Ability:25, Resolve:1, Event:4 |
| `scripts/validate-purge-reducer.mjs` | 67 | Chips:6, Mult:6, Draw:2, Discard:3, Hand:33, Spread:5, Deck:10, Relic:2 |
| `src/data/relics.mjs` | 67 | Chips:9, Mult:8, Score:1, Threshold:2, Reserve:2, Draw:1, Discard:4, Reveal:1, Take:1, Hand:1, Spread:6, Deck:1, Relic:7, Reading:4, Event:19 |
| `scripts/validate-app-cascade-layers.mjs` | 66 | Mult:1, Score:9, Play:1, Hand:16, Spread:24, Ability:3, Relic:6, Reading:1, Resolve:2, Event:3 |
| `src/styles/mpGame.css` | 66 | Mult:2, Score:26, Threshold:3, Discard:2, Hand:9, Spread:19, Event:5 |
| `src/styles/hand.css` | 65 | Hand:39, Spread:6, Ability:17, Event:3 |
| `src/systems/adventure/singleCardRun.mjs` | 61 | Play:12, Take:1, Deck:11, Pattern:1, Relic:4, Reading:1, Resolve:2, Event:22, Potency:7 |
| `scripts/validate-render.mjs` | 59 | Hand:30, Spread:19, Deck:8, Ability:1, Resolve:1 |
| `src/styles/singlePlayerV2/compat.css` | 59 | Score:7, Threshold:4, Discard:1, Hand:11, Spread:27, Ability:4, Event:5 |
| `src/ui/singlePlayerV2.mjs` | 59 | Mult:5, Score:7, Threshold:15, Reserve:2, Play:1, Discard:4, Hand:5, Spread:3, Ability:4, Reading:2, Event:11 |
| `scripts/validate-ability-targeting-bridge.mjs` | 55 | Discard:26, Hand:11, Spread:1, Ability:13, Resolve:4 |
| `src/ui/ambientEffects.mjs` | 54 | Hand:38, Event:16 |
| `src/app/matchmakingScreen.mjs` | 53 | Score:1, Draw:2, Discard:4, Reveal:1, Hand:13, Spread:10, Deck:4, Ability:12, Status:6 |
| `scripts/validate-bridge.mjs` | 51 | Chips:1, Mult:1, Reserve:4, Draw:1, Discard:12, Hand:15, Spread:5, Deck:7, Relic:3, Reading:2 |
| `src/app/main.mjs` | 50 | Relic:31, Status:1, Reading:2, Resolve:8, Event:8 |
| `src/app/adventureEventHero.mjs` | 49 | Spread:2, Deck:20, Event:27 |
| `src/app/referenceControls.mjs` | 48 | Chips:7, Mult:7, Draw:2, Reveal:1, Take:1, Spread:1, Ability:13, Pattern:2, Event:14 |
| `src/app/adventureItemPopups.mjs` | 47 | Relic:14, Status:25, Event:8 |
| `src/app/mpAutoAdvanceDelay.mjs` | 47 | Discard:1, Hand:4, Spread:3, Deck:1, Ability:13, Event:25 |
| `src/game/selectors.mjs` | 47 | Threshold:3, Reserve:4, Discard:7, Hand:11, Spread:7, Deck:1, Ability:4, Relic:8, Reading:2 |
| `src/ui/gestureActionDrops.mjs` | 47 | Discard:11, Hand:6, Spread:2, Ability:1, Event:27 |
| `scripts/validate-action-card-drops.mjs` | 46 | Discard:23, Take:1, Hand:7, Spread:2, Ability:10, Relic:2, Resolve:1 |
| `src/data/adventure/adventureContentV3.mjs` | 46 | Threshold:1, Draw:2, Reveal:3, Take:2, Hand:8, Spread:1, Pattern:1, Status:3, Resolve:9, Event:16 |
| `src/styles/singlePlayerV2/components/artIntegration.css` | 46 | Score:10, Threshold:3, Reserve:3, Discard:12, Hand:7, Spread:3, Deck:2, Pattern:1, Reading:1, Event:4 |
| `src/app/shopOverlayFlow.mjs` | 44 | Chips:5, Mult:1, Draw:2, Discard:5, Reveal:6, Hand:5, Spread:2, Deck:2, Pattern:1, Relic:9, Reading:4, Event:2 |
| `src/styles/attic.css` | 44 | Reserve:1, Discard:1, Hand:4, Spread:2, Deck:13, Event:23 |
| `docs/ability-rule-audit.md` | 42 | Draw:5, Discard:1, Reveal:12, Take:7, Hand:2, Spread:4, Deck:6, Ability:5 |
| `src/app/relicFlow.mjs` | 42 | Take:1, Hand:2, Deck:5, Relic:33, Event:1 |
| `src/game/reducerWithPurge.mjs` | 42 | Chips:4, Mult:4, Discard:2, Hand:16, Spread:1, Deck:3, Ability:10, Relic:2 |
| `scripts/validate-ability-rules.mjs` | 41 | Discard:1, Reveal:7, Hand:5, Spread:11, Deck:11, Ability:6 |
| `scripts/validate-ability-targeting.mjs` | 41 | Hand:20, Spread:1, Deck:2, Ability:18 |
| `src/app/abilityFlowAsync.mjs` | 41 | Play:1, Draw:1, Reveal:5, Take:5, Hand:4, Spread:4, Deck:13, Ability:8 |
| `src/data/abilities.mjs` | 41 | Draw:12, Discard:1, Reveal:7, Take:14, Hand:2, Spread:1, Deck:4 |
| `src/data/adventure/events.mjs` | 41 | Reveal:2, Take:10, Hand:6, Spread:2, Relic:1, Status:1, Reading:10, Resolve:2, Event:7 |
| `src/app/discardRuntime.mjs` | 40 | Discard:18, Hand:13, Deck:2, Ability:5, Relic:2 |
| `scripts/validate-ability-choice-flow.mjs` | 39 | Reveal:4, Take:2, Hand:7, Spread:7, Deck:12, Ability:4, Reading:1, Resolve:2 |
| `src/app/adventureDeckActionFx.mjs` | 39 | Draw:1, Discard:1, Reveal:1, Banish:6, Deck:25, Ability:1, Relic:1, Event:3 |
| `README.md` | 38 | Score:6, Threshold:3, Play:1, Draw:2, Discard:1, Hand:2, Spread:3, Deck:2, Ability:5, Pattern:2, Relic:8, Reading:3 |
| `scripts/capture-presentation-states.mjs` | 38 | Score:3, Threshold:1, Reserve:4, Play:1, Reveal:1, Hand:4, Spread:10, Ability:1, Pattern:2, Relic:3, Reading:3, Resolve:4, Event:1 |
| `src/styles/singlePlayerV2/assets.css` | 38 | Score:13, Threshold:4, Reserve:4, Discard:4, Hand:2, Spread:7, Deck:1, Reading:2, Event:1 |
| `src/styles/singlePlayerV2/components/scoreHud.css` | 37 | Score:17, Threshold:5, Reserve:3, Discard:3, Spread:6, Event:3 |
| `src/ui/gestureHand.mjs` | 37 | Take:1, Hand:31, Spread:2, Event:3 |
| `scripts/validate-scoring-cases.mjs` | 36 | Chips:7, Mult:9, Score:14, Deck:3, Reading:3 |
| `src/styles/singlePlayerV2/components/presentation.css` | 36 | Score:5, Threshold:12, Hand:5, Spread:7, Ability:3, Pattern:4 |
| `src/styles/singlePlayerV2/states.css` | 36 | Hand:19, Spread:16, Event:1 |
| `src/ui/patternHintStack.mjs` | 36 | Hand:9, Spread:7, Ability:6, Pattern:12, Resolve:1, Event:1 |
| `src/app/abilityTargetBridge.mjs` | 35 | Discard:14, Reveal:1, Hand:10, Spread:1, Ability:7, Resolve:2 |
| `src/styles/singlePlayerV2/components/hand.css` | 35 | Draw:1, Hand:29, Event:5 |
| `src/multiplayer/mpState.mjs` | 34 | Draw:1, Discard:4, Banish:1, Hand:10, Spread:3, Deck:15 |
| `src/multiplayer/personas.mjs` | 34 | Draw:2, Discard:7, Banish:4, Hand:6, Spread:4, Deck:3, Ability:8 |
| `src/styles/drawers.css` | 34 | Chips:1, Mult:1, Score:2, Hand:19, Ability:2, Event:9 |
| `scripts/validate-economy-cases.mjs` | 33 | Reserve:11, Discard:3, Hand:2, Relic:17 |
| `src/app/legacyBridge.mjs` | 33 | Threshold:1, Reserve:4, Draw:3, Discard:5, Hand:8, Spread:1, Deck:3, Relic:6, Reading:2 |
| `src/app/presentationDirector.mjs` | 33 | Threshold:11, Reveal:5, Hand:3, Spread:2, Deck:1, Ability:7, Pattern:3, Reading:1 |
| `src/systems/deck.mjs` | 33 | Discard:4, Hand:6, Deck:16, Ability:4, Relic:3 |
| `docs/single-player-redesign/PHASE_1_COMPONENT_AND_ASSET_CONTRACT.md` | 32 | Score:5, Threshold:7, Reserve:4, Discard:4, Hand:6, Spread:3, Ability:1, Reading:2 |
| `scripts/validate-market-rebalance.mjs` | 32 | Mult:2, Score:1, Threshold:2, Play:1, Draw:2, Discard:7, Hand:4, Ability:5, Relic:6, Reading:2 |
| `src/styles/mainMenu.css` | 32 | Score:5, Take:1, Spread:9, Status:5, Reading:4, Event:8 |
| `src/styles/mpMobile.css` | 32 | Score:2, Hand:16, Spread:14 |
| `src/ui/renderHand.mjs` | 32 | Draw:6, Hand:11, Spread:3, Ability:12 |
| `src/styles/singlePlayerV2/components/spread.css` | 31 | Score:1, Discard:1, Spread:26, Event:3 |
| `scripts/capture-single-player-v2.mjs` | 30 | Score:1, Discard:1, Hand:16, Spread:7, Reading:1, Resolve:4 |
| `src/data/cards.mjs` | 30 | Draw:3, Ability:26, Resolve:1 |
| `src/data/shopItems.mjs` | 30 | Chips:4, Mult:8, Discard:3, Hand:3, Relic:10, Reading:2 |
| `docs/single-player-redesign/PHASE_1_EXECUTION_CHECKLIST.md` | 29 | Score:2, Threshold:4, Reserve:1, Play:1, Discard:3, Hand:6, Spread:9, Deck:1, Ability:2 |
| `src/app/adventureInteractionFx.mjs` | 29 | Deck:10, Resolve:3, Event:13, Potency:3 |
| `src/styles/components/handSwipeZone.css` | 29 | Hand:26, Event:3 |
| `src/styles/components/mpGameChrome.css` | 29 | Score:7, Draw:1, Discard:1, Reveal:1, Spread:11, Ability:1, Event:7 |
| `src/ui/gestureCard.mjs` | 29 | Hand:21, Spread:8 |
| `src/app/mpHandGestureAdapter.mjs` | 28 | Hand:23, Spread:1, Ability:4 |
| `src/ui/renderGhost.mjs` | 28 | Chips:5, Mult:6, Score:12, Threshold:1, Spread:2, Event:2 |
| `docs/single-player-redesign/PHASE_2_ART_DIRECTION.md` | 27 | Score:5, Threshold:5, Reserve:3, Discard:4, Hand:3, Spread:4, Status:1, Reading:2 |
| `public/ui/single-player-v2/README.md` | 27 | Score:4, Threshold:4, Reserve:4, Discard:3, Hand:4, Spread:3, Deck:2, Reading:3 |
| `scripts/validate-adventure-single-card.mjs` | 27 | Event:17, Potency:10 |
| `src/app/marketFlow.mjs` | 27 | Score:1, Threshold:1, Hand:1, Spread:3, Relic:19, Reading:1, Event:1 |
| `src/styles/base.css` | 27 | Chips:1, Mult:1, Score:9, Threshold:2, Reserve:2, Discard:1, Hand:2, Spread:5, Event:4 |
| `scripts/_ab/capture.mjs` | 25 | Discard:4, Reveal:1, Hand:7, Deck:2, Ability:5, Reading:5, Event:1 |
| `src/app/loadoutScreen.mjs` | 25 | Ability:9, Relic:7, Event:9 |
| `src/app/resonationFlow.mjs` | 25 | Chips:6, Mult:7, Spread:12 |

## Legacy-language review queue

These matches require context review; they are not automatically replaced because words such as “points,” “pool,” and “between” can appear in code, comments, or fiction.

| File | Terms found |
|---|---|
| `docs/adventure-mode-gdd.md` | target score, pool |
| `docs/architecture-implementation-plan.md` | points |
| `docs/css-cascade-layer-migration.md` | points |
| `docs/single-player-redesign/PHASE_1_COMPONENT_AND_ASSET_CONTRACT.md` | points |
| `docs/single-player-redesign/PHASE_1_EXECUTION_CHECKLIST.md` | pool |
| `docs/single-player-redesign/PHASE_1_LAYOUT_BLUEPRINT.md` | pool |
| `docs/single-player-redesign/PHASE_2_EXECUTION_CHECKLIST.md` | points |
| `game.html` | points, pool |
| `scripts/build-bundle.mjs` | points |
| `scripts/capture-presentation-states.mjs` | points |
| `scripts/validate-ability-rule-reconciliation.mjs` | pool |
| `scripts/validate-ability-rules.mjs` | pool |
| `scripts/validate-action-card-drops.mjs` | points |
| `scripts/validate-adventure-ui.mjs` | pool |
| `scripts/validate-bridge.mjs` | points, pool |
| `scripts/validate-card-detail-placement.mjs` | points |
| `scripts/validate-hints.mjs` | points |
| `scripts/validate-market-rebalance.mjs` | points, multiplier, pool |
| `scripts/validate-modifier-cases.mjs` | pool |
| `scripts/validate-pack-opening.mjs` | pool |
| `scripts/validate-personas.mjs` | points |
| `scripts/validate-upgrade-announcements.mjs` | points |
| `src/app/abilityTargetBridge.mjs` | points |
| `src/app/adventureCardSigils.mjs` | points, pool |
| `src/app/adventureInteractionFx.mjs` | points |
| `src/app/adventureMode.mjs` | pool |
| `src/app/adventureModeV3.mjs` | points, pool |
| `src/app/apparitions/aggressionApparition.mjs` | multiplier |
| `src/app/apparitions/core.mjs` | multiplier |
| `src/app/dataGlobals.mjs` | points |
| `src/app/legacyBridge.mjs` | pool |
| `src/app/mainMenu.mjs` | pool |
| `src/app/marketFlow.mjs` | pool |
| `src/app/marketRebalance.mjs` | multiplier, pool |
| `src/app/matchmakingScreen.mjs` | points |
| `src/app/menuBoot.mjs` | pool |
| `src/app/mpCpuSafety.mjs` | points |
| `src/app/mpGame.mjs` | points, pool |
| `src/app/mpGameHost.mjs` | pool |
| `src/app/packOpeningSafety.mjs` | pool |
| `src/app/placementRuntime.mjs` | points |
| `src/app/readingFlow.mjs` | points, multiplier, pool |
| `src/app/runtimeState.mjs` | pool |
| `src/app/shopOverlayFlow.mjs` | pool |
| `src/app/tutorialCore.mjs` | points |
| `src/data/adventure/cardNodes.mjs` | points |
| `src/data/adventure/events.mjs` | pool |
| `src/data/adventure/relics.mjs` | points |
| `src/data/adventure/rewards.mjs` | pool |
| `src/data/cards.mjs` | points |
| `src/data/constellations.mjs` | points |
| `src/data/legacyMarket.mjs` | multiplier, pool |
| `src/data/relics.mjs` | point value, multiplier, pool |
| `src/multiplayer/interactionCards.mjs` | points |
| `src/multiplayer/mpActions.mjs` | points |
| `src/multiplayer/mpReducer.mjs` | points, pool |
| `src/multiplayer/personas.mjs` | points |
| `src/styles/market.css` | pool |
| `src/styles/mpMultMobile.css` | multiplier |
| `src/styles/singlePlayerV2/base.css` | points, multiplier |
| `src/styles/singlePlayerV2/desktop.css` | points, multiplier |
| `src/styles/singlePlayerV2/index.css` | points, multiplier |
| `src/systems/adventure/run.mjs` | pool |
| `src/systems/adventure/singleCardRun.mjs` | pool |
| `src/systems/deck.mjs` | points |
| `src/systems/relics.mjs` | points |
| `src/systems/scoring.mjs` | points |
| `src/ui/renderCard.mjs` | points |
| `src/ui/renderMarket.mjs` | pool |
| `src/ui/renderTable.mjs` | pool |
| `src/ui/singlePlayerV2.mjs` | multiplier, pool |
