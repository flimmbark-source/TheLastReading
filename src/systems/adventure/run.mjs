// Adventure Mode — run state and event resolution.
//
// This is the heart of Adventure Mode and is deliberately independent of Score
// Mode: it reuses computeScore (unchanged) to grade a spread, then layers the
// hidden interpretation + event/status/relic/reward systems on top. Score Mode
// state is never touched.

import { computeScore } from '../scoring.mjs';
import { calculateSpreadMeanings, rankedMeanings, dominantMeaning } from './meanings.mjs';
import { getStatus } from '../../data/adventure/statuses.mjs';
import { getRelic } from '../../data/adventure/relics.mjs';
import { ADVENTURE_EVENTS, RECOVERY_EVENT, EVENT_TRAITS } from '../../data/adventure/events.mjs';
import { REWARD_OFFER_RULES, REWARD_TEMPLATES, REWARD_TYPES } from '../../data/adventure/rewards.mjs';
import { ADVENTURE_RELIC_LIST } from '../../data/adventure/relics.mjs';

export const ADVENTURE_RESULTS = Object.freeze({
  FAILURE: 'failure',
  SUCCESS: 'success',
  TRIUMPH: 'triumph',
});

export const INITIAL_RESOLVE = 4;
export const MAX_RESOLVE = 6;

// The slice run: three standard events, then the recovery beat. The boss is
// authored later; the schema and bossInterpretationHistory tracker are ready.
function defaultEventOrder() {
  return ADVENTURE_EVENTS.map(event => event.id);
}

export function createAdventureRunState(overrides = {}) {
  return {
    resolve: INITIAL_RESOLVE,
    maxResolve: MAX_RESOLVE,
    currentEventIndex: 0,
    events: defaultEventOrder(),
    statuses: [],
    relics: [],
    completedEvents: [],
    bossInterpretationHistory: [],
    // Run-scoped flags for one-shot relic effects.
    flags: { firstFailureUsed: false, ironRingUsed: false, recoveryDone: false },
    lost: false,
    ...overrides,
  };
}

export function clampResolve(value, max = MAX_RESOLVE) {
  return Math.max(0, Math.min(max, value));
}

export function hasStatus(run, id) {
  return Array.isArray(run.statuses) && run.statuses.includes(id);
}

export function hasRelic(run, id) {
  return Array.isArray(run.relics) && run.relics.includes(id);
}

export function currentEvent(run) {
  const id = run.events[run.currentEventIndex];
  return ADVENTURE_EVENTS.find(event => event.id === id) || null;
}

export function eventHasTrait(event, trait) {
  return Array.isArray(event?.traits) && event.traits.includes(trait);
}

// --- Outcome selection -----------------------------------------------------

/**
 * Score every outcome by summing its trigger-meaning values, pick the highest.
 * Ties are broken by declaration order (stable, first wins).
 */
export function selectOutcome(event, meanings) {
  let best = null;
  let bestWeight = -Infinity;
  for (const outcome of event.outcomes) {
    const weight = (outcome.triggerMeanings || []).reduce((acc, tag) => acc + (meanings[tag] || 0), 0);
    if (weight > bestWeight) {
      best = outcome;
      bestWeight = weight;
    }
  }
  return { outcome: best, weight: bestWeight };
}

// --- Resolution ------------------------------------------------------------

/**
 * Resolve a reading against an event. Pure: computes everything that *will*
 * happen and returns it; applyResolution mutates the run.
 */
export function resolveEvent({ event, spread, run, score: scoreOverride }) {
  const cards = (spread || []).filter(Boolean);
  // When the screen runs on the real table, the live engine already produced
  // the displayed score; reuse it so the result matches exactly. Otherwise grade
  // the spread with the shared scoring engine.
  const scoreBreakdown = scoreOverride == null ? computeScore(cards) : null;
  const score = scoreOverride == null ? scoreBreakdown.finalScore : scoreOverride;
  const meanings = calculateSpreadMeanings(spread, run.statuses);

  let tier;
  if (score >= event.triumphScore) tier = ADVENTURE_RESULTS.TRIUMPH;
  else if (score >= event.targetScore) tier = ADVENTURE_RESULTS.SUCCESS;
  else tier = ADVENTURE_RESULTS.FAILURE;

  const notes = [];

  if (tier === ADVENTURE_RESULTS.FAILURE) {
    const outcome = event.failure;
    let resolveChange = outcome.resolveChange ?? -1;

    // Exposed: hostile failures cost +1 Resolve.
    if (hasStatus(run, 'exposed') && eventHasTrait(event, EVENT_TRAITS.HOSTILE)) {
      resolveChange -= getStatus('exposed').extraHostileFailureResolveCost || 0;
      notes.push('Exposed deepened the hostile failure.');
    }

    // Lucky Coin: first failure of the run costs no Resolve.
    let negatedByLuckyCoin = false;
    if (hasRelic(run, 'lucky_coin') && !run.flags.firstFailureUsed && resolveChange < 0) {
      resolveChange = 0;
      negatedByLuckyCoin = true;
      notes.push('Lucky Coin absorbed the failure.');
    }

    return {
      tier,
      score,
      scoreBreakdown,
      meanings,
      outcome,
      narrative: outcome.text,
      resolveChange,
      gainStatuses: [...(outcome.gainStatuses || [])],
      removeStatuses: [...(outcome.removeStatuses || [])],
      rewardTier: null,
      rewardShow: 0,
      rewardChoose: 0,
      flags: {
        firstFailureUsed: run.flags.firstFailureUsed || negatedByLuckyCoin || resolveChange < 0,
      },
      notes,
    };
  }

  // Success / Triumph.
  const { outcome, weight } = selectOutcome(event, meanings);
  const isTriumph = tier === ADVENTURE_RESULTS.TRIUMPH;
  const narrative = isTriumph && outcome.triumphText ? outcome.triumphText : outcome.text;

  let resolveChange = outcome.resolveChange ?? 0;
  const gainStatuses = [...(outcome.gainStatuses || [])];
  const removeStatuses = [...(outcome.removeStatuses || [])];

  // Reward counts.
  const rules = isTriumph ? REWARD_OFFER_RULES.triumph : REWARD_OFFER_RULES.success;
  let show = rules.show;
  let choose = rules.choose;

  // Traveler's Charm: one extra success offer.
  if (!isTriumph && hasRelic(run, 'travelers_charm')) {
    show += getRelic('travelers_charm').bonusOfferCount || 0;
    notes.push("Traveler's Charm widened the choices.");
  }

  if (isTriumph) {
    // Prayer Beads: triumph restores Resolve.
    if (hasRelic(run, 'prayer_beads')) {
      resolveChange += getRelic('prayer_beads').triumphResolveRestore || 0;
      notes.push('Prayer Beads restored Resolve on triumph.');
    }
    // Distrusted: social triumph bonus disabled (drop the extra pick).
    const socialBonusDisabled = hasStatus(run, 'distrusted') && eventHasTrait(event, EVENT_TRAITS.SOCIAL);
    if (socialBonusDisabled) {
      choose = REWARD_OFFER_RULES.success.choose;
      notes.push('Distrusted suppressed the social triumph bonus.');
    } else if (hasStatus(run, 'blessed')) {
      // Blessed: one additional triumph reward, then consume the status.
      const bonus = getStatus('blessed').bonusTriumphReward || 0;
      choose += bonus;
      show += bonus;
      if (!removeStatuses.includes('blessed')) removeStatuses.push('blessed');
      notes.push('Blessed granted an extra reward and faded.');
    }
  }

  return {
    tier,
    score,
    scoreBreakdown,
    meanings,
    outcome,
    outcomeWeight: weight,
    narrative,
    resolveChange,
    gainStatuses,
    removeStatuses,
    rewardTier: isTriumph ? 'triumph' : 'success',
    rewardShow: show,
    rewardChoose: choose,
    flags: {},
    notes,
  };
}

/**
 * Apply the deterministic parts of a resolution to the run (resolve, statuses,
 * flags, boss tracking, run-lost). Reward selection is handled separately so
 * the UI can present choices. Does NOT advance the event index.
 */
export function applyResolution(run, resolution) {
  // Resolve change, with Iron Ring's one-shot survival.
  let nextResolve = run.resolve + (resolution.resolveChange || 0);
  if (nextResolve <= 0 && hasRelic(run, 'iron_ring') && !run.flags.ironRingUsed) {
    nextResolve = 1;
    run.flags.ironRingUsed = true;
    resolution.notes?.push('Iron Ring kept you on your feet.');
  }
  run.resolve = clampResolve(nextResolve, run.maxResolve);

  // Status changes: removals first, then additions (deduped).
  if (resolution.removeStatuses?.length) {
    run.statuses = run.statuses.filter(id => !resolution.removeStatuses.includes(id));
  }
  for (const id of resolution.gainStatuses || []) {
    if (getStatus(id) && !run.statuses.includes(id)) run.statuses.push(id);
  }

  // Carry one-shot flags forward.
  if (resolution.flags) Object.assign(run.flags, resolution.flags);

  if (run.resolve <= 0) run.lost = true;
  return run;
}

export function isRunLost(run) {
  return run.lost || run.resolve <= 0;
}

/** Advance to the next event, recording completion. Call after rewards. */
export function advanceEvent(run, eventId) {
  if (eventId && !run.completedEvents.includes(eventId)) run.completedEvents.push(eventId);
  run.currentEventIndex += 1;
  return run;
}

// --- Rewards ---------------------------------------------------------------

function weightedSampleWithoutReplacement(templates, count, rng) {
  const pool = templates.map(t => ({ template: t, weight: t.weight || 1 }));
  const out = [];
  while (out.length < count && pool.length) {
    const total = pool.reduce((acc, entry) => acc + entry.weight, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < pool.length; idx += 1) {
      roll -= pool[idx].weight;
      if (roll <= 0) break;
    }
    const [picked] = pool.splice(Math.min(idx, pool.length - 1), 1);
    out.push(picked.template);
  }
  return out;
}

/** Build the reward offers for a resolved success/triumph. */
export function generateRewardOffers(run, count, rng = Math.random) {
  const eligible = REWARD_TEMPLATES.filter(t => (typeof t.available === 'function' ? t.available(run) : true));
  const chosen = weightedSampleWithoutReplacement(eligible, count, rng);
  return chosen.map((template, i) => ({
    offerId: `${template.type}_${i}`,
    type: template.type,
    label: template.label,
    amount: template.amount,
  }));
}

/**
 * Apply a chosen reward. `ctx` supplies the interactive bits a prototype can't
 * decide on its own (which card to add/remove, which status to clear).
 */
export function applyReward(run, reward, ctx = {}, rng = Math.random) {
  switch (reward.type) {
    case REWARD_TYPES.RESTORE_RESOLVE:
      run.resolve = clampResolve(run.resolve + (reward.amount || 1), run.maxResolve);
      break;
    case REWARD_TYPES.REMOVE_STATUS: {
      const target = ctx.statusId || run.statuses[0];
      if (target) run.statuses = run.statuses.filter(id => id !== target);
      break;
    }
    case REWARD_TYPES.GAIN_RELIC: {
      const relicId = ctx.relicId || randomUnownedRelic(run, rng);
      if (relicId && !run.relics.includes(relicId)) run.relics.push(relicId);
      break;
    }
    case REWARD_TYPES.ADD_CARD:
    case REWARD_TYPES.REMOVE_CARD:
      // Deck mutation is delegated to the caller, which owns the deck; the
      // reward is recorded so the UI flow can resolve it against deck state.
      ctx.onDeckReward?.(reward);
      break;
    default:
      break;
  }
  return run;
}

export function randomUnownedRelic(run, rng = Math.random) {
  const pool = ADVENTURE_RELIC_LIST.filter(relic => !run.relics.includes(relic.id));
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)].id;
}

// --- Recovery event --------------------------------------------------------

export function isRecoveryDue(run) {
  return !run.flags.recoveryDone && run.currentEventIndex >= 3;
}

export function applyRecoveryChoice(run, choiceId, rng = Math.random) {
  const choice = RECOVERY_EVENT.choices.find(c => c.id === choiceId);
  if (!choice) return run;
  const effect = choice.effect;
  if (effect.resolveChange) run.resolve = clampResolve(run.resolve + effect.resolveChange, run.maxResolve);
  if (effect.removeOneStatus && run.statuses.length) run.statuses = run.statuses.slice(1);
  if (effect.gainRandomRelic) {
    const relicId = randomUnownedRelic(run, rng);
    if (relicId) run.relics.push(relicId);
  }
  run.flags.recoveryDone = true;
  return run;
}

// --- Boss tracking (scaffold for the Woman In The Well) --------------------

export function recordBossPhase(run, meanings) {
  const dominant = dominantMeaning(meanings);
  if (dominant) run.bossInterpretationHistory.push(dominant);
  return run;
}

export function bossLeaningTags(run) {
  // Aggregate the dominant meanings recorded across boss phases.
  return rankedMeanings(
    run.bossInterpretationHistory.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {}),
  );
}
