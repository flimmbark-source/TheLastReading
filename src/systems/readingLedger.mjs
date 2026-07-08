function countStamped(cards, ids = []) {
  const stamped = new Set(Array.isArray(ids) ? ids : []);
  if (!stamped.size) return 0;
  return cards.filter(card => stamped.has(card.id)).length;
}

function meldName(meld) {
  return Array.isArray(meld) ? meld[0] : meld?.name;
}

function numberFromSequenceName(name) {
  const match = /^Sequence of\s+(\d+)/.exec(String(name || ''));
  return match ? Number(match[1]) : 0;
}

export function patternCountsFromMelds(melds = []) {
  const counts = {
    sequenceMelds: 0,
    sequenceBestLength: 0,
    fullCourtMelds: 0,
    royalCourtMelds: 0,
    rankMelds: 0,
    pathMelds: 0,
    courtMelds: 0,
    hasThreeOfKind: false,
    hasFourOfKind: false,
    echoBestKind: 0,
  };

  for (const meld of melds || []) {
    const name = meldName(meld);
    if (!name) continue;

    if (name.startsWith('Sequence of ')) {
      counts.sequenceMelds += 1;
      counts.sequenceBestLength = Math.max(counts.sequenceBestLength, numberFromSequenceName(name));
    } else if (name.startsWith('Full Court')) counts.fullCourtMelds += 1;
    else if (name.startsWith('Royal Court')) counts.royalCourtMelds += 1;
    else if (name.startsWith('Three of a Kind')) {
      counts.rankMelds += 1;
      counts.hasThreeOfKind = true;
      counts.echoBestKind = Math.max(counts.echoBestKind, 3);
    } else if (name.startsWith('Four of a Kind')) {
      counts.rankMelds += 1;
      counts.hasFourOfKind = true;
      counts.echoBestKind = Math.max(counts.echoBestKind, 4);
    } else if (name === 'Path of the Magi') counts.pathMelds += 1;
  }

  counts.courtMelds = counts.fullCourtMelds + counts.royalCourtMelds;
  return counts;
}

function rankCounts(cards = []) {
  const counts = new Map();
  for (const card of cards) {
    if (!card?.rank) continue;
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

function bestRankCount(cards = []) {
  let best = 0;
  for (const count of rankCounts(cards).values()) best = Math.max(best, count);
  return best;
}

function cardIds(cards = []) {
  return cards.map(card => card?.uid).filter(uid => uid != null);
}

export function buildReadingLedger({ state, score, threshold, passed }) {
  const run = state?.run || {};
  const persist = state?.persist || {};
  const cards = (run.spread || []).filter(Boolean);
  const patterns = patternCountsFromMelds(score?.melds || []);
  const bestRepeatedRank = bestRankCount(cards);
  const reading = run.reading || 1;
  const thresholdIndex = run.thresholdIndex || 0;
  const openingHandCardIds = Array.isArray(run.openingHandCardIds) ? run.openingHandCardIds : [];
  const openingHandSet = new Set(openingHandCardIds);
  const spreadCardIds = cardIds(cards);
  const openingHandCardsInSpread = cards.filter(card => openingHandSet.has(card.uid)).length;
  const initialDiscards = Number.isFinite(run.initialDiscards) ? run.initialDiscards : Math.max(run.discards || 0, run.roundDiscardCount || 0);

  if (bestRepeatedRank >= 2) patterns.hasPair = true;
  else patterns.hasPair = false;
  patterns.echoBestKind = Math.max(patterns.echoBestKind || 0, bestRepeatedRank >= 2 ? bestRepeatedRank : 0);

  return {
    id: `reading_${reading}_threshold_${thresholdIndex}`,
    reading,
    thresholdIndex,
    score: {
      finalScore: score?.finalScore || 0,
      threshold,
      cleared: !!passed,
    },
    patterns,
    cards: {
      majorsPlaced: cards.filter(card => card.type === 'major').length,
      courtsPlaced: cards.filter(card => card.type === 'court').length,
      stampedFiveScored: countStamped(cards, persist.stampedFive),
      stampedMajorsScored: countStamped(cards, persist.stampedMajors),
      finalSpreadCardIds: spreadCardIds,
      openingHandCardIds: [...openingHandCardIds],
      openingHandCardsInSpread,
      placedCardIds: Array.isArray(run.placedCardIds) ? [...run.placedCardIds] : spreadCardIds,
      courtsInSpread: cards.filter(card => card.type === 'court').length,
    },
    actions: {
      discardsUsed: run.roundDiscardCount || 0,
      initialDiscards,
      allDiscardsUsed: initialDiscards > 0 && (run.roundDiscardCount || 0) >= initialDiscards,
      abilityTakenCards: (run.abilityTakenCardIds || []).length,
      mulligansUsed: run.roundMulliganCount || 0,
    },
  };
}
