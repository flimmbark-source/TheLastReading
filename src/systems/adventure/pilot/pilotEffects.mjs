// Applies a structured effect packet to a pilot run.
//
// Effect packets are deterministic and serializable data — no functions, no
// random numbers. All world change flows through here so that the same packet
// applied to the same state always produces the same result, which the seeded
// scenario validator relies on.

import { MATERIAL_CAPACITY, PILOT_STATUSES } from '../../../data/adventure/pilot/vocab.mjs';
import { advanceStrainStage, reduceStrainStage, strainIndex } from './pilotState.mjs';
import { STRAIN_STAGES } from '../../../data/adventure/pilot/vocab.mjs';

function pushUnique(list, value) {
  if (value == null) return;
  if (!list.includes(value)) list.push(value);
}

function removeValue(list, value) {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
}

function addStatus(run, id) {
  // Haunted deepens into Deeply Haunted rather than stacking.
  if (id === 'haunted' && run.statuses.includes('haunted')) {
    removeValue(run.statuses, 'haunted');
    pushUnique(run.statuses, 'deeply_haunted');
    return;
  }
  if (id === 'haunted' && run.statuses.includes('deeply_haunted')) return;
  if (id === 'deeply_haunted') removeValue(run.statuses, 'haunted');
  pushUnique(run.statuses, id);
}

function applyMemoryPatch(run, patch) {
  for (const [field, value] of Object.entries(patch)) {
    if (value == null) {
      run.memories[field] = value;
      continue;
    }
    if (field === 'roadTrapEvidence') {
      run.memories.roadTrapEvidence = Number(value) || 0;
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      run.memories[field] = { ...(run.memories[field] || {}), ...value };
      continue;
    }
    run.memories[field] = value;
  }
}

// Applies the effect packet to the run object in place. Returns a list of debug
// notes describing anything that could not be paid or was clamped.
export function applyEffects(run, effects = {}) {
  const notes = [...(effects.debugNotes || [])];

  for (const id of effects.removeStatuses || []) removeValue(run.statuses, id);
  for (const id of effects.addStatuses || []) addStatus(run, id);

  if (effects.setStrain && STRAIN_STAGES.includes(effects.setStrain)) {
    run.strain = effects.setStrain;
  }
  if (effects.advanceStrain) {
    run.strain = advanceStrainStage(run.strain, effects.advanceStrain);
  }
  if (effects.reduceStrain) {
    run.strain = reduceStrainStage(run.strain, effects.reduceStrain);
  }
  if (effects.clearStrain) {
    run.strain = 'clear';
  }

  for (const id of effects.consumeMaterials || []) removeValue(run.materials, id);
  for (const group of effects.consumeOneOf || []) {
    // A group is an ordered list of candidate costs; the first one the traveler
    // actually has is paid. Candidates may be materials, 'provision', or items.
    const candidate = group.find(id => {
      if (id === 'provision') return run.provisions > 0;
      if (run.materials.includes(id)) return true;
      return run.items.includes(id);
    });
    if (candidate === 'provision') run.provisions = Math.max(0, run.provisions - 1);
    else if (candidate && run.materials.includes(candidate)) removeValue(run.materials, candidate);
    else if (candidate) removeValue(run.items, candidate);
    else notes.push(`Could not pay cost (${group.join('/')}): none available.`);
  }
  for (const id of effects.addMaterials || []) {
    if (run.materials.length >= MATERIAL_CAPACITY) {
      notes.push(`Material capacity full; ${id} not carried.`);
    } else {
      run.materials.push(id);
    }
  }

  if (effects.consumeProvision) run.provisions = Math.max(0, run.provisions - effects.consumeProvision);
  if (effects.addProvisions) run.provisions += effects.addProvisions;

  for (const id of effects.consumeItems || []) removeValue(run.items, id);
  for (const id of effects.addItems || []) pushUnique(run.items, id);

  for (const id of effects.removeCompanions || []) removeValue(run.companions, id);
  for (const id of effects.addCompanions || []) pushUnique(run.companions, id);

  if (effects.memoryPatch) applyMemoryPatch(run, effects.memoryPatch);
  if (effects.roadTrapEvidenceInc) {
    run.memories.roadTrapEvidence = (run.memories.roadTrapEvidence || 0) + effects.roadTrapEvidenceInc;
  }

  for (const id of effects.resolveThreads || []) {
    run.threads = run.threads.filter(thread => thread.id !== id);
  }
  for (const thread of effects.addThreads || []) {
    const id = typeof thread === 'string' ? thread : thread.id;
    if (run.threads.some(existing => existing.id === id)) {
      // Re-prioritise instead of duplicating.
      const existing = run.threads.find(t => t.id === id);
      if (typeof thread === 'object' && thread.urgency) existing.urgency = thread.urgency;
      continue;
    }
    run.threads.push({
      id,
      sourceEventId: (typeof thread === 'object' && thread.sourceEventId) || run.currentEventId || null,
      urgency: (typeof thread === 'object' && thread.urgency) || 'active',
      tags: (typeof thread === 'object' && thread.tags) || [],
      data: (typeof thread === 'object' && thread.data) || {},
    });
  }

  // "Investigation takes time": one urgent thread advances. Concretely, an
  // active thread sharpens to urgent, or an existing pursuit closes further.
  if (effects.advanceUrgent) {
    const active = run.threads.find(thread => thread.urgency === 'active');
    if (active) {
      active.urgency = 'urgent';
      notes.push(`Time cost: thread "${active.id}" advanced to urgent.`);
    } else if (run.statuses.includes('hunted') && !run.threads.some(t => t.id === 'pursuers_close')) {
      run.threads.push({ id: 'pursuers_close', sourceEventId: run.currentEventId, urgency: 'urgent', tags: ['time'], data: {} });
      notes.push('Time cost: your pursuers drew closer.');
    } else {
      const dormant = run.threads.find(thread => thread.urgency === 'dormant');
      if (dormant) {
        dormant.urgency = 'active';
        notes.push(`Time cost: thread "${dormant.id}" stirred.`);
      }
    }
  }

  if (effects.echoChanges) {
    for (const [key, delta] of Object.entries(effects.echoChanges)) {
      run.echoes[key] = (run.echoes[key] || 0) + Number(delta || 0);
    }
  }

  for (const witness of effects.addWitnesses || []) pushUnique(run.witnesses, witness);
  for (const ally of effects.addAllies || []) pushUnique(run.allies, ally);
  for (const enemy of effects.addEnemies || []) pushUnique(run.enemies, enemy);

  return notes;
}

export function statusIsDanger(id) {
  return Boolean(PILOT_STATUSES[id]?.danger);
}

export function strainIsAtLeast(strain, stage) {
  return strainIndex(strain) >= strainIndex(stage);
}
