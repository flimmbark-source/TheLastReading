import { SETS_PER_ROUND, CONSTELLATIONS, getConstellation, constellationForRound } from '../data/constellations.mjs';

export { SETS_PER_ROUND, CONSTELLATIONS, getConstellation, constellationForRound };

export function activeConstellation(run = {}) {
  if (!run.constellationId) return { id: '', name: '', label: '', rule: '' };
  return getConstellation(run.constellationId) || { id: '', name: '', label: '', rule: '' };
}

export function constellationThreshold(baseThreshold, run = {}) {
  const constellation = activeConstellation(run);
  if (constellation.id === 'hungry_threshold') {
    return baseThreshold + (run.roundDiscardCount || 0) * 5;
  }
  return baseThreshold;
}

export function blocksDiscard(run = {}) {
  const constellation = activeConstellation(run);
  return constellation.id === 'closed_palm' && (run.spread || []).filter(Boolean).length < 2;
}

export function isCardUntargetable(run = {}, card = null) {
  if (!card) return false;
  const constellation = activeConstellation(run);
  if (constellation.id !== 'unasked_question') return false;
  return (run.untargetableCardIds || []).includes(card.uid);
}

export function setHasScoringPattern(score = {}) {
  return (score.melds || []).some(meld => meld.mode === 'pattern');
}

export function gateSatisfied(run = {}, patternCount = 0) {
  const constellation = activeConstellation(run);
  return constellation.id !== 'narrow_gate' || patternCount > 0;
}
