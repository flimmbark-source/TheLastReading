import { SETS_PER_ROUND, CONSTELLATIONS, getConstellation, constellationForRound } from '../data/constellations.mjs';

export { SETS_PER_ROUND, CONSTELLATIONS, getConstellation, constellationForRound };

const EMPTY_CONSTELLATION = { id: '', name: '', label: '', rule: '', effect: '' };

function roundIndexOf(run = {}) {
  const value = run.thresholdIndex ?? run.th ?? 0;
  const index = Number(value || 0);
  return Number.isFinite(index) ? index : 0;
}

export function hasActiveConstellation(run = {}) {
  return roundIndexOf(run) > 0 && Boolean(run.constellationId);
}

export function activeConstellation(run = {}) {
  if (!hasActiveConstellation(run)) return EMPTY_CONSTELLATION;
  return getConstellation(run.constellationId) || EMPTY_CONSTELLATION;
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
