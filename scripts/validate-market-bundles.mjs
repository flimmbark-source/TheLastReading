import assert from 'node:assert/strict';

import { ACTIONS } from '../src/game/actions.mjs';
import { createGameState, createInitialPersistState, GAME_PHASES } from '../src/game/state.mjs';
import { reducer } from '../src/game/reducer.mjs';
import { patternCountsFromMelds } from '../src/systems/readingLedger.mjs';
import { advanceMarketBundleProgress } from '../src/systems/marketBundleProgress.mjs';
import { claimRewardFromBundle, openRewardBundle } from '../src/systems/marketRewardBundles.mjs';

function ledger(overrides = {}) {
  return {
    id: 'reading_1_threshold_0',
    reading: 1,
    thresholdIndex: 0,
    patterns: { sequenceMelds: 0, courtMelds: 0, fullCourtMelds: 0, royalCourtMelds: 0, rankMelds: 0, pathMelds: 0 },
    actions: { discardsUsed: 0, abilityTakenCards: 0 },
    ...overrides,
  };
}

{
  const persist = createInitialPersistState();
  assert.equal(persist.marketBundleProgress.sequence.nextThreshold, 2, 'sequence starts at first threshold');
  assert.equal(persist.marketBundleProgress.court.nextThreshold, 2, 'court starts at first threshold');
  assert.equal(persist.marketBundleProgress.draw_discard.nextThreshold, 3, 'draw/discard starts at first threshold');
  assert.deepEqual(persist.pendingRewardBundles, [], 'pending bundles start empty');
}

{
  const counts = patternCountsFromMelds([
    { name: 'Sequence of 3' },
    { name: 'Sequence of 4' },
    { name: 'Full Court (3)' },
    { name: 'Royal Court (3, Wands)' },
    { name: 'Three of a Kind (Pages)' },
    { name: 'Path of the Magi' },
  ]);
  assert.equal(counts.sequenceMelds, 2, 'counts Sequence of N melds');
  assert.equal(counts.courtMelds, 2, 'counts Full/Royal Court melds');
  assert.equal(counts.rankMelds, 1, 'counts rank melds');
  assert.equal(counts.pathMelds, 1, 'counts Path of the Magi');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ patterns: { sequenceMelds: 1 } }));
  assert.equal(result.generatedBundles.length, 0, 'sequence below threshold creates no bundle');
  assert.equal(result.persist.marketBundleProgress.sequence.total, 1, 'sequence progress is stored');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ patterns: { sequenceMelds: 2 } }));
  assert.equal(result.generatedBundles.length, 1, 'sequence threshold creates one bundle');
  assert.equal(result.generatedBundles[0].bundleId, 'sequence_bundle', 'sequence creates Sequence Bundle');
  assert.equal(result.persist.marketBundleProgress.sequence.claimedTier, 1, 'sequence tier is claimed');
  assert.equal(result.persist.marketBundleProgress.sequence.nextThreshold, 5, 'sequence next threshold rises');
}

{
  const persist = createInitialPersistState({
    marketBundleProgress: { sequence: { total: 1, claimedTier: 0, nextThreshold: 2 } },
  });
  const result = advanceMarketBundleProgress(persist, ledger({ patterns: { sequenceMelds: 9 } }));
  assert.equal(result.generatedBundles.length, 1, 'jumping thresholds compresses to one bundle');
  assert.equal(result.generatedBundles[0].tier, 3, 'compressed bundle uses highest crossed tier');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ actions: { discardsUsed: 3 } }));
  assert.equal(result.generatedBundles[0].bundleId, 'draw_discard_bundle', 'discards create Restless bundle data');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ patterns: { courtMelds: 2 } }));
  assert.equal(result.generatedBundles[0].bundleId, 'court_bundle', 'court melds create Court bundle');
}

{
  const progress = advanceMarketBundleProgress(createInitialPersistState(), ledger({ patterns: { sequenceMelds: 2 } }));
  const bundleId = progress.generatedBundles[0].id;
  const opened = openRewardBundle(progress.persist, bundleId, { rng: () => 0.1 });
  const bundle = opened.pendingRewardBundles.find(item => item.id === bundleId);
  assert.equal(bundle.state, 'opened', 'opening bundle changes state');
  assert.ok(Array.isArray(bundle.rewardKeys), 'opening stores reward keys');
  const reopened = openRewardBundle(opened, bundleId, { rng: () => 0.9 });
  assert.deepEqual(reopened.pendingRewardBundles.find(item => item.id === bundleId).rewardKeys, bundle.rewardKeys, 'opened bundle does not reroll on render');
}

{
  const progress = advanceMarketBundleProgress(createInitialPersistState(), ledger({ patterns: { sequenceMelds: 2 } }));
  const bundleId = progress.generatedBundles[0].id;
  const opened = openRewardBundle(progress.persist, bundleId, { rng: () => 0.1 });
  const claimed = claimRewardFromBundle(opened, bundleId, 'sequence');
  assert.equal(claimed.claimed, true, 'claim succeeds');
  assert.equal(claimed.persist.upgrades.sequence, 1, 'sequence upgrade is applied');
  assert.equal(claimed.persist.upgrades.seq_mult, 1, 'paired sequence mult is applied');
  assert.equal(claimed.persist.pendingRewardBundles.find(item => item.id === bundleId).state, 'claimed', 'claimed bundle is marked');
}

{
  const progress = advanceMarketBundleProgress(createInitialPersistState(), ledger({ patterns: { sequenceMelds: 2 } }));
  const bundleId = progress.generatedBundles[0].id;
  const opened = openRewardBundle(progress.persist, bundleId, { rng: () => 0.5 });
  const claimed = claimRewardFromBundle(opened, bundleId, 'five_stamp');
  assert.equal(claimed.claimed, true, 'stamp reward claim succeeds');
  assert.equal(claimed.requiresPicker, true, 'stamp reward requires picker');
  assert.deepEqual(claimed.persist.pendingCardChoice, { kind: 'five_stamp', rewardKey: 'five_stamp' }, 'stamp reward does not mutate a random card');
}

{
  const card = (uid, id, type, extra = {}) => ({ uid, id, type, points: 1, ...extra });
  let state = createGameState({
    run: {
      spread: [
        card(1, 'major_1', 'major', { number: 1 }),
        card(2, 'major_2', 'major', { number: 2 }),
        card(3, 'major_3', 'major', { number: 3 }),
        card(4, 'court_Wands_Page', 'court', { rank: 'Page', suit: 'Wands' }),
        card(5, 'court_Cups_Knight', 'court', { rank: 'Knight', suit: 'Cups' }),
      ],
      roundDiscardCount: 3,
    },
  });
  state = reducer(state, { type: ACTIONS.SCORE_READING });
  assert.equal(state.run.phase, GAME_PHASES.RESULTS, 'threshold clear enters Results phase');
  assert.ok(state.run.lastResults, 'results are stored');
  assert.ok((state.persist.pendingRewardBundles || []).length >= 1, 'scoring can create pending bundles');
}

console.log('Market bundle checks passed.');
