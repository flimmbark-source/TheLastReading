// Deterministic eight-stage scheduler.
//
// The scheduler chooses each stage's content from ACTIVE THREADS rather than a
// fixed list wherever possible: follow-ups and convergences are selected by the
// urgency of the threads they would consume, so a run's shape is a consequence
// of the player's own decisions. Under a fixed seed the whole sequence is
// reproducible, which the seeded scenario validator relies on.

import { ACTION_NODE_LIST } from '../../../data/adventure/nodes.mjs';
import {
  PILOT_CORE_EVENTS,
  PILOT_FOLLOWUP_EVENTS,
  PILOT_CONVERGENCE_EVENTS,
  getPilotEvent,
} from '../../../data/adventure/pilot/pilotContent.mjs';
import { createSeededRng } from './rng.mjs';

export const STAGE_KINDS = Object.freeze([
  'core', // 1
  'core', // 2
  'followup_or_core', // 3
  'recovery', // 4
  'core', // 5
  'followup', // 6
  'convergence', // 7
  'finale', // 8
]);

const URGENCY_WEIGHT = { urgent: 3, active: 2, dormant: 1 };

function shuffleDeterministic(list, seed) {
  const rng = createSeededRng(seed);
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// The seeded, ordered list of core event ids for a run.
export function coreOrder(seed) {
  return shuffleDeterministic(PILOT_CORE_EVENTS.map(e => e.id), (seed ^ 0x9e3779b9) >>> 0);
}

function threadScore(event, run) {
  const consumes = event.consumesThreads || event.combines || [];
  let score = 0;
  for (const thread of run.threads) {
    if (consumes.includes(thread.id)) score += URGENCY_WEIGHT[thread.urgency] || 1;
  }
  return score;
}

// Pick the eligible event whose consumable threads are most urgent. Ties break
// deterministically on the run seed + stage.
function pickByUrgency(events, run, usedIds, tieSeed) {
  const eligible = events.filter(event => !usedIds.includes(event.id) && (!event.eligible || event.eligible(run)));
  if (eligible.length === 0) return null;
  let best = [];
  let bestScore = -Infinity;
  for (const event of eligible) {
    const score = threadScore(event, run);
    if (score > bestScore) {
      bestScore = score;
      best = [event];
    } else if (score === bestScore) {
      best.push(event);
    }
  }
  if (best.length === 1) return best[0];
  const rng = createSeededRng((run.seed ^ (tieSeed * 2654435761)) >>> 0);
  return best[Math.floor(rng() * best.length)];
}

function nextCore(run, usedIds) {
  const order = run.coreOrderIds || coreOrder(run.seed);
  return order.find(id => !usedIds.includes(id)) || null;
}

// Builds a neutral convergence placeholder when no authored convergence is
// eligible. It summarizes the two most active threads without resolving them
// and is flagged as a known playtest limitation. It still provides a reading
// for every trait so the card-first loop never fails.
export function buildNeutralConvergence(run) {
  const ranked = [...run.threads].sort((a, b) => (URGENCY_WEIGHT[b.urgency] || 0) - (URGENCY_WEIGHT[a.urgency] || 0));
  const [a, b] = ranked;
  const names = [a?.id, b?.id].filter(Boolean).map(id => id.replace(/_/g, ' '));
  const summary = names.length
    ? `Two unfinished matters press in at once — ${names.join(' and ')} — but neither resolves here.`
    : 'The road is quiet; nothing unfinished converges here.';
  const readings = {};
  for (const trait of ACTION_NODE_LIST) {
    readings[trait] = {
      id: `neutral_convergence_${trait}`,
      action: 'You take the measure of what is still unfinished.',
      baseNarrative: [summary, 'You answer as best you can and press on toward the well.'],
      consequenceLines: ['You weighed your unfinished threads.', 'Nothing was resolved here.', 'The threads carry into the finale.'],
      effects: {},
    };
  }
  return {
    id: 'neutral_convergence',
    title: 'The Road Narrows',
    kind: 'convergence_placeholder',
    placeholder: true,
    description: summary,
    detailPalette: [],
    readings,
  };
}

// Given a run positioned at run.stage, returns { event, kind, isRecovery,
// isFinale, placeholder }. Records the chosen id in run.usedEventIds.
export function scheduleStage(run) {
  const kind = STAGE_KINDS[run.stage];
  const used = run.usedEventIds || [];

  if (kind === 'finale') {
    return { event: null, kind, isRecovery: false, isFinale: true, placeholder: false };
  }
  if (kind === 'recovery') {
    return { event: getPilotEvent('recovery'), kind, isRecovery: true, isFinale: false, placeholder: false };
  }

  let event = null;
  if (kind === 'core') {
    const coreId = nextCore(run, used);
    event = coreId ? getPilotEvent(coreId) : null;
    if (!event) {
      // No cores left: fall back to an eligible follow-up, then convergence.
      event = pickByUrgency(PILOT_FOLLOWUP_EVENTS, run, used, run.stage) || pickByUrgency(PILOT_CONVERGENCE_EVENTS, run, used, run.stage);
    }
  } else if (kind === 'followup_or_core') {
    event = pickByUrgency(PILOT_FOLLOWUP_EVENTS, run, used, run.stage);
    if (!event) {
      const coreId = nextCore(run, used);
      event = coreId ? getPilotEvent(coreId) : null;
    }
  } else if (kind === 'followup') {
    event = pickByUrgency(PILOT_FOLLOWUP_EVENTS, run, used, run.stage);
    if (!event) {
      const coreId = nextCore(run, used);
      event = coreId ? getPilotEvent(coreId) : pickByUrgency(PILOT_CONVERGENCE_EVENTS, run, used, run.stage);
    }
  } else if (kind === 'convergence') {
    event = pickByUrgency(PILOT_CONVERGENCE_EVENTS, run, used, run.stage);
    if (!event) event = buildNeutralConvergence(run);
  }

  // A playable stage must always yield an event with all twelve readings, so
  // the card-first loop can never dead-end. Fall back to the neutral
  // placeholder if nothing eligible remained.
  if (!event) event = buildNeutralConvergence(run);

  return {
    event,
    kind,
    isRecovery: false,
    isFinale: false,
    placeholder: Boolean(event && event.placeholder),
  };
}
