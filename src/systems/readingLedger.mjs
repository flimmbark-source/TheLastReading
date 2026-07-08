function countStamped(cards, ids = []) {
  const stamped = new Set(Array.isArray(ids) ? ids : []);
  if (!stamped.size) return 0;
  return cards.filter(card => stamped.has(card.id)).length;
}

export function patternCountsFromMelds(melds = []) {
  const counts = {
    sequenceMelds: 0,
    fullCourtMelds: 0,
    royalCourtMelds: 0,
    rankMelds: 0,
    pathMelds: 0,
    courtMelds: 0,
  };

  for (const meld of melds || []) {
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

export function buildReadingLedger({ state, score, threshold, passed }) {
  const run = state?.run || {};
  const persist = state?.persist || {};
  const cards = (run.spread || []).filter(Boolean);
  const patterns = patternCountsFromMelds(score?.melds || []);
  const reading = run.reading || 1;
  const thresholdIndex = run.thresholdIndex || 0;

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
    },
    actions: {
      discardsUsed: run.roundDiscardCount || 0,
      abilityTakenCards: (run.abilityTakenCardIds || []).length,
    },
  };
}
