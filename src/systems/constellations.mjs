import { SETS_PER_ROUND, CONSTELLATIONS, getConstellation, constellationForRound } from '../data/constellations.mjs';

export { SETS_PER_ROUND, CONSTELLATIONS, getConstellation, constellationForRound };

export function activeConstellation(run = {}) {
  if (!run.constellationId) return { id: '', name: '', label: '', rule: '', effect: '' };
  return getConstellation(run.constellationId) || { id: '', name: '', label: '', rule: '', effect: '' };
}

function ruleKey(run = {}) {
  const c = activeConstellation(run);
  return c.effect || c.id || '';
}

export function constellationThreshold(baseThreshold, run = {}) {
  if (ruleKey(run) === 'hungry_threshold') return baseThreshold + (run.roundDiscardCount || 0) * 5;
  return baseThreshold;
}

export function blocksDiscard(run = {}) {
  return ruleKey(run) === 'block_early_discard' && (run.spread || []).filter(Boolean).length < 2;
}

export function isCardUntargetable(run = {}, card = null) {
  return Boolean(card && ruleKey(run) === 'untargetable_first' && (run.untargetableCardIds || []).includes(card.uid));
}

export function setHasScoringPattern(score = {}) {
  return (score.melds || []).some(meld => meld.mode === 'pattern');
}

export function gateSatisfied(run = {}, patternCount = 0) {
  return ruleKey(run) !== 'narrow_gate' || patternCount > 0;
}
