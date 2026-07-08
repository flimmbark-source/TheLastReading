import assert from 'node:assert/strict';

import { ACTIONS } from '../src/game/actions.mjs';
import { createGameState, createInitialPersistState, GAME_PHASES } from '../src/game/state.mjs';
import { reducer } from '../src/game/reducer.mjs';
import { patternCountsFromMelds } from '../src/systems/readingLedger.mjs';
import { advanceMarketBundleProgress, evaluateMarketBundleTracks } from '../src/systems/marketBundleProgress.mjs';
import { claimRewardFromBundle, legalRewardKeysForBundle, openRewardBundle, rewardOfferKeysForBundle } from '../src/systems/marketRewardBundles.mjs';

function ledger(overrides = {}) {
  return {
    id: 'reading_1_threshold_0',
    reading: 1,
    thresholdIndex: 0,
    patterns: { sequenceMelds: 0, sequenceBestLength: 0, courtMelds: 0, fullCourtMelds: 0, royalCourtMelds: 0, rankMelds: 0, pathMelds: 0, echoBestKind: 0, hasPair: false, hasThreeOfKind: false, hasFourOfKind: false },
    cards: { courtsInSpread: 0, openingHandCardsInSpread: 0 },
    actions: { discardsUsed: 1, initialDiscards: 3, allDiscardsUsed: false, abilityTakenCards: 1, mulligansUsed: 0 },
    ...overrides,
  };
}

{
  const persist = createInitialPersistState();
  assert.equal(persist.marketBundleProgress.restless.nextThreshold, 3, 'restless starts at first threshold');
  assert.equal(persist.marketBundleProgress.stillness.nextThreshold, 3, 'stillness starts at first threshold');
  assert.equal(persist.marketBundleProgress.sequence.nextThreshold, 2, 'sequence starts at first threshold');
  assert.equal(persist.marketBundleProgress.echo.nextThreshold, 2, 'echo starts at first threshold');
  assert.equal(persist.marketBundleProgress.court.nextThreshold, 4, 'court starts at first threshold');
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
  assert.equal(counts.sequenceBestLength, 4, 'captures best sequence length');
  assert.equal(counts.courtMelds, 2, 'counts Full/Royal Court melds');
  assert.equal(counts.rankMelds, 1, 'counts rank melds');
  assert.equal(counts.echoBestKind, 3, 'captures best echo kind from melds');
  assert.equal(counts.pathMelds, 1, 'counts Path of the Magi');
}

{
  const evaluated = evaluateMarketBundleTracks(ledger({
    actions: { discardsUsed: 3, initialDiscards: 3, allDiscardsUsed: true, abilityTakenCards: 2, mulligansUsed: 0 },
    cards: { openingHandCardsInSpread: 4 },
  }));
  assert.ok(evaluated.awarded.restless, 'restless is awarded when earned');
  assert.ok(evaluated.awarded.stillness, 'stillness is also awarded when earned');
}

{
  const evaluated = evaluateMarketBundleTracks(ledger({
    patterns: { sequenceBestLength: 4, echoBestKind: 3, hasThreeOfKind: true },
  }));
  assert.ok(evaluated.awarded.sequence, 'sequence is awarded when earned');
  assert.ok(evaluated.awarded.echo, 'echo is also awarded when earned');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ patterns: { sequenceBestLength: 3 } }));
  assert.equal(result.generatedBundles.length, 0, 'sequence below threshold creates no bundle');
  assert.equal(result.persist.marketBundleProgress.sequence.total, 1, 'sequence progress is stored');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ patterns: { sequenceBestLength: 4 } }));
  assert.equal(result.generatedBundles.length, 1, 'sequence threshold creates one bundle');
  assert.equal(result.generatedBundles[0].bundleId, 'sequence_bundle', 'sequence creates Sequence Bundle');
  assert.equal(result.persist.marketBundleProgress.sequence.claimedTier, 1, 'sequence tier is claimed');
  assert.equal(result.persist.marketBundleProgress.sequence.nextThreshold, 5, 'sequence next threshold rises');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ patterns: { echoBestKind: 3, hasThreeOfKind: true } }));
  assert.equal(result.generatedBundles[0].bundleId, 'echo_bundle', 'echo creates Echo Bundle');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ actions: { discardsUsed: 3, initialDiscards: 3, allDiscardsUsed: true, abilityTakenCards: 2, mulligansUsed: 0 } }));
  assert.equal(result.generatedBundles[0].bundleId, 'restless_bundle', 'heavy intervention creates Restless bundle');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ actions: { discardsUsed: 0, initialDiscards: 3, allDiscardsUsed: false, abilityTakenCards: 0, mulligansUsed: 0 }, cards: { openingHandCardsInSpread: 4 } }));
  assert.equal(result.generatedBundles[0].bundleId, 'stillness_bundle', 'low intervention creates Stillness bundle');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({ cards: { courtsInSpread: 4 }, patterns: { fullCourtMelds: 1, courtMelds: 1 } }));
  assert.equal(result.generatedBundles[0].bundleId, 'court_bundle', 'court play creates Court bundle');
}

{
  const persist = createInitialPersistState();
  const result = advanceMarketBundleProgress(persist, ledger({
    actions: { discardsUsed: 3, initialDiscards: 3, allDiscardsUsed: true, abilityTakenCards: 2, mulligansUsed: 0 },
    cards: { courtsInSpread: 4, openingHandCardsInSpread: 4 },
    patterns: { sequenceBestLength: 4, echoBestKind: 3, hasThreeOfKind: true, fullCourtMelds: 1, courtMelds: 1 },
  }));
  const bundleIds = result.generatedBundles.map(bundle => bundle.bundleId).sort();
  assert.deepEqual(bundleIds, ['court_bundle', 'echo_bundle', 'restless_bundle', 'sequence_bundle'].sort(), 'all earned bundles are queued');
  assert.ok(result.deltas.every(delta => !delta.deferred), 'no earned bundle is deferred');
}

{
  const progress = advanceMarketBundleProgress(createInitialPersistState(), ledger({ patterns: { sequenceBestLength: 4 } }));
  const bundleId = progress.generatedBundles[0].id;
  const opened = openRewardBundle(progress.persist, bundleId, { rng: () => 0.1 });
  const bundle = opened.pendingRewardBundles.find(item => item.id === bundleId);
  assert.equal(bundle.state, 'opened', 'opening bundle changes state');
  assert.ok(Array.isArray(bundle.rewardKeys), 'opening stores reward keys');
  assert.ok(bundle.rewardKeys.length <= 3, 'bundle offers at most 3 rewards');
  const reopened = openRewardBundle(opened, bundleId, { rng: () => 0.9 });
  assert.deepEqual(reopened.pendingRewardBundles.find(item => item.id === bundleId).rewardKeys, bundle.rewardKeys, 'opened bundle does not reroll on render');
}

{
  const progress = advanceMarketBundleProgress(createInitialPersistState(), ledger({ patterns: { sequenceBestLength: 4 } }));
  const bundleId = progress.generatedBundles[0].id;
  const opened = openRewardBundle(progress.persist, bundleId, { rng: () => 0.1 });
  const claimed = claimRewardFromBundle(opened, bundleId, 'sequence');
  assert.equal(claimed.claimed, true, 'claim succeeds');
  assert.equal(claimed.persist.upgrades.sequence, 1, 'sequence upgrade is applied');
  assert.equal(claimed.persist.upgrades.seq_mult, 1, 'paired sequence mult is applied');
  assert.equal(claimed.persist.pendingRewardBundles.find(item => item.id === bundleId).state, 'claimed', 'claimed bundle is marked');
}

{
  const progress = advanceMarketBundleProgress(createInitialPersistState(), ledger({ patterns: { sequenceBestLength: 4 } }));
  const bundleId = progress.generatedBundles[0].id;
  const opened = openRewardBundle(progress.persist, bundleId, { rng: () => 0.5 });
  const claimed = claimRewardFromBundle(opened, bundleId, 'five_stamp');
  assert.equal(claimed.claimed, true, 'stamp reward claim succeeds');
  assert.equal(claimed.requiresPicker, true, 'stamp reward requires picker');
  assert.deepEqual(claimed.persist.pendingCardChoice, { kind: 'five_stamp', rewardKey: 'five_stamp' }, 'stamp reward does not mutate a random card');
}

{
  const progress = advanceMarketBundleProgress(createInitialPersistState(), ledger({ cards: { courtsInSpread: 4 }, patterns: { fullCourtMelds: 1, courtMelds: 1 } }));
  const bundleId = progress.generatedBundles[0].id;
  const opened = openRewardBundle(progress.persist, bundleId, { rng: () => 0.1 });
  const claimed = claimRewardFromBundle(opened, bundleId, 'court_chips');
  assert.equal(claimed.claimed, true, 'court claim succeeds');
  assert.equal(claimed.persist.upgrades.court_chips, 1, 'court_chips upgrade is applied');
  assert.equal(claimed.persist.upgrades.court_mult, 1, 'paired court mult is applied');
}

{
  const progress = advanceMarketBundleProgress(createInitialPersistState(), ledger({ cards: { courtsInSpread: 4 }, patterns: { fullCourtMelds: 1, courtMelds: 1 } }));
  const bundleId = progress.generatedBundles[0].id;
  const bundle = progress.persist.pendingRewardBundles.find(item => item.id === bundleId);
  const filtered = legalRewardKeysForBundle(progress.persist, bundle, { excludeRewardKeys: ['suit_stamp'] });
  assert.ok(!filtered.includes('suit_stamp'), 'excluded stamp key is dropped');
  assert.ok(filtered.length >= 1, 'excluding a stamp never empties the pool');

  const offer = rewardOfferKeysForBundle(progress.persist, bundle, { rng: () => 0.1, excludeRewardKeys: ['suit_stamp'] });
  assert.ok(!offer.includes('suit_stamp'), 'role offer omits the ineligible stamp');
  assert.ok(offer.length >= 1, 'role offer still offers a reward');
}

{
  const card = (uid, id, type, extra = {}) => ({ uid, id, type, points: 1, ...extra });
  let state = createGameState({
    run: {
      thresholdBonus: -25,
      spread: [
        card(1, 'court_Wands_Page', 'court', { rank: 'Page', suit: 'Wands' }),
        card(2, 'court_Cups_Knight', 'court', { rank: 'Knight', suit: 'Cups' }),
        card(3, 'court_Swords_Queen', 'court', { rank: 'Queen', suit: 'Swords' }),
        card(4, 'court_Pentacles_King', 'court', { rank: 'King', suit: 'Pentacles' }),
        card(5, 'major_1', 'major', { number: 1 }),
      ],
      roundDiscardCount: 3,
      initialDiscards: 3,
      openingHandCardIds: [1, 2, 3, 4, 5],
      placedCardIds: [1, 2, 3, 4, 5],
    },
  });
  state = reducer(state, { type: ACTIONS.SCORE_READING });
  assert.equal(state.run.phase, GAME_PHASES.RESULTS, 'threshold clear enters Results phase');
  assert.ok(state.run.lastResults, 'results are stored');
  assert.ok((state.persist.pendingRewardBundles || []).length >= 1, 'scoring can create pending bundles');
}

console.log('Market bundle checks passed.');
