import { ACTIONS } from '../game/actions.mjs';
import { PACK_TAGS, SHOP_TAGS } from '../data/legacyMarket.mjs';
import { RELICS } from '../data/relics.mjs';

export const ACTIVE_MARKET_PACK_IDS = Object.freeze([
  'foundation',
  'innate',
  'restless',
  'second_sight',
]);

const STORE_SCORING_UPGRADES = Object.freeze(['rank', 'sequence', 'court_chips', 'royal_court_chips', 'path_chips', 'suit_stamp', 'five_stamp']);

export const VESSEL_OFFER_CHANCE = 0.30;

export const MARKET_BIAS_CONFIG = Object.freeze({
  minorSignal: 0.04,
  mediumSignal: 0.08,
  strongSignal: 0.12,
  maxTagBias: 0.25,
  maxTotalItemBonus: 0.35,
  runBiasCarryover: 0.25,
  runBiasDecay: 0.85,
  runBiasWeight: 0.5,
});

const SUIT_TAGS = Object.freeze({
  Cups: 'cups',
  Wands: 'wands',
  Swords: 'swords',
  Pentacles: 'pentacles',
});

const PACK_CALLOUT_COPY = Object.freeze({
  foundation: [
    'Omen — all cards +1 Chip',
    'Resonance — Majors +3 Chips',
    'Offering — +5 Reserve per reading',
  ],
  innate: [
    'Wider Hand — +1 hand size',
    'Blessed Start — +0.25 Mult on entry',
    'First Light — first placed card +3 Chips',
    'Deep Reserve — held cards +2 Chips',
  ],
  restless: [
    'Extra Discard — +1 discard/reading',
    'Mulligan — +1 mulligan charge',
    'Nimble Fingers — draw after each discard',
    'Quick Release — discards add +3 Chips',
    'Ritual Depth — ability draws +1 extra',
  ],
  second_sight: [
    'Lens Mastery — Peek, Kin, Neighbor, and Mirror reveal +1 extra',
    "Seer's Grace — Peek/Search/Mirror free once per reading",
    'Chosen — ability-taken cards +5 Chips',
  ],
});

function runtime(target = window) {
  return target.tlrRuntime || {};
}

function persistOf(target = window) {
  return runtime(target).persist || target.persist || {};
}

function stateOf(target = window) {
  return runtime(target).state || target.state || {};
}

function wrapMethod(target, name, wrapper) {
  const original = target[name];
  if (typeof original !== 'function' || original.__tlrMarketRebalanceWrapped) return false;
  function wrapped(...args) {
    return wrapper.call(this, original, ...args);
  }
  wrapped.__tlrMarketRebalanceWrapped = true;
  target[name] = wrapped;
  return true;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function emptyBias() {
  return Object.create(null);
}

function emptyRoundTracker() {
  return {
    placedCards: [],
    discardedCards: [],
    abilityUses: [],
    discardCount: 0,
  };
}

function marketMemory(target = window) {
  if (!target.__tlrAdaptiveMarket) {
    target.__tlrAdaptiveMarket = {
      tracker: emptyRoundTracker(),
      lastBias: emptyBias(),
      runBias: emptyBias(),
      combinedBias: emptyBias(),
      lastPreparedKey: null,
      lastSummary: null,
    };
  }
  if (!target.__tlrAdaptiveMarket.tracker) target.__tlrAdaptiveMarket.tracker = emptyRoundTracker();
  if (!target.__tlrAdaptiveMarket.lastBias) target.__tlrAdaptiveMarket.lastBias = emptyBias();
  if (!target.__tlrAdaptiveMarket.runBias) target.__tlrAdaptiveMarket.runBias = emptyBias();
  if (!target.__tlrAdaptiveMarket.combinedBias) target.__tlrAdaptiveMarket.combinedBias = emptyBias();
  return target.__tlrAdaptiveMarket;
}

function resetRoundTracker(target = window) {
  marketMemory(target).tracker = emptyRoundTracker();
}

function uniqueCards(cards) {
  const seen = new Set();
  const result = [];
  for (const card of cards || []) {
    if (!card) continue;
    const key = card.uid ?? card.id ?? `${card.type}:${card.name}:${result.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}

function addUniqueCard(list, card) {
  if (!card) return;
  const key = card.uid ?? card.id;
  if (key != null && list.some(entry => (entry.uid ?? entry.id) === key)) return;
  list.push(card);
}

function normalizeAbilityId(ability) {
  if (!ability) return null;
  if (typeof ability === 'string') return ability;
  return ability.id || ability.abilityId || null;
}

function trackAbilityUse(target, ability, source = 'discard') {
  const abilityId = normalizeAbilityId(ability);
  if (!abilityId) return;
  marketMemory(target).tracker.abilityUses.push({ ability: abilityId, source });
}

function addBias(bias, tag, amount) {
  if (!tag || !amount) return bias;
  bias[tag] = clamp((bias[tag] || 0) + amount, 0, MARKET_BIAS_CONFIG.maxTagBias);
  return bias;
}

function addBiases(bias, tags, amount) {
  for (const tag of tags || []) addBias(bias, tag, amount);
  return bias;
}

function biasEntries(bias) {
  return Object.entries(bias || {}).filter(([, value]) => Number(value) > 0);
}

function decayBias(bias) {
  const next = emptyBias();
  for (const [tag, value] of biasEntries(bias)) {
    const decayed = value * MARKET_BIAS_CONFIG.runBiasDecay;
    if (decayed >= 0.005) next[tag] = Number(decayed.toFixed(4));
  }
  return next;
}

function combineBias(lastBias, runBias) {
  const result = emptyBias();
  const tags = new Set([...Object.keys(lastBias || {}), ...Object.keys(runBias || {})]);
  for (const tag of tags) {
    const amount = (lastBias[tag] || 0) + (runBias[tag] || 0) * MARKET_BIAS_CONFIG.runBiasWeight;
    if (amount > 0) result[tag] = clamp(Number(amount.toFixed(4)), 0, MARKET_BIAS_CONFIG.maxTagBias);
  }
  return result;
}

function countBy(values) {
  const counts = Object.create(null);
  for (const value of values || []) {
    if (!value) continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function bestNumberRun(numbers) {
  const sorted = [...new Set(numbers.filter(n => Number.isFinite(n)))].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

function meldNames(score) {
  return (score?.melds || []).map(meld => Array.isArray(meld) ? String(meld[0] || '') : String(meld?.name || '')).filter(Boolean);
}

function runState(target = window) {
  return target.tlrStore?.getState?.()?.run || {};
}

function currentSpreadCards(target = window, run = runState(target)) {
  const live = stateOf(target);
  const runSpread = Array.isArray(run.spread) ? run.spread.filter(Boolean) : [];
  if (runSpread.length) return runSpread;
  return Array.isArray(live.spread) ? live.spread.filter(Boolean) : [];
}

export function createMarketReadingSummary(target = window) {
  const memory = marketMemory(target);
  const tracker = memory.tracker || emptyRoundTracker();
  const run = runState(target);
  const live = stateOf(target);
  const cards = uniqueCards([...tracker.placedCards, ...currentSpreadCards(target, run)]);
  const suitCounts = countBy(cards.map(card => card.suit).filter(Boolean));
  const rankCounts = countBy(cards.filter(card => card.type === 'court').map(card => card.rank));
  const majorNumbers = cards
    .filter(card => card.type === 'major')
    .map(card => Number(card.number ?? card.num))
    .filter(Number.isFinite);
  const score = Number(run.roundScore ?? live.roundScore ?? run.lastScore?.finalScore ?? 0) || 0;
  const threshold = Number(run.lastThreshold ?? live.lastThreshold ?? 0) || 0;
  const clearedThreshold = 'lastPassed' in run ? !!run.lastPassed : threshold > 0 && score >= threshold;
  const overkillAmount = threshold > 0 ? Math.max(0, score - threshold) : 0;
  const missedBy = threshold > 0 ? Math.max(0, threshold - score) : 0;
  const discardCount = Math.max(
    Number(run.roundDiscardCount || 0),
    Number(live.roundDiscardCount || 0),
    Number(tracker.discardCount || 0),
  );

  return {
    key: [live.reading ?? run.reading ?? 0, threshold, score, discardCount, cards.map(card => card.uid ?? card.id).join('|')].join(':'),
    score,
    threshold,
    clearedThreshold,
    overkillAmount,
    missedBy,
    placedCards: cards,
    discardedCards: uniqueCards(tracker.discardedCards),
    abilityUses: [...(tracker.abilityUses || [])],
    scoringPatterns: meldNames(run.lastScore),
    suitCounts,
    arcanaCounts: {
      major: cards.filter(card => card.type === 'major').length,
      minor: cards.filter(card => card.type !== 'major').length,
    },
    rankCounts,
    courtCount: cards.filter(card => card.type === 'court').length,
    majorRunLength: bestNumberRun(majorNumbers),
    discardCount,
    usedNoDiscards: discardCount === 0,
    mult: Number(run.lastScore?.mult || 1) || 1,
  };
}

function abilitySignalTags(abilityId) {
  if (!abilityId) return [];
  if (abilityId.startsWith('DRAW_')) return ['draw_support', 'ability_support', 'consistency'];
  if (abilityId.startsWith('PEEK_')) return ['peek_support', 'sight_support', 'ability_support', 'consistency'];
  switch (abilityId) {
    case 'SEARCH':
      return ['search_support', 'sight_support', 'deck_shaping', 'consistency'];
    case 'KIN_2':
      return ['kin_support', 'thread_support', 'arcana_support', 'ability_support'];
    case 'BETWEEN_2':
      return ['between_support', 'thread_support', 'sequence_support', 'ability_support'];
    case 'MIRROR_1':
      return ['mirror_support', 'position_support', 'ability_support'];
    case 'NEIGHBOR_2':
      return ['neighbor_support', 'position_support', 'thread_support', 'ability_support'];
    case 'WORLD':
      return ['recovery', 'hand_support', 'consistency'];
    default:
      return ['ability_support'];
  }
}

function applyPatternNameSignals(bias, patternNames) {
  for (const name of patternNames || []) {
    const lower = name.toLowerCase();
    if (lower.includes('three of a kind') || lower.includes('four of a kind')) {
      addBiases(bias, ['rank_support', 'pair_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);
    }
    if (lower.includes('sequence')) {
      addBiases(bias, ['sequence_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);
    }
    if (lower.includes('full court')) {
      addBiases(bias, ['court_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);
    }
    if (lower.includes('royal court')) {
      addBiases(bias, ['court_support', 'suit_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);
    }
    if (lower.includes('path of the magi')) {
      addBiases(bias, ['path_support', 'major_support', 'sequence_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);
    }
    if (lower.includes('balanced reading')) {
      addBiases(bias, ['major_support', 'minor_support', 'pattern_support'], MARKET_BIAS_CONFIG.minorSignal);
    }
    if (lower.includes('elemental harmony')) {
      addBiases(bias, ['suit_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);
    }
  }
}

export function generateMarketBiasFromSummary(summary) {
  const bias = emptyBias();

  for (const [suit, count] of Object.entries(summary.suitCounts || {})) {
    const tag = SUIT_TAGS[suit];
    if (!tag) continue;
    if (count >= 2) addBiases(bias, [tag, 'suit_support'], MARKET_BIAS_CONFIG.minorSignal);
    if (count >= 3) addBiases(bias, [tag, 'suit_support', 'flush_support'], MARKET_BIAS_CONFIG.mediumSignal);
  }

  if (summary.arcanaCounts.major >= 2) addBiases(bias, ['major_support', 'arcana_support'], 0.06);
  if (summary.arcanaCounts.major >= 3) addBiases(bias, ['major_support', 'arcana_support', 'scaling'], MARKET_BIAS_CONFIG.mediumSignal);
  if (summary.arcanaCounts.minor >= 3) addBias(bias, 'minor_support', MARKET_BIAS_CONFIG.minorSignal);

  if (summary.courtCount >= 2) addBiases(bias, ['court_support', 'pattern_support'], 0.05);
  if (summary.courtCount >= 3) addBiases(bias, ['court_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);

  for (const count of Object.values(summary.rankCounts || {})) {
    if (count >= 2) addBiases(bias, ['pair_support', 'rank_support', 'pattern_support'], 0.05);
    if (count >= 3) addBiases(bias, ['rank_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);
  }

  if (summary.majorRunLength >= 2) addBiases(bias, ['sequence_support', 'pattern_support'], 0.05);
  if (summary.majorRunLength >= 3) addBiases(bias, ['sequence_support', 'major_support', 'pattern_support'], MARKET_BIAS_CONFIG.mediumSignal);

  applyPatternNameSignals(bias, summary.scoringPatterns);

  for (const use of summary.abilityUses || []) {
    addBiases(bias, abilitySignalTags(use.ability), MARKET_BIAS_CONFIG.minorSignal);
  }

  if (summary.discardCount === 0) {
    addBiases(bias, ['no_discard', 'risk_reward'], MARKET_BIAS_CONFIG.mediumSignal);
  } else if (summary.discardCount === 1) {
    addBiases(bias, ['exact_one_discard', 'ability_support'], 0.06);
  } else if (summary.discardCount >= 2) {
    addBiases(bias, ['discard_support', 'ability_support', 'recovery'], 0.06);
  }
  if (summary.discardCount >= 3) addBiases(bias, ['draw_support', 'consistency'], 0.05);

  if (summary.threshold > 0) {
    if (!summary.clearedThreshold) {
      addBiases(bias, ['threshold_help', 'recovery', 'chips', 'consistency'], MARKET_BIAS_CONFIG.mediumSignal);
    } else if (summary.overkillAmount <= 10) {
      addBiases(bias, ['threshold_help', 'recovery', 'chips', 'consistency'], 0.05);
    } else if (summary.overkillAmount >= 15) {
      addBiases(bias, ['scaling', 'risk_reward', 'combo_support'], 0.06);
    }
  }

  if ((summary.scoringPatterns || []).length === 0 && (summary.placedCards || []).length >= 5) {
    addBiases(bias, ['pattern_support', 'consistency', 'recovery'], MARKET_BIAS_CONFIG.minorSignal);
  }
  if (summary.mult <= 1.05) addBias(bias, 'multiplier', MARKET_BIAS_CONFIG.minorSignal);

  return bias;
}

export function prepareAdaptiveMarketBias(target = window) {
  const memory = marketMemory(target);
  const summary = createMarketReadingSummary(target);
  if (summary.key && summary.key === memory.lastPreparedKey) return memory;

  const lastBias = generateMarketBiasFromSummary(summary);
  const runBias = decayBias(memory.runBias);
  for (const [tag, amount] of biasEntries(lastBias)) {
    addBias(runBias, tag, amount * MARKET_BIAS_CONFIG.runBiasCarryover);
  }

  memory.lastBias = lastBias;
  memory.runBias = runBias;
  memory.combinedBias = combineBias(lastBias, runBias);
  memory.lastSummary = summary;
  memory.lastPreparedKey = summary.key;

  target.__tlrMarketBiasDebug = {
    summary,
    lastBias: { ...lastBias },
    runBias: { ...runBias },
    combinedBias: { ...memory.combinedBias },
  };

  return memory;
}

function activePackChoice(target = window) {
  const available = ACTIVE_MARKET_PACK_IDS.filter(id => (target.PACKS || {})[id]);
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function sanitizePackOffer(target = window) {
  const offers = target._storeFrontOffers;
  if (!offers || !Array.isArray(offers.pack)) return false;
  const current = offers.pack[0];
  if (!current) return false; // null/undefined = purchased slot, leave it empty
  if (ACTIVE_MARKET_PACK_IDS.includes(current)) return false;
  const replacement = activePackChoice(target);
  offers.pack = replacement ? [replacement] : [];
  return true;
}

function tagWeight(tags, bias) {
  let bonus = 0;
  for (const tag of tags || []) bonus += bias[tag] || 0;
  return 1 + Math.min(bonus, MARKET_BIAS_CONFIG.maxTotalItemBonus);
}

function weightedSample(values, count, getTags, bias, rng = Math.random) {
  const remaining = [...values];
  const picks = [];
  while (remaining.length && picks.length < count) {
    const weights = remaining.map(value => tagWeight(getTags(value), bias));
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      picks.push(remaining.shift());
      continue;
    }
    let roll = rng() * total;
    let index = 0;
    for (; index < remaining.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) break;
    }
    picks.push(remaining.splice(Math.min(index, remaining.length - 1), 1)[0]);
  }
  return picks;
}

function currentBias(target = window) {
  return marketMemory(target).combinedBias || emptyBias();
}

function scoringTags(key) {
  return SHOP_TAGS[key] || [];
}

function packTags(key) {
  return PACK_TAGS[key] || [];
}

function relicTags(key, target = window) {
  return target.RELICS?.[key]?.tags || RELICS[key]?.tags || [];
}

export function buildAdaptiveStoreFrontOffers(target = window) {
  const bias = currentBias(target);
  const rng = target.Math?.random || Math.random;
  const shop = target.SHOP || {};
  const packs = target.PACKS || {};
  const owned = new Set((persistOf(target).relics || []));
  const scoringOptions = STORE_SCORING_UPGRADES.filter(key => shop[key]);
  const packOptions = ACTIVE_MARKET_PACK_IDS.filter(key => packs[key]);
  const relicOptions = typeof target.relicPool === 'function'
    ? target.relicPool(4).filter(key => key && !owned.has(key))
    : Object.keys(target.RELICS || {}).filter(key => !owned.has(key));

  return {
    scoring: weightedSample(scoringOptions, 1, scoringTags, bias, rng),
    pack: weightedSample(packOptions, 1, packTags, bias, rng),
    relics: weightedSample(relicOptions, 1, key => relicTags(key, target), bias, rng),
    __adaptiveWeighted: true,
  };
}

function ensureAdaptiveStoreFrontOffers(target = window) {
  const offers = target._storeFrontOffers;
  if (offers?.__adaptiveWeighted) return offers;
  target._storeFrontOffers = buildAdaptiveStoreFrontOffers(target);
  return target._storeFrontOffers;
}

function currentRelicSlots(target = window) {
  if (typeof target.relicSlots === 'function') return target.relicSlots();
  const level = (persistOf(target).up || {}).relicSlot || 0;
  return 3 + Math.min(level, 2);
}

function ensureVesselRoll(target = window) {
  const offers = target._storeFrontOffers;
  if (!offers || offers.__vesselRolled) return offers;
  offers.__vesselRolled = true;
  offers.__vesselOffered = !target._storeVesselBought
    && currentRelicSlots(target) < 5
    && Math.random() < VESSEL_OFFER_CHANCE;
  offers.__vesselPurchased = false;
  return offers;
}

function vesselCost(target = window) {
  if (typeof target.shopCost === 'function') return target.shopCost('relicSlot');
  const level = (persistOf(target).up || {}).relicSlot || 0;
  return Math.floor(35 * Math.pow(2, level));
}

function renderPurchasedRelicSlot(card) {
  card.className = 'store-card disabled';
  card.style.pointerEvents = 'none';
  card.innerHTML = '<div class="store-card-tag" style="opacity:.4">Purchased</div><div style="flex:1;display:flex;align-items:center;justify-content:center;color:rgba(200,160,80,.35);font-size:22px">✦</div>';
}

function renderVesselOffer(target = window) {
  const offers = ensureVesselRoll(target);
  if (!offers) return;
  const card = target.document?.querySelector('.store-offer-row .store-card:nth-child(3)');
  if (!card) return;

  if (offers.__vesselPurchased) {
    renderPurchasedRelicSlot(card);
    return;
  }
  if (!offers.__vesselOffered) return;

  const persist = persistOf(target);
  const level = (persist.up || {}).relicSlot || 0;
  const maxed = currentRelicSlots(target) >= 5;
  const cost = vesselCost(target);
  const canAfford = !maxed && (persist.pool || 0) >= cost;
  card.className = `store-card store-card--vessel ${canAfford ? '' : 'disabled'}`;
  card.style.pointerEvents = '';
  card.innerHTML = `
    <div class="store-card-tag">Relic Slot</div>
    <div class="store-card-art"><div class="store-vessel-glyph">＋</div></div>
    <div class="store-card-main">
      <div class="store-card-name">Relic Vessel</div>
      <div class="store-card-desc">${maxed ? 'Relic Slots maxed.' : 'Gain +1 Relic Slot'}</div>
      <div class="store-card-lv">${maxed ? 'Max 5' : `Slots ${3 + level} → ${4 + level}`}</div>
    </div>
    <button class="store-card-buy" ${canAfford ? '' : 'disabled'} onclick="buyStoreVessel()">${maxed ? 'Maxed' : `Buy <span class="coin">✦</span> ${cost}`}</button>`;
}

function installPackCalloutCopy(target = window) {
  wrapMethod(target, 'showStorePackCallout', function (original, packId, ...args) {
    const result = original.call(this, packId, ...args);
    const copy = PACK_CALLOUT_COPY[packId];
    if (!copy) return result;
    const list = target.document?.querySelector('.store-pack-callout .store-pack-callout-list');
    if (list) list.innerHTML = copy.map(line => `<li>${line}</li>`).join('');
    return result;
  });
}

function installStoreOfferRules(target = window) {
  wrapMethod(target, 'openShop', function (original, ...args) {
    prepareAdaptiveMarketBias(target);
    target._storeFrontOffers = null;
    return original.apply(this, args);
  });

  wrapMethod(target, 'openShopMain', function (original, ...args) {
    ensureAdaptiveStoreFrontOffers(target);
    let result = original.apply(this, args);
    if (sanitizePackOffer(target)) result = original.apply(this, args);
    renderVesselOffer(target);
    return result;
  });

  wrapMethod(target, 'confirmStoreVessel', function (original, ...args) {
    const offers = target._storeFrontOffers;
    const vesselOffer = !!offers?.__vesselOffered;
    if (vesselOffer) {
      offers.__vesselPurchased = true;
      target._storeVesselBought = true;
    }
    const result = original.apply(this, args);
    if (result === false && vesselOffer) {
      offers.__vesselPurchased = false;
      target._storeVesselBought = false;
    }
    return result;
  });

  wrapMethod(target, 'continueReading', function (original, ...args) {
    target._storeVesselBought = false;
    return original.apply(this, args);
  });
}

function installWatcherReset(target = window) {
  wrapMethod(target, 'startReading', function (original, ...args) {
    const persist = persistOf(target);
    if (persist.relicUsed) persist.relicUsed.watcher = false;
    return original.apply(this, args);
  });
}

function installDiscardAndCarryTracking(target = window) {
  const store = target.tlrStore;
  if (!store || typeof store.dispatch !== 'function' || store.dispatch.__tlrMarketRebalanceWrapped) return;
  const originalDispatch = store.dispatch.bind(store);

  function dispatch(action) {
    const before = store.getState?.();
    const beforeRun = before?.run || {};
    const selectedId = action?.type === ACTIONS.DISCARD_SELECTED || action?.type === ACTIONS.PLACE_CARD
      ? (action.cardUid ?? beforeRun.selectedCardId)
      : null;
    const selectedCard = selectedId == null
      ? null
      : (beforeRun.hand || []).find(card => card.uid === selectedId) || null;

    if (action?.type === ACTIONS.START_READING || action?.type === ACTIONS.RESET_SESSION || action?.type === ACTIONS.FLUSH_HAND) {
      resetRoundTracker(target);
    }

    const result = originalDispatch(action);
    const afterRun = store.getState?.()?.run || {};

    if (action?.type === ACTIONS.PLACE_CARD && selectedCard) {
      const wasPlaced = (afterRun.spread || []).some(card => card?.uid === selectedCard.uid);
      if (wasPlaced) addUniqueCard(marketMemory(target).tracker.placedCards, selectedCard);
    }

    if (action?.type === ACTIONS.DISCARD_SELECTED && selectedCard) {
      const wasDiscarded = (afterRun.discard || []).some(card => card.uid === selectedCard.uid);
      const tracked = afterRun.discardedCards || [];
      const alreadyTracked = tracked.some(card => card.uid === selectedCard.uid);
      if (wasDiscarded) {
        const tracker = marketMemory(target).tracker;
        tracker.discardCount += 1;
        addUniqueCard(tracker.discardedCards, selectedCard);
        trackAbilityUse(target, selectedCard.ability, 'discard');
      }
      if (wasDiscarded && !alreadyTracked) {
        originalDispatch({
          type: ACTIONS.SYNC_LEGACY_RUN,
          run: { discardedCards: [...tracked, selectedCard] },
        });
      }
    }

    if (action?.type === ACTIONS.START_NEXT_SET) {
      // Discard relics and upgrades score the current set, not an accumulated
      // total from both sets. World carry is likewise consumed by the first set.
      originalDispatch({
        type: ACTIONS.SYNC_LEGACY_RUN,
        run: { discardedCards: [], worldCarry: 0 },
      });
    }

    return result;
  }

  dispatch.__tlrMarketRebalanceWrapped = true;
  store.dispatch = dispatch;
}

export function installMarketRebalance(target = window) {
  if (!target || target.__tlrMarketRebalanceInstalled) return;
  target.__tlrMarketRebalanceInstalled = true;
  marketMemory(target);
  installDiscardAndCarryTracking(target);
  installWatcherReset(target);
  installStoreOfferRules(target);
  installPackCalloutCopy(target);
}
