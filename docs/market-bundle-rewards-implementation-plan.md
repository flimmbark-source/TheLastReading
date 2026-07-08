# Market Bundle Rewards — Implementation Plan

This plan defines the data layer and implementation path for replacing the Reserve-driven Market with a Results-driven track system that creates pack-like reward bundles.

The design decision is:

- **Results screen explains what happened.**
- **Market shows only reward bundles.**
- **Opening a bundle reveals reward choices like a pack.**
- **The Market should not display track progress, thresholds, or reward-pool internals.**

No gameplay implementation should begin until this plan is reviewed.

---

## 1. Current architecture constraints

The current store architecture already has the right broad shape:

- Persistent run upgrades/relics live in `persist` via `createInitialPersistState()`.
- Per-reading/per-round state lives in `run` via `createInitialRunState()`.
- The reducer owns scoring, market entry, purchases, and market exit.
- Current Market purchase handling is still cost-oriented through `BUY_MARKET_ITEM` and `buyMarketPurchase()`.
- The current Market UI is a compact overlay with candle, rows, refresh, reserve, and next-reading button.

Important current state fields that this plan must not break:

```js
persist: {
  reserve,
  totalScore,
  upgrades,
  relics,
  relicUsed,
  discoveredArchiveItems,
  unlockedFragments,
  seenTutorials,
  obals,
  stampedMajors,
  stampedFive,
}

run: {
  phase,
  hand,
  deck,
  discard,
  spread,
  thresholdIndex,
  roundScore,
  setScores,
  roundDiscardCount,
  roundPatternCount,
  pendingReserve,
  lastScore,
  lastSetScore,
  lastThreshold,
  lastPassed,
  lastOutcome,
}
```

The new system should add fields, not remove old ones in the first pass.

---

## 2. Target player-facing flow

### 2.1 Reading end

When a round clears the threshold:

1. The score resolves normally.
2. A **reading ledger** is created from the completed round.
3. The ledger advances Market tracks.
4. Completed track milestones create **pending reward bundles**.
5. The game enters a Results screen.

### 2.2 Results screen

The Results screen explains the system:

```text
Reading Results
Score: 64 / 30

Track Progress
Sequence Complete — 5 / 5
Restless Complete — 8 / 8
Court — 2 / 3

2 bundles added to the Market
```

The Results screen is where the player sees track progress, completion, and why bundles were created.

### 2.3 Market screen

The Market remains compact and bundle-only:

```text
REFRESH ✦ 10              BUNDLES 2

BUNDLE
SEQUENCE BUNDLE
Open to reveal a Sequence reward.      OPEN

BUNDLE
RESTLESS BUNDLE
Open to reveal a Restless reward.      OPEN

NEXT READING →
```

The Market does **not** show:

- track progress bars,
- thresholds,
- `5/5` or `8/8`,
- the reward choices before opening,
- the exact reason the bundle exists.

That context belongs on the Results screen.

### 2.4 Bundle opening

Tapping `OPEN` reveals a pack-like choice state:

```text
Sequence Bundle
Choose 1 Sequence reward

Five Star Stamp
Sequence Bonus
Major Bridge
```

The player chooses one reward. The chosen reward is applied immediately. The bundle is marked claimed.

---

## 3. New data files

### 3.1 `src/data/marketTracks.mjs`

Owns track configuration and track-to-bundle metadata.

```js
export const MARKET_TRACK_IDS = Object.freeze({
  SEQUENCE: 'sequence',
  RESTLESS: 'restless',
  COURT: 'court',
  ROYAL_COURT: 'royal_court',
  MAJOR: 'major',
  SIGHT: 'sight',
  THREAD: 'thread',
  PURGE: 'purge',
  RELIC: 'relic',
  STAMP: 'stamp',
});

export const MARKET_TRACKS = Object.freeze({
  sequence: {
    id: 'sequence',
    label: 'Sequence',
    bundleId: 'sequence_bundle',
    thresholds: [2, 5, 10, 18, 30],
    progressKey: 'sequenceCount',
    icon: 'sequence',
    reasonTemplates: {
      complete: 'You scored {value} total Sequences.',
      progress: 'Sequences scored: {after} / {threshold}.',
    },
  },

  restless: {
    id: 'restless',
    label: 'Restless',
    bundleId: 'restless_bundle',
    thresholds: [3, 8, 15, 25],
    progressKey: 'discardCount',
    icon: 'restless',
    reasonTemplates: {
      complete: 'You used {value} total Discards.',
      progress: 'Discards used: {after} / {threshold}.',
    },
  },

  court: {
    id: 'court',
    label: 'Court',
    bundleId: 'court_bundle',
    thresholds: [3, 7, 12, 20],
    progressKey: 'courtScore',
    icon: 'court',
    reasonTemplates: {
      complete: 'Your Court reading reached {value}.',
      progress: 'Court progress: {after} / {threshold}.',
    },
  },
});
```

Initial implementation should ship only `sequence`, `restless`, and `court`. Other tracks can be declared later after the loop is proven.

### 3.2 `src/data/marketBundles.mjs`

Owns bundle display data. The Market renders these, not tracks.

```js
export const MARKET_BUNDLES = Object.freeze({
  sequence_bundle: {
    id: 'sequence_bundle',
    family: 'sequence',
    name: 'Sequence Bundle',
    shortDescription: 'Open to reveal a Sequence reward.',
    categoryLabel: 'Bundle',
    icon: 'sequence_pack',
    accent: 'gold',
  },

  restless_bundle: {
    id: 'restless_bundle',
    family: 'restless',
    name: 'Restless Bundle',
    shortDescription: 'Open to reveal a Restless reward.',
    categoryLabel: 'Bundle',
    icon: 'restless_pack',
    accent: 'violet',
  },

  court_bundle: {
    id: 'court_bundle',
    family: 'court',
    name: 'Court Bundle',
    shortDescription: 'Open to reveal a Court reward.',
    categoryLabel: 'Bundle',
    icon: 'court_pack',
    accent: 'blue',
  },
});
```

### 3.3 `src/data/marketRewards.mjs`

Owns reward definitions and tiered pools.

```js
export const MARKET_REWARD_APPLY_TYPES = Object.freeze({
  UPGRADE: 'upgrade',
  RELIC: 'relic',
  STAMP: 'stamp',
  CARD_MOD: 'card_mod',
  BUNDLE_MOD: 'bundle_mod',
});

export const MARKET_REWARDS = Object.freeze({
  sequence_bonus: {
    id: 'sequence_bonus',
    family: 'sequence',
    rarity: 'common',
    name: 'Sequence Bonus',
    description: 'Sequences gain more Chips.',
    icon: 'sequence_bonus',
    apply: { type: 'upgrade', upgradeKey: 'sequence', amount: 1 },
  },

  five_star_stamp: {
    id: 'five_star_stamp',
    family: 'sequence',
    rarity: 'common',
    name: 'Five Star Stamp',
    description: 'Choose a card to bridge Sequences.',
    icon: 'five_star_stamp',
    apply: { type: 'stamp', stampId: 'five_star' },
  },

  major_bridge: {
    id: 'major_bridge',
    family: 'sequence',
    rarity: 'common',
    name: 'Major Bridge',
    description: 'First Major placed each reading gains Chips.',
    icon: 'major_bridge',
    apply: { type: 'upgrade', upgradeKey: 'first_light', amount: 1 },
  },

  extra_discard: {
    id: 'extra_discard',
    family: 'restless',
    rarity: 'common',
    name: 'Extra Discard',
    description: '+1 Discard each reading.',
    icon: 'extra_discard',
    apply: { type: 'upgrade', upgradeKey: 'discards', amount: 1 },
  },

  nimble_fingers: {
    id: 'nimble_fingers',
    family: 'restless',
    rarity: 'common',
    name: 'Nimble Fingers',
    description: 'After each Discard, draw 1 card.',
    icon: 'nimble_fingers',
    apply: { type: 'upgrade', upgradeKey: 'nimble_fingers', amount: 1 },
  },

  quick_release: {
    id: 'quick_release',
    family: 'restless',
    rarity: 'common',
    name: 'Quick Release',
    description: 'Each discarded card adds Chips to the score.',
    icon: 'quick_release',
    apply: { type: 'upgrade', upgradeKey: 'quick_release', amount: 1 },
  },

  court_bonus: {
    id: 'court_bonus',
    family: 'court',
    rarity: 'common',
    name: 'Court Bonus',
    description: 'Court patterns gain more Chips.',
    icon: 'court_bonus',
    apply: { type: 'upgrade', upgradeKey: 'court_chips', amount: 1 },
  },
});

export const MARKET_REWARD_POOLS = Object.freeze({
  sequence_common: ['five_star_stamp', 'sequence_bonus', 'major_bridge'],
  sequence_uncommon: ['sequence_bonus', 'major_bridge'],

  restless_common: ['extra_discard', 'nimble_fingers', 'quick_release'],
  restless_uncommon: ['nimble_fingers', 'quick_release'],

  court_common: ['court_bonus'],
});

export const MARKET_REWARD_POOL_BY_FAMILY_TIER = Object.freeze({
  sequence: {
    1: ['sequence_common'],
    2: ['sequence_common', 'sequence_uncommon'],
    3: ['sequence_uncommon'],
  },
  restless: {
    1: ['restless_common'],
    2: ['restless_common', 'restless_uncommon'],
    3: ['restless_uncommon'],
  },
  court: {
    1: ['court_common'],
  },
});
```

---

## 4. New system files

### 4.1 `src/systems/readingLedger.mjs`

Creates a ledger from the scoring result and run context.

Input:

```js
buildReadingLedger({ state, score, threshold, passed })
```

Output:

```js
{
  id: 'reading_3_round_2',
  reading: 3,
  thresholdIndex: 2,
  score: {
    finalScore: 64,
    threshold: 30,
    cleared: true,
  },
  patterns: {
    sequenceCount: 2,
    fullCourtCount: 1,
    royalCourtCount: 0,
    threeOfKindCount: 0,
    fourOfKindCount: 0,
    pathOfMagiCount: 0,
  },
  cards: {
    majorsPlaced: 3,
    courtsPlaced: 2,
    stampedCardsScored: 1,
  },
  actions: {
    discardsUsed: 3,
    purgesUsed: 0,
    abilitiesUsed: 3,
    sightAbilitiesUsed: 1,
    threadAbilitiesUsed: 1,
  },
  relics: {
    triggered: {},
  },
}
```

Implementation notes:

- Use `score.melds` to count pattern names.
- Do not re-run full pattern detection unless the score object is unavailable.
- Count `run.roundDiscardCount` for restless progress.
- Count `run.spread.filter(Boolean)` for card family data.
- Initial implementation can leave `relics.triggered` empty unless relic trigger telemetry already exists.

Pattern count helper:

```js
function patternCountsFromMelds(melds = []) {
  const out = {
    sequenceCount: 0,
    fullCourtCount: 0,
    royalCourtCount: 0,
    threeOfKindCount: 0,
    fourOfKindCount: 0,
    pathOfMagiCount: 0,
  };

  for (const meld of melds) {
    const name = typeof meld === 'string' ? meld : meld.name;
    if (!name) continue;
    if (name.startsWith('Sequence')) out.sequenceCount += 1;
    else if (name.startsWith('Full Court')) out.fullCourtCount += 1;
    else if (name.startsWith('Royal Court')) out.royalCourtCount += 1;
    else if (name.startsWith('Three of a Kind')) out.threeOfKindCount += 1;
    else if (name.startsWith('Four of a Kind')) out.fourOfKindCount += 1;
    else if (name === 'Path of the Magi') out.pathOfMagiCount += 1;
  }

  return out;
}
```

### 4.2 `src/systems/marketTracks.mjs`

Owns track progress, completion detection, bundle generation, and result deltas.

Public functions:

```js
export function createInitialMarketTrackState(overrides = {})
export function advanceMarketTracks(persist, ledger, options = {})
export function completedTracksFromDeltas(trackDeltas)
export function nextThresholdForTrack(trackConfig, claimedTier)
export function createBundleFromTrack(trackConfig, track, tier, ledger, options = {})
```

Core result:

```js
const result = advanceMarketTracks(persist, ledger, { rng });

result.persist;
result.trackDeltas;
result.generatedBundles;
```

Track object shape:

```js
{
  id: 'sequence',
  total: 5,
  claimedTier: 2,
  nextThreshold: 10,
  lastAdvancedReading: 3,
}
```

Track delta shape:

```js
{
  family: 'sequence',
  name: 'Sequence',
  gained: 2,
  before: 3,
  after: 5,
  threshold: 5,
  completed: true,
  completedTier: 2,
  generatedBundleId: 'bundle_r3_sequence_t2',
  reason: 'You scored 5 total Sequences.',
}
```

Compression rule:

If a track crosses multiple unclaimed thresholds in one reading, generate **one bundle at the highest completed tier**.

Example:

```js
before.total = 1
ledger gains = 10
thresholds = [2, 5, 10]
```

Generate one `sequence` bundle with `tier = 3`, not three bundles.

### 4.3 `src/systems/marketBundles.mjs`

Owns bundle opening and reward selection.

Public functions:

```js
export function unopenedBundles(persist)
export function openMarketBundle(persist, bundleId, options = {})
export function generateBundleRewardChoices(bundle, persist, options = {})
export function claimBundleReward(persist, bundleId, rewardId)
export function applyMarketReward(persist, reward)
```

Pending bundle shape:

```js
{
  id: 'bundle_r3_sequence_t2',
  bundleId: 'sequence_bundle',
  family: 'sequence',
  tier: 2,
  state: 'unopened', // unopened | opened | claimed
  rewardChoices: null,
  claimedRewardId: null,
  source: {
    ledgerId: 'reading_3_round_2',
    reading: 3,
    reason: 'You scored 5 total Sequences.',
  },
}
```

Opened bundle shape:

```js
{
  ...bundle,
  state: 'opened',
  rewardChoices: ['five_star_stamp', 'sequence_bonus', 'major_bridge'],
}
```

Claimed bundle shape:

```js
{
  ...bundle,
  state: 'claimed',
  claimedRewardId: 'five_star_stamp',
}
```

Choice generation requirements:

- Generate exactly 3 choices when possible.
- Save choices into the bundle on open.
- Do not regenerate choices on render.
- Exclude already-owned unique relics.
- Exclude maxed upgrades where appropriate.
- If fewer than 3 legal family rewards exist, fill from `general_common` later; in prototype, allow fewer choices rather than crashing.

Reward apply requirements:

- `upgrade`: increment `persist.upgrades[upgradeKey]`.
- `relic`: add to `persist.relics`, respecting relic slots.
- `stamp`: set a pending stamp selection field, not immediately mutate a random card.
- `card_mod`: set a pending card modification selection field.

---

## 5. State changes

### 5.1 Persist state additions

Add to `createInitialPersistState()`:

```js
marketTracks: createInitialMarketTrackState(overrides.marketTracks),
pendingBundles: [...(overrides.pendingBundles || [])],
claimedMarketRewards: [...(overrides.claimedMarketRewards || [])],
pendingCardChoice: overrides.pendingCardChoice || null,
```

`pendingCardChoice` is for rewards like Five Star Stamp that require choosing a card after the bundle reward is selected.

Example:

```js
pendingCardChoice: {
  kind: 'stamp',
  stampId: 'five_star',
  sourceRewardId: 'five_star_stamp',
}
```

### 5.2 Run state additions

Add to `createInitialRunState()`:

```js
lastReadingLedger: overrides.lastReadingLedger || null,
lastResults: overrides.lastResults || null,
openedBundleId: overrides.openedBundleId || null,
```

### 5.3 Save compatibility

`serializePersistState()` stores the whole `persist`, so new fields will serialize automatically.

`deserializePersistState()` routes through `createInitialPersistState(parsed.persist)`, so adding defaults there handles old saves.

Do not increment `SAVE_VERSION` in the first prototype unless old saves break. If field shape changes after testing, bump version later.

---

## 6. Reducer changes

### 6.1 New actions

Add to `ACTIONS`:

```js
OPEN_RESULTS: 'OPEN_RESULTS',
ENTER_MARKET_FROM_RESULTS: 'ENTER_MARKET_FROM_RESULTS',
OPEN_MARKET_BUNDLE: 'OPEN_MARKET_BUNDLE',
CLAIM_BUNDLE_REWARD: 'CLAIM_BUNDLE_REWARD',
CLOSE_BUNDLE: 'CLOSE_BUNDLE',
REROLL_BUNDLE_CHOICES: 'REROLL_BUNDLE_CHOICES',
```

### 6.2 Phase changes

Add a Results phase:

```js
RESULTS: 'results'
```

Flow after pass:

Current:

```js
phase: GAME_PHASES.MARKET
```

New:

```js
phase: GAME_PHASES.RESULTS
```

The Results screen then transitions to Market.

### 6.3 `scoreReading()` integration

On pass:

1. Compute score as today.
2. Compute `ledger = buildReadingLedger({ state, score, threshold, passed: true })`.
3. Compute `{ persist: trackPersist, trackDeltas, generatedBundles } = advanceMarketTracks(persist, ledger)`.
4. Set `run.phase = GAME_PHASES.RESULTS`.
5. Set `run.lastReadingLedger = ledger`.
6. Set `run.lastResults = { score, threshold, trackDeltas, generatedBundleIds }`.
7. Update `persist` with `trackPersist`.
8. Keep existing `totalScore`, `thresholdIndex`, `worldCarry`, etc.

Pseudo-patch:

```js
if (passed) {
  const ledger = buildReadingLedger({ state, score, threshold, passed: true });
  const trackResult = advanceMarketTracks(persist, ledger, { rng: action.rng || Math.random });

  return {
    run: {
      ...run,
      ...common,
      phase: GAME_PHASES.RESULTS,
      thresholdIndex: run.thresholdIndex + 1,
      lastPassed: true,
      lastOutcome: 'pass',
      awaitingNextSet: false,
      pendingReserve: 0,
      lastReadingLedger: ledger,
      lastResults: {
        score: score.finalScore,
        threshold,
        cleared: true,
        trackDeltas: trackResult.trackDeltas,
        generatedBundleIds: trackResult.generatedBundles.map(b => b.id),
      },
      worldCarry: worldCarryFromRelics(persist.relics, roundScore, threshold),
      relicEarned: false,
    },
    persist: {
      ...trackResult.persist,
      totalScore: persist.totalScore + roundScore,
    },
  };
}
```

Reserve note:

- Do not add `roundScore` into `pendingReserve` for the new flow.
- Keep `reserve` field for old save/UI compatibility.
- Existing `offering` / `miser` reserve effects need follow-up redesign; for prototype, either no-op them in this mode or convert them later to bundle/reroll effects.

### 6.4 Bundle actions

```js
case ACTIONS.ENTER_MARKET_FROM_RESULTS:
  return replaceRun(state, { phase: GAME_PHASES.MARKET });

case ACTIONS.OPEN_MARKET_BUNDLE: {
  const persist = openMarketBundle(state.persist, action.bundleId, { rng: action.rng });
  return replacePersist(
    replaceRun(state, { openedBundleId: action.bundleId }),
    persist
  );
}

case ACTIONS.CLAIM_BUNDLE_REWARD: {
  const persist = claimBundleReward(state.persist, action.bundleId, action.rewardId);
  return replacePersist(
    replaceRun(state, { openedBundleId: null }),
    persist
  );
}

case ACTIONS.CLOSE_BUNDLE:
  return replaceRun(state, { openedBundleId: null });
```

---

## 7. Legacy bridge changes

The bridge currently only accepts fields in `LEGACY_RUN_FIELDS`. If Results/Market state needs to mirror between store and legacy during migration, add the new fields:

```js
'lastReadingLedger',
'lastResults',
'openedBundleId',
```

Persist sync should include:

```js
if ('marketTracks' in persist) next.marketTracks = { ...persist.marketTracks };
if ('pendingBundles' in persist) next.pendingBundles = [...persist.pendingBundles];
if ('claimedMarketRewards' in persist) next.claimedMarketRewards = [...persist.claimedMarketRewards];
if ('pendingCardChoice' in persist) next.pendingCardChoice = persist.pendingCardChoice;
```

Also update `app/legacyBridge.mjs` if the validation script requires exact bridge field parity.

---

## 8. Selectors

Add selectors in `src/game/selectors.mjs`:

```js
export function resultsView(state) {
  return state.run.lastResults || null;
}

export function pendingBundleViews(state) {
  return (state.persist.pendingBundles || [])
    .filter(bundle => bundle.state !== 'claimed')
    .map(bundle => ({
      ...bundle,
      display: MARKET_BUNDLES[bundle.bundleId],
    }));
}

export function openedBundleView(state) {
  const id = state.run.openedBundleId;
  if (!id) return null;
  const bundle = (state.persist.pendingBundles || []).find(b => b.id === id);
  if (!bundle) return null;
  return {
    ...bundle,
    display: MARKET_BUNDLES[bundle.bundleId],
    choices: (bundle.rewardChoices || []).map(id => MARKET_REWARDS[id]).filter(Boolean),
  };
}
```

---

## 9. UI implementation plan

### 9.1 Results UI

New file:

```text
src/ui/renderResults.mjs
```

Responsibilities:

- Show final score/threshold.
- Show only meaningful track deltas.
- Highlight completed deltas.
- Show count of generated bundles.
- Button: `Enter Market`.

Do not render reward choices here.

### 9.2 Market UI

Modify `src/ui/renderMarket.mjs` after systems are in place.

Market surface should use pending bundles:

```js
const bundles = pendingBundleViews(storeState);
```

Render row format:

```html
<div class="store-card store-card--bundle store-card--bundle-sequence">
  <div class="store-card-tag">Bundle</div>
  <div class="store-card-art">...</div>
  <div class="store-card-main">
    <div class="store-card-name">Sequence Bundle</div>
    <div class="store-card-desc">Open to reveal a Sequence reward.</div>
  </div>
  <button class="store-card-buy">Open ✦</button>
</div>
```

Top right reserve replacement:

```text
Bundles 2
```

Do not remove existing reserve styles yet; add bundle-specific display path.

### 9.3 Bundle open modal/drawer

Can be in `renderMarket.mjs` initially or new:

```text
src/ui/renderBundleOverlay.mjs
```

Shows:

- Bundle name.
- `Choose 1 reward`.
- Three reward cards.
- Reroll button if enabled later.
- Close/back button.

Claiming dispatches `CLAIM_BUNDLE_REWARD`.

### 9.4 Empty Market fallback

If no pending bundles exist:

```text
The Market is quiet.
```

For prototype, show a fallback `General Bundle` only if we decide every clear must reward the player.

---

## 10. Reward application details

### 10.1 Upgrade rewards

Use the same upgrade keys already present in `DEFAULT_UPGRADES`.

```js
function applyUpgradeReward(persist, { upgradeKey, amount = 1 }) {
  return {
    ...persist,
    upgrades: {
      ...persist.upgrades,
      [upgradeKey]: (persist.upgrades[upgradeKey] || 0) + amount,
    },
  };
}
```

### 10.2 Relic rewards

Use current relic slot cap from `maxRelicSlots()`.

If full:

- Option A: reject and ask player to replace.
- Option B: do not offer relic rewards when full.

Prototype should use Option B to keep bundle flow simple.

### 10.3 Stamp rewards

Five Star Stamp and Suit Stamp require a card selection step. Do not instantly mutate.

Set:

```js
persist.pendingCardChoice = {
  kind: 'stamp',
  stampId: 'five_star',
  sourceRewardId: 'five_star_stamp',
};
```

Then existing stamp selection UI can be reused or added later. First implementation can avoid offering stamp rewards until card-choice flow exists, or include the field and show a simple selection modal.

---

## 11. Refresh/reroll behavior

Current Market has `REFRESH ✦ 10`. In the new bundle system:

- Top-left refresh can become **reroll unopened bundles** later.
- First prototype: keep it visible but disabled, or let it reroll bundle identities only if there are unopened bundles.
- Bundle reward choices should have per-bundle reroll later, inside the opened bundle overlay.

Do not retain Reserve spending as the core Market cost.

Recommended prototype behavior:

```text
REFRESH ✦ 10 remains visually present but disabled until reroll design is implemented.
```

---

## 12. Validation plan

Add new validation script:

```text
scripts/validate-market-bundles.mjs
```

Test cases:

1. Initial persist has default track state and empty pending bundles.
2. Sequence progress below threshold creates no bundle.
3. Sequence progress crossing first threshold creates one Sequence Bundle.
4. Crossing multiple Sequence thresholds creates one higher-tier Sequence Bundle, not multiple duplicate bundles.
5. Restless progress creates Restless Bundle at threshold.
6. Multiple tracks can generate multiple bundles from one ledger.
7. Opening a bundle generates saved choices.
8. Re-opening/rendering an opened bundle does not regenerate choices.
9. Claiming a reward applies the upgrade/relic/stamp effect.
10. Claimed bundle no longer appears in Market bundle list.
11. Old save data without market fields deserializes safely.
12. Existing `validate-all.mjs` still passes.

Add this script to `scripts/validate-all.mjs` after stable.

---

## 13. Implementation phases

### Phase 1 — Data-only track/bundle core

Files:

- `src/data/marketTracks.mjs`
- `src/data/marketBundles.mjs`
- `src/data/marketRewards.mjs`
- `src/systems/readingLedger.mjs`
- `src/systems/marketTracks.mjs`
- `src/systems/marketBundles.mjs`
- `scripts/validate-market-bundles.mjs`

Goal:

Pure logic passes tests. No UI changes yet.

### Phase 2 — State/reducer integration

Files:

- `src/game/state.mjs`
- `src/game/actions.mjs`
- `src/game/reducer.mjs`
- `src/game/selectors.mjs`
- bridge files if needed

Goal:

A cleared reading creates Results data and pending bundles.

### Phase 3 — Results screen

Files:

- `src/ui/renderResults.mjs`
- app/router/render orchestrator files as needed

Goal:

Player sees track progress and generated bundle count before entering Market.

### Phase 4 — Bundle Market surface

Files:

- `src/ui/renderMarket.mjs`
- market CSS in existing inline style or extracted stylesheet later

Goal:

Market shows only bundle rows and Next Reading.

### Phase 5 — Bundle open/claim overlay

Files:

- `src/ui/renderBundleOverlay.mjs` or `renderMarket.mjs`

Goal:

Open bundle, reveal choices, choose one, apply reward.

### Phase 6 — Balance pass

Tune:

- track thresholds,
- pool contents,
- tier scaling,
- bundle counts,
- fallback rewards,
- reserve/relic effects that no longer fit.

---

## 14. Open design questions before implementation

1. Should every cleared threshold create at least one bundle, even if no track completes?
2. Should `miser`, `offering`, and Reserve-related relics/upgrades be converted immediately or left dormant during the prototype?
3. Should Five Star Stamp be enabled in the first bundle prototype, or delayed until card-choice UI is ready?
4. Should bundle reward choices be exactly 3 always, or allow 2 when pools are small?
5. Should unopened bundles persist across readings if the player skips them, or must all bundles be claimed before `NEXT READING`?
6. Should a bundle be claimable immediately from Results, or only after entering Market?

Recommended defaults:

- No guaranteed fallback bundle in first test unless play feels unrewarding.
- Disable/convert Reserve-only effects later, not in the first logic pass.
- Do not allow `NEXT READING` until all opened bundles are claimed; unopened bundles can remain pending only if this is intentional.
- Start with exactly 3 choices where possible.

---

## 15. Definition of done for first prototype

The first playable prototype is done when:

- Clearing a reading produces a Results screen.
- Results screen shows Sequence/Restless/Court progress.
- Completing Sequence or Restless creates a pending bundle.
- Market shows only pending bundle rows.
- Opening a bundle reveals reward choices.
- Claiming a reward applies it.
- Reserve is not required to claim bundle rewards.
- Existing gameplay, scoring, relics, card play, and threshold flow still pass validation.
