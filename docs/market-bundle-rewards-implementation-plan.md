# Market Bundle Rewards - Grounded Implementation Plan

This replaces the first draft of this plan. The first draft mixed design examples with implementation facts. This version starts from the current repo data and only proposes new concepts where the existing code does not already have one.

Core decision remains:

- Results explains track progress and bundle unlocks.
- Market only shows unopened reward bundles.
- Opening a bundle reuses the existing pack-like choose-one pattern.
- The first implementation should be data-first and should not invent new reward ids when an existing `SHOP` key already represents the reward.

---

## 1. Verified repo inventory

### 1.1 State ownership

Store-side persistent state currently lives in `createInitialPersistState()`:

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
```

Store-side run state currently includes fields we can use for end-of-reading telemetry:

```js
run: {
  phase,
  reading,
  thresholdIndex,
  roundScore,
  setScores,
  roundDiscardCount,
  roundPatternCount,
  discardedCards,
  abilityTakenCardIds,
  sightChargesUsed,
  lastScore,
  lastSetScore,
  lastThreshold,
  lastPassed,
  lastOutcome,
}
```

Legacy runtime state is still separate. It uses `persist.pool` and `persist.up`, then bridges to store-side `reserve` and `upgrades`.

Implementation implication:

- New durable bundle/track fields should be added to store-side `persist`.
- If the legacy UI reads or writes them before migration is complete, matching fields must also be mirrored into legacy `persist`.
- The bridge currently syncs `reserve`, `totalScore`, `upgrades`, `relics`, `relicUsed`, and `stampedMajors`. It does not yet sync `stampedFive`, market progress, pending bundles, or last results.

### 1.2 Existing Market rows

The current Market UI is already the right visual structure for the bundle screen:

- candle at top,
- compact meta row,
- vertical full-width offer rows,
- left art,
- center title/description,
- right action button,
- bottom `Next Reading` button.

The current `openShopMain()` renders:

```html
store-meta
store-offer-row
  scoring card
  pack card
  relic/vessel card
store-footer
  Next Reading
```

Implementation implication:

- Do not make a new full-screen reward menu.
- Replace the current three offer rows with bundle rows when the bundle system is active.
- Preserve the existing `store-card` row component style as much as possible.

### 1.3 Existing rewards and packs

The current authoritative live market data is `src/data/legacyMarket.mjs`.

Important existing pack ids:

```js
PACKS = {
  foundation,
  ritual,
  pattern,
  innate,
  restless,
  relic,
  second_sight,
  thread,
}
```

Important clarification:

- `restless` exists today as a **pack id**: `Restless Hands Pack`.
- `restless` is **not** currently a gameplay track entity.
- It maps to the `draw` SHOP category.
- If we use `Restless Bundle` as a player-facing bundle name, the implementation should still treat the track as a new `draw_discard` track unless we deliberately choose to reuse `restless` as the track id.

Existing `Restless Hands Pack` reward keys in `SHOP`:

```js
discards
mulligan
ritual_depth
nimble_fingers
quick_release
```

Existing Sequence-related reward keys in `SHOP`:

```js
sequence      // paired with seq_mult in old scoring upgrade flow
five_stamp    // stamp picker reward, not a numeric upgrade
first_light   // existing Innate reward that can serve as first-pass bridge-style reward
```

Existing Court-related reward keys in `SHOP`:

```js
court_chips          // paired with court_mult
royal_court_chips    // paired with royal_court_mult
suit_stamp           // stamp picker reward
rank                 // rank pattern reward, paired with rank_mult
```

Existing stamp flow:

- `openFiveStampPicker()` selects any non-stamped card and writes `persist.stampedFive`.
- `openStampPicker()` selects eligible Major Arcana and writes `persist.stampedMajors`.

Implementation implication:

- First-pass bundle rewards should choose from existing `SHOP` keys.
- Bundle choices should not create new reward ids like `major_bridge` unless we also implement a real data definition for it.
- For first pass, display the existing reward names from `SHOP`.
- Later we can add bundle-specific display aliases, but the apply layer should still point to a real `SHOP` key or real relic id.

### 1.4 Existing pack opening behavior

Current paid pack opening already does most of the UX we want:

- `buyPack(packId, cost)` charges Reserve, plays pack animation, then reveals a choose-one picker.
- `buildUpgradePicker(packId)` gets the pack pool from `PACKS[packId].pool`, finds matching `SHOP` rows, shuffles them, and shows 3 options.
- `pickPackUpgrade(upgradeKey)` applies the selected upgrade through the store purchase bridge.

Implementation implication:

- Bundle opening should reuse the same animation/choice style, but **not** use the paid `buyPack()` path.
- Bundle choices must be generated once and saved into the bundle. Current pack picker re-randomizes from the pool when built, which is not safe for save/load or rerender.
- Bundle claiming should apply a free reward. It should not dispatch a fake paid pack purchase with cost 0 unless that is explicitly wrapped and validated.

### 1.5 Existing scoring telemetry

`computeScore()` returns a score object with `melds` and `finalScore`.

Meld names are generated from current logic:

```js
Three of a Kind (${rank}s)
Four of a Kind (${rank}s)
Full Court (${tier})
Royal Court (${tier}, ${royalSuit})
Sequence of ${tier}
Path of the Magi
```

Implementation implication:

- Track progress should read `score.melds` after scoring.
- Do not re-detect scoring patterns in the track system.
- If a pattern name changes later, the ledger helper must be updated or moved closer to scoring constants.

### 1.6 Existing action telemetry

Current reliable telemetry:

```js
run.roundDiscardCount
run.roundPatternCount
run.setScores
run.roundScore
run.discardedCards
run.abilityTakenCardIds
run.sightChargesUsed
```

`roundDiscardCount` increments when `DISCARD_SELECTED` succeeds.

Implementation implication:

- First-pass draw/discard progress can use `roundDiscardCount`.
- Do not build a Sight track yet unless we add reliable ability-use counters. `sightChargesUsed` only tracks free sight charges, not all sight use.
- Do not build a Purge track yet unless we add a `roundPurgeCount` counter. `CONFIRM_PURGE` currently exists, but the reducer/run state does not expose a cumulative purge counter in the same way.
- Do not build a Relic trigger track yet unless we add relic trigger telemetry.

---

## 2. First-pass scope

Implement only these three tracks:

```js
sequence
court
draw_discard
```

Player-facing bundle names:

```js
sequence_bundle -> Sequence Bundle
court_bundle -> Court Bundle
draw_discard_bundle -> Restless Bundle
```

Why `draw_discard` instead of `restless` as the track id?

- `restless` already means an existing pack id.
- The new track should describe the measured behavior: draw/discard play.
- The bundle can still be called `Restless Bundle` to match existing market language.

Do not implement these tracks in first pass:

```js
sight
thread
purge
relic
stamp
major
royal_court as a separate track
```

They are candidates after telemetry is added or after the core loop is proven.

---

## 3. Data model

### 3.1 New `src/data/marketBundleTracks.mjs`

This file owns track config, bundle display metadata, and reward key pools. It should use existing `SHOP` keys.

```js
export const MARKET_BUNDLE_TRACKS = Object.freeze({
  sequence: {
    id: 'sequence',
    label: 'Sequence',
    thresholds: [2, 5, 10, 18, 30],
    bundleId: 'sequence_bundle',
    progressMetric: 'sequenceMelds',
  },

  court: {
    id: 'court',
    label: 'Court',
    thresholds: [2, 5, 9, 14, 20],
    bundleId: 'court_bundle',
    progressMetric: 'courtMelds',
  },

  draw_discard: {
    id: 'draw_discard',
    label: 'Draw/Discard',
    thresholds: [3, 8, 15, 25],
    bundleId: 'draw_discard_bundle',
    progressMetric: 'discardsUsed',
  },
});
```

Threshold notes:

- These are placeholder tuning values.
- They are cumulative within the run.
- Each claimed tier raises the next target.
- If a reading jumps across multiple thresholds, generate one bundle at the highest reached tier.

### 3.2 Bundle display data

```js
export const MARKET_BUNDLES = Object.freeze({
  sequence_bundle: {
    id: 'sequence_bundle',
    trackId: 'sequence',
    name: 'Sequence Bundle',
    description: 'Open to reveal a Sequence reward.',
    categoryLabel: 'Bundle',
    icon: 'isp-pattern',
    accentClass: 'store-card--bundle-sequence',
  },

  court_bundle: {
    id: 'court_bundle',
    trackId: 'court',
    name: 'Court Bundle',
    description: 'Open to reveal a Court reward.',
    categoryLabel: 'Bundle',
    icon: 'isp-kin',
    accentClass: 'store-card--bundle-court',
  },

  draw_discard_bundle: {
    id: 'draw_discard_bundle',
    trackId: 'draw_discard',
    name: 'Restless Bundle',
    description: 'Open to reveal a Restless reward.',
    categoryLabel: 'Bundle',
    icon: 'isp-restless',
    accentClass: 'store-card--bundle-restless',
    sourcePackId: 'restless',
  },
});
```

### 3.3 Reward pools use existing `SHOP` keys

```js
export const MARKET_BUNDLE_REWARD_POOLS = Object.freeze({
  sequence_bundle: {
    common: ['sequence', 'five_stamp', 'first_light'],
    later: ['sequence', 'five_stamp', 'first_light', 'path_chips'],
  },

  court_bundle: {
    common: ['court_chips', 'royal_court_chips', 'suit_stamp'],
    later: ['court_chips', 'royal_court_chips', 'suit_stamp', 'rank'],
  },

  draw_discard_bundle: {
    common: ['discards', 'mulligan', 'nimble_fingers'],
    later: ['discards', 'mulligan', 'ritual_depth', 'nimble_fingers', 'quick_release'],
  },
});
```

Important:

- `first_light` is an existing `SHOP` key. Do not display it as `Major Bridge` in implementation unless a separate display alias is added.
- `sequence` has a paired key `seq_mult` in legacy market data. Claim logic must respect `SHOP[key][6]` just like the scoring row does.
- `court_chips`, `royal_court_chips`, `rank`, `path_chips`, `balanced_reading`, and `elemental_harmony` also have paired keys in legacy market data. Bundle reward application must support paired keys generally.
- `five_stamp` and `suit_stamp` are not simple numeric upgrades. They must route to the existing stamp picker flow or an equivalent pending-card-choice state.

---

## 4. Persist/run state additions

### 4.1 Store-side persist additions

Add defaults to `createInitialPersistState()`:

```js
marketBundleProgress: normalizeMarketBundleProgress(overrides.marketBundleProgress),
pendingRewardBundles: Array.isArray(overrides.pendingRewardBundles) ? [...overrides.pendingRewardBundles] : [],
claimedRewardBundleIds: Array.isArray(overrides.claimedRewardBundleIds) ? [...overrides.claimedRewardBundleIds] : [],
```

Track progress shape:

```js
marketBundleProgress: {
  sequence: {
    total: 0,
    claimedTier: 0,
    nextThreshold: 2,
  },
  court: {
    total: 0,
    claimedTier: 0,
    nextThreshold: 2,
  },
  draw_discard: {
    total: 0,
    claimedTier: 0,
    nextThreshold: 3,
  },
}
```

Pending bundle shape:

```js
{
  id: 'bundle_r3_sequence_t2',
  bundleId: 'sequence_bundle',
  trackId: 'sequence',
  tier: 2,
  state: 'unopened', // unopened | opened | claimed
  rewardKeys: null, // set when opened
  claimedRewardKey: null,
  source: {
    reading: 3,
    thresholdIndex: 2,
    reason: 'Sequence Complete',
  },
}
```

### 4.2 Store-side run additions

Add defaults to `createInitialRunState()`:

```js
lastReadingLedger: overrides.lastReadingLedger || null,
lastResults: overrides.lastResults || null,
openedBundleId: overrides.openedBundleId || null,
```

### 4.3 Legacy runtime state additions

If legacy UI owns the first implementation, also add matching fields to `createInitialPersist()` in `runtimeState.mjs`:

```js
marketBundleProgress: {},
pendingRewardBundles: [],
claimedRewardBundleIds: [],
```

The bridge must sync these fields in both directions while both state systems are live.

### 4.4 Save compatibility

`save.mjs` serializes the entire `persist` object and deserializes through `createInitialPersistState()`. Adding default fields in state is enough for old saves. Do not bump `SAVE_VERSION` unless testing shows old saves break.

---

## 5. Reading ledger

### 5.1 New `src/systems/readingLedger.mjs`

Build a ledger from existing score/run data.

```js
export function buildReadingLedger({ state, score, threshold, passed }) {
  const { run } = state;
  const cards = (run.spread || []).filter(Boolean);
  const patternCounts = patternCountsFromMelds(score?.melds || []);

  return {
    id: `reading_${run.reading || 1}_threshold_${run.thresholdIndex || 0}`,
    reading: run.reading || 1,
    thresholdIndex: run.thresholdIndex || 0,
    score: {
      finalScore: score?.finalScore || 0,
      threshold,
      cleared: !!passed,
    },
    patterns: patternCounts,
    cards: {
      majorsPlaced: cards.filter(card => card.type === 'major').length,
      courtsPlaced: cards.filter(card => card.type === 'court').length,
      stampedFiveScored: countStamped(cards, state.persist?.stampedFive),
      stampedMajorsScored: countStamped(cards, state.persist?.stampedMajors),
    },
    actions: {
      discardsUsed: run.roundDiscardCount || 0,
      abilityTakenCards: (run.abilityTakenCardIds || []).length,
    },
  };
}
```

Pattern parser:

```js
export function patternCountsFromMelds(melds = []) {
  const counts = {
    sequenceMelds: 0,
    fullCourtMelds: 0,
    royalCourtMelds: 0,
    rankMelds: 0,
    pathMelds: 0,
  };

  for (const meld of melds) {
    const name = Array.isArray(meld) ? meld[0] : meld?.name;
    if (!name) continue;
    if (name.startsWith('Sequence of ')) counts.sequenceMelds += 1;
    else if (name.startsWith('Full Court')) counts.fullCourtMelds += 1;
    else if (name.startsWith('Royal Court')) counts.royalCourtMelds += 1;
    else if (name.startsWith('Three of a Kind') || name.startsWith('Four of a Kind')) counts.rankMelds += 1;
    else if (name === 'Path of the Magi') counts.pathMelds += 1;
  }

  counts.courtMelds = counts.fullCourtMelds + counts.royalCourtMelds;
  return counts;
}
```

Do not add Sight, Thread, Purge, Relic, or Stamp tracks until ledger telemetry exists for them.

---

## 6. Track advancement and bundle generation

### 6.1 New `src/systems/marketBundleProgress.mjs`

Public API:

```js
export function normalizeMarketBundleProgress(overrides = {})
export function advanceMarketBundleProgress(persist, ledger)
export function completedTierForTotal(trackConfig, total)
export function nextThreshold(trackConfig, claimedTier)
```

Main result shape:

```js
{
  persist,
  deltas: [
    {
      trackId: 'sequence',
      label: 'Sequence',
      before: 3,
      gained: 2,
      after: 5,
      threshold: 5,
      completed: true,
      completedTier: 2,
      bundleId: 'bundle_r3_sequence_t2',
    }
  ],
  generatedBundles: [bundle]
}
```

Progress mapping:

```js
function progressFromLedger(trackId, ledger) {
  switch (trackId) {
    case 'sequence':
      return ledger.patterns.sequenceMelds || 0;
    case 'court':
      return ledger.patterns.courtMelds || 0;
    case 'draw_discard':
      return ledger.actions.discardsUsed || 0;
    default:
      return 0;
  }
}
```

Compression rule:

- If progress crosses multiple thresholds in one reading, generate one bundle at the highest completed tier.
- Example: Sequence total `1 -> 10` with thresholds `[2, 5, 10]` creates one tier 3 Sequence Bundle.

Bundle id rule:

```js
`bundle_r${ledger.reading}_${trackId}_t${completedTier}`
```

If that id already exists in `pendingRewardBundles` or `claimedRewardBundleIds`, append a short suffix or do not generate a duplicate.

---

## 7. Bundle opening and reward claiming

### 7.1 New `src/systems/marketRewardBundles.mjs`

Public API:

```js
export function pendingBundleViews(persist)
export function openRewardBundle(persist, bundleInstanceId, options = {})
export function claimRewardFromBundle(persist, bundleInstanceId, rewardKey)
export function applyFreeShopReward(persist, rewardKey)
export function legalRewardKeysForBundle(persist, bundle, options = {})
```

Opening behavior:

- Find bundle by instance id.
- If `state !== 'unopened'`, return unchanged.
- Generate 3 legal `SHOP` keys when possible.
- Save them to `bundle.rewardKeys`.
- Set `state = 'opened'`.
- Do not regenerate choices on render.

Legal reward filtering:

- Key must exist in `SHOP`.
- If key is a numeric upgrade, it should not exceed an optional cap if one is defined.
- If key is `five_stamp`, only offer if there is at least one eligible card or if we can safely show the picker later.
- If key is `suit_stamp`, only offer if there is an eligible Major with suits.
- Retired `SHOP` categories should not appear unless explicitly listed in a bundle pool.

Claiming behavior:

- If reward is `five_stamp`, mark bundle claimed and open existing Five Star picker from UI, or set a pending card choice if implementing in reducer-only flow.
- If reward is `suit_stamp`, same but use Suit Stamp picker.
- Otherwise apply it as a free upgrade using the existing `SHOP` key.
- Respect paired keys: `SHOP[rewardKey][6]` should also increment if present.

Store-side helper:

```js
export function applyFreeShopReward(persist, rewardKey, shop = SHOP) {
  const row = shop[rewardKey];
  if (!row) return { persist, applied: false, reason: 'missing_shop_key' };

  if (rewardKey === 'five_stamp') return { persist, applied: false, reason: 'requires_five_stamp_picker' };
  if (rewardKey === 'suit_stamp') return { persist, applied: false, reason: 'requires_suit_stamp_picker' };

  const pairedKey = row[6] || null;
  const upgrades = { ...(persist.upgrades || {}) };
  upgrades[rewardKey] = (upgrades[rewardKey] || 0) + 1;
  if (pairedKey) upgrades[pairedKey] = (upgrades[pairedKey] || 0) + 1;

  return { persist: { ...persist, upgrades }, applied: true, rewardKey, pairedKey };
}
```

Legacy helper must mirror this for `persist.up` while legacy state is still active.

---

## 8. Reducer integration

### 8.1 New actions

Add to `ACTIONS`:

```js
ENTER_MARKET_FROM_RESULTS: 'ENTER_MARKET_FROM_RESULTS',
OPEN_REWARD_BUNDLE: 'OPEN_REWARD_BUNDLE',
CLAIM_REWARD_BUNDLE_CHOICE: 'CLAIM_REWARD_BUNDLE_CHOICE',
CLOSE_REWARD_BUNDLE: 'CLOSE_REWARD_BUNDLE',
```

Add phase:

```js
RESULTS: 'results'
```

### 8.2 Scoring pass integration

Current pass goes directly to `GAME_PHASES.MARKET` and adds `pendingReserve`. New flow should go to `GAME_PHASES.RESULTS` and create bundle data.

Reducer pass path:

```js
const ledger = buildReadingLedger({ state, score, threshold, passed: true });
const bundleProgress = advanceMarketBundleProgress(persist, ledger);

return {
  ...state,
  run: {
    ...state.run,
    ...common,
    phase: GAME_PHASES.RESULTS,
    thresholdIndex: run.thresholdIndex + 1,
    lastPassed: true,
    lastOutcome: 'pass',
    awaitingNextSet: false,
    pendingReserve: 0,
    lastReadingLedger: ledger,
    lastResults: {
      finalScore: roundScore,
      threshold,
      cleared: true,
      trackDeltas: bundleProgress.deltas,
      generatedBundleIds: bundleProgress.generatedBundles.map(bundle => bundle.id),
    },
    worldCarry: worldCarryFromRelics(persist.relics, roundScore, threshold),
    relicEarned: false,
  },
  persist: {
    ...bundleProgress.persist,
    totalScore: persist.totalScore + roundScore,
  },
};
```

Reserve notes:

- First prototype should not use Reserve to claim bundles.
- Keep `reserve`/`pool` fields for compatibility.
- Do not delete Reserve-related relics yet.
- `Offering`, `Merchant's Scale`, and `Miser` need separate design conversion later. Until then, their legacy effects may remain inert or only relevant when old Market is enabled.

### 8.3 Bundle actions

```js
case ACTIONS.ENTER_MARKET_FROM_RESULTS:
  return replaceRun(state, { phase: GAME_PHASES.MARKET });

case ACTIONS.OPEN_REWARD_BUNDLE: {
  const nextPersist = openRewardBundle(state.persist, action.bundleId, { rng: action.rng || Math.random });
  return replacePersist(replaceRun(state, { openedBundleId: action.bundleId }), nextPersist);
}

case ACTIONS.CLAIM_REWARD_BUNDLE_CHOICE: {
  const result = claimRewardFromBundle(state.persist, action.bundleId, action.rewardKey);
  return replacePersist(replaceRun(state, { openedBundleId: null, lastBundleClaim: result }), result.persist);
}

case ACTIONS.CLOSE_REWARD_BUNDLE:
  return replaceRun(state, { openedBundleId: null });
```

---

## 9. Results and Market UI plan

### 9.1 Results UI

Add `src/ui/renderResults.mjs`.

Responsibilities:

- Show final score and threshold result.
- Show only track deltas with `gained > 0` or `completed === true`.
- Say how many bundles were added.
- Button: `Enter Market`.

Example:

```text
Results
64 / 30

Sequence Complete
Restless Bundle added

Court 1 / 2

Enter Market
```

The Results screen is where track progress belongs. Do not repeat progress in the Market.

### 9.2 Market surface

Modify `renderMarket.mjs` so when `pendingRewardBundles` exists, it renders bundle rows instead of old scoring/pack/relic rows.

Meta row:

```text
Refresh     Bundles 2
```

Bundle row:

```html
<div class="store-card store-card--bundle store-card--bundle-sequence">
  <div class="store-card-tag">Bundle</div>
  <div class="store-card-art"><span class="isp isp-108 isp-pattern"></span></div>
  <div class="store-card-main">
    <div class="store-card-name">Sequence Bundle</div>
    <div class="store-card-desc">Open to reveal a Sequence reward.</div>
  </div>
  <button class="store-card-buy" onclick="openRewardBundle('bundle_r3_sequence_t2')">Open ✦</button>
</div>
```

Do not show reward choices or thresholds in the row.

### 9.3 Bundle choice overlay

Reuse the existing pack picker layout, but build from saved `bundle.rewardKeys` instead of a random pack pool.

Create one of:

- `src/ui/renderRewardBundlePicker.mjs`, or
- bundle-specific functions inside `shopOverlayFlow.mjs` if keeping pack UI together is simpler.

Picker text:

```text
Sequence Bundle
Choose 1 reward.
```

Cards use existing `SHOP` tuple data:

```js
const row = SHOP[rewardKey];
name = row[0];
desc = row[1];
icon = SHOP_ICON[rewardKey];
level = persist.up[rewardKey] || 0;
```

### 9.4 Existing pack animation

Use `animatePackOpen()` for bundles if possible.

Do not call `buyPack()` because it charges Reserve and uses paid pack purchase logic.

Add a new function:

```js
openRewardBundleWithAnimation(bundleId)
```

Flow:

1. Dispatch `OPEN_REWARD_BUNDLE`.
2. Animate using bundle display data.
3. Show saved choices.

---

## 10. Bridge and migration requirements

### 10.1 Store to legacy

When bundle progress is generated store-side, legacy UI needs access if `renderMarket.mjs` remains legacy-global driven.

Add bridge sync fields:

```js
marketBundleProgress
pendingRewardBundles
claimedRewardBundleIds
```

Also sync `stampedFive`, which current bridge does not include.

### 10.2 Legacy to store

When legacy UI claims a bundle reward, it must update store-side `persist`.

Preferred path:

- add reducer actions for bundle open/claim,
- call those actions from legacy UI,
- then copy back `persist.up`, `persist.pool`, `persist.stampedMajors`, `persist.stampedFive`, and bundle fields.

Avoid mutating legacy `persist` only, because that will drift from store state.

### 10.3 Validation bridge parity

`scripts/validate-bridge.mjs` expects bridge fields to match. Update it when adding new synced fields.

---

## 11. Validation plan

Add `scripts/validate-market-bundles.mjs`.

Minimum tests:

1. Old persist without bundle fields deserializes with valid defaults.
2. Ledger parser counts `Sequence of 3`, `Sequence of 4`, `Full Court (3)`, and `Royal Court (3, Wands)` correctly.
3. Sequence progress below threshold generates no bundle.
4. Sequence progress crossing threshold generates one `sequence_bundle`.
5. Jumping across multiple Sequence thresholds generates one highest-tier bundle.
6. Draw/discard progress uses `roundDiscardCount` and creates `draw_discard_bundle` at threshold.
7. Court progress uses Full/Royal Court melds and creates `court_bundle` at threshold.
8. Opening a bundle generates and saves reward keys.
9. Re-rendering an opened bundle does not regenerate reward keys.
10. Claiming `sequence` increments `upgrades.sequence` and paired `upgrades.seq_mult`.
11. Claiming `court_chips` increments paired `court_mult`.
12. Claiming `five_stamp` does not silently mutate a random card; it enters stamp-selection flow or returns a clear pending-choice result.
13. Claimed bundles disappear from Market rows.
14. `validate-all.mjs` still passes after adding this validation script.

---

## 12. Implementation phases

### Phase 1 - repo-grounded data only

Add:

- `src/data/marketBundleTracks.mjs`
- `src/systems/readingLedger.mjs`
- `src/systems/marketBundleProgress.mjs`
- `src/systems/marketRewardBundles.mjs`
- `scripts/validate-market-bundles.mjs`

No UI changes.

### Phase 2 - store state and reducer

Modify:

- `src/game/state.mjs`
- `src/game/actions.mjs`
- `src/game/reducer.mjs`
- `src/game/selectors.mjs`

Goal:

- clearing a threshold creates `lastResults` and pending bundles.

### Phase 3 - Results screen

Add:

- `src/ui/renderResults.mjs`

Wire phase routing so `GAME_PHASES.RESULTS` appears before Market.

### Phase 4 - bundle Market rows

Modify:

- `src/ui/renderMarket.mjs`

Goal:

- Market shows only bundle rows when pending bundles exist.
- Top right says bundle count instead of Reserve.
- No track progress appears in Market.

### Phase 5 - bundle opening and claiming

Modify/add:

- `src/app/shopOverlayFlow.mjs`
- optional `src/ui/renderRewardBundlePicker.mjs`

Goal:

- opening a bundle reveals saved reward choices.
- claiming a choice applies the free reward.
- stamp rewards route to existing stamp picker.

### Phase 6 - reserve conversion pass

Separate design pass for:

- `offering`,
- `miser`,
- `merchants_scale`,
- refresh cost,
- any UI still showing Reserve.

Do not solve this in Phase 1.

---

## 13. Open decisions before coding

1. Should `draw_discard_bundle` display as `Restless Bundle` or `Restless Hands Bundle`?
2. Should `sequence_bundle` include `first_light` in first pass, or should the pool allow only 2 rewards until a real third Sequence reward exists?
3. Should `court_bundle` combine Full Court and Royal Court, or should Royal Court get a later separate bundle?
4. Can the player leave Market with unopened bundles, or must all bundles be opened before `Next Reading`?
5. Should `Refresh` reroll unopened bundles, reroll opened bundle choices, or remain disabled in the first prototype?
6. Should bundle rewards respect current upgrade max levels? If yes, where do max levels live for legacy `SHOP` keys?

Recommended defaults:

- Display `draw_discard_bundle` as `Restless Bundle`, but keep `draw_discard` as the track id.
- Allow 2-choice bundles if only 2 fully appropriate rewards exist.
- Combine Full Court and Royal Court into one Court track for first pass.
- Do not allow `Next Reading` while an opened bundle has unclaimed choices.
- Leave Refresh disabled for first prototype.
- Add explicit max-level metadata only if reward filtering needs it during testing.

---

## 14. Definition of done for first prototype

Done means:

- Sequence, Court, and Draw/Discard progress are generated from existing score/run data.
- Completing a threshold creates a pending bundle.
- Results screen shows progress and bundle unlocks.
- Market shows only bundles, not track math.
- Opening a bundle reveals saved reward choices.
- Claiming a reward applies an existing `SHOP` key or routes to the existing stamp picker.
- Reserve is not required for bundle claiming.
- Existing scoring, pack opening, Market row styling, and bridge validations continue to pass.
