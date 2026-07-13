// Adventure pilot run state factory and low-level state helpers.
//
// The pilot run state is intentionally free of Resolve, potency, requirements,
// or success tiers. A journey is a growing record of statuses, strain,
// materials, items, companions, structured memories, threads, echoes, and
// history. Terminal endings are authored consequences of that accumulated
// state, not arithmetic checks.

import { ECHO_KEYS, STRAIN_STAGES } from '../../../data/adventure/pilot/vocab.mjs';

export const PILOT_STAGE_COUNT = 8;

function emptyEchoes() {
  const echoes = {};
  for (const key of ECHO_KEYS) echoes[key] = 0;
  return echoes;
}

export function createPilotRun({ seed = 1, ...overrides } = {}) {
  const base = {
    seed: Number(seed) >>> 0 || 1,
    stage: 0,
    finished: false,
    reachedDestination: false,
    currentEventId: null,
    scheduledStages: [], // deterministic plan of stage kinds
    eventHistory: [],
    cardHistory: [],
    statuses: [],
    strain: 'clear',
    materials: ['timber', 'cloth'],
    provisions: 2,
    items: ['healing_salve'],
    companions: [],
    memories: {
      beast: null,
      ironGate: null,
      bandits: null,
      roadOutcome: null,
      roadTrapEvidence: 0,
      falseIdentity: null,
      stolenBelonging: null,
      fire: null,
      tollhouse: null,
      impostor: null,
    },
    threads: [],
    echoes: emptyEchoes(),
    witnesses: [],
    allies: [],
    enemies: [],
    terminalEnding: null,
  };
  const run = { ...base, ...overrides };
  // Ensure nested structures are fresh copies, not shared with overrides base.
  run.memories = { ...base.memories, ...(overrides.memories || {}) };
  run.echoes = { ...emptyEchoes(), ...(overrides.echoes || {}) };
  run.statuses = [...(overrides.statuses || base.statuses)];
  run.materials = [...(overrides.materials || base.materials)];
  run.items = [...(overrides.items || base.items)];
  run.companions = [...(overrides.companions || base.companions)];
  run.threads = [...(overrides.threads || base.threads)];
  run.eventHistory = [...(overrides.eventHistory || base.eventHistory)];
  run.cardHistory = [...(overrides.cardHistory || base.cardHistory)];
  run.witnesses = [...(overrides.witnesses || base.witnesses)];
  run.allies = [...(overrides.allies || base.allies)];
  run.enemies = [...(overrides.enemies || base.enemies)];
  return run;
}

export function hasStatus(run, id) {
  return Array.isArray(run.statuses) && run.statuses.includes(id);
}

export function hasItem(run, id) {
  return Array.isArray(run.items) && run.items.includes(id);
}

export function hasCompanion(run, id) {
  return Array.isArray(run.companions) && run.companions.includes(id);
}

export function hasMaterial(run, id) {
  return Array.isArray(run.materials) && run.materials.includes(id);
}

export function hasThread(run, id) {
  return Array.isArray(run.threads) && run.threads.some(thread => thread.id === id);
}

export function getThread(run, id) {
  return (run.threads || []).find(thread => thread.id === id) || null;
}

export function strainIndex(strain) {
  const index = STRAIN_STAGES.indexOf(strain);
  return index < 0 ? 0 : index;
}

export function isExhausted(run) {
  return run.strain === 'exhausted';
}

export function advanceStrainStage(strain, steps = 1) {
  const index = Math.min(STRAIN_STAGES.length - 1, Math.max(0, strainIndex(strain) + steps));
  return STRAIN_STAGES[index];
}

export function reduceStrainStage(strain, steps = 1) {
  const index = Math.max(0, strainIndex(strain) - steps);
  return STRAIN_STAGES[index];
}
