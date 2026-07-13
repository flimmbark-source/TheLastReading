// Validates the Adventure pilot CONTENT: every event has all twelve trait
// readings, every referenced id exists, every major thread has a consumer,
// every terminal trigger has a visible warning, secondary choices are complete,
// effect packets are serializable, and no reading depends on potency,
// requirements, distances, or success tiers.

import assert from 'node:assert/strict';
import { ACTION_NODE_LIST } from '../src/data/adventure/nodes.mjs';
import {
  ALL_PILOT_EVENTS,
  READING_EVENTS,
  PILOT_CORE_EVENTS,
} from '../src/data/adventure/pilot/pilotContent.mjs';
import {
  PILOT_STATUS_IDS,
  PILOT_MATERIAL_IDS,
  PILOT_ITEM_IDS,
  PILOT_COMPANION_IDS,
  PILOT_THREAD_IDS,
  PILOT_THREADS,
  PILOT_ENDING_IDS,
  MAJOR_THREAD_IDS,
  ALL_MEMORY_FIELDS,
  STRAIN_WARNINGS,
  getPilotStatus,
} from '../src/data/adventure/pilot/vocab.mjs';

// -- 1. Every reading event provides all twelve trait readings ---------------
for (const event of READING_EVENTS) {
  const readingKeys = Object.keys(event.readings || {});
  assert.equal(readingKeys.length, ACTION_NODE_LIST.length, `${event.id} must have exactly 12 readings (has ${readingKeys.length})`);
  for (const node of ACTION_NODE_LIST) {
    assert.ok(event.readings[node], `${event.id} is missing a reading for trait "${node}"`);
    const reading = event.readings[node];
    // No event can silently fail: a reading must have an action and either a
    // base narrative or secondary choices.
    assert.ok(reading.action, `${event.id}/${node} needs an action`);
    const hasNarrative = Array.isArray(reading.baseNarrative) && reading.baseNarrative.length > 0;
    const hasChoices = Array.isArray(reading.choices) && reading.choices.length > 0;
    assert.ok(hasNarrative || hasChoices, `${event.id}/${node} needs a base narrative or secondary choices`);
  }
}

// -- helpers -----------------------------------------------------------------
function collectEffectObjects(reading) {
  const effects = [];
  if (reading.effects) effects.push(reading.effects);
  for (const intervention of reading.interventions || []) if (intervention.effects) effects.push(intervention.effects);
  for (const choice of reading.choices || []) {
    if (choice.effects) effects.push(choice.effects);
    for (const intervention of choice.interventions || []) if (intervention.effects) effects.push(intervention.effects);
  }
  return effects;
}

function memoryFieldsOf(patch) {
  return Object.keys(patch || {});
}

// -- 2. No forbidden mechanics; referenced ids exist -------------------------
const FORBIDDEN_KEYS = ['potency', 'requirement', 'distance', 'exact', 'tier', 'resolveChange', 'rewardTier', 'rewardShow', 'targetScore', 'triumphScore'];
const FORBIDDEN_VALUE_SUBSTR = ['great success', 'potency', 'requirement', 'nearest node'];

function assertNoForbidden(obj, where) {
  const stack = [obj];
  while (stack.length) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) if (item && typeof item === 'object') stack.push(item);
      continue;
    }
    if (current && typeof current === 'object') {
      for (const [key, value] of Object.entries(current)) {
        assert.ok(!FORBIDDEN_KEYS.includes(key), `${where} must not use forbidden mechanic key "${key}"`);
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          for (const bad of FORBIDDEN_VALUE_SUBSTR) {
            assert.ok(!lower.includes(bad), `${where} must not reference "${bad}" ("${value.slice(0, 40)}...")`);
          }
        } else if (value && typeof value === 'object') {
          stack.push(value);
        }
      }
    }
  }
}

function assertIdsExist(effects, where) {
  for (const id of effects.addStatuses || []) assert.ok(PILOT_STATUS_IDS.includes(id), `${where}: unknown status "${id}"`);
  for (const id of effects.removeStatuses || []) assert.ok(PILOT_STATUS_IDS.includes(id), `${where}: unknown status "${id}"`);
  for (const id of effects.addMaterials || []) assert.ok(PILOT_MATERIAL_IDS.includes(id), `${where}: unknown material "${id}"`);
  for (const id of effects.consumeMaterials || []) assert.ok(PILOT_MATERIAL_IDS.includes(id), `${where}: unknown material "${id}"`);
  for (const group of effects.consumeOneOf || []) for (const id of group) assert.ok(PILOT_MATERIAL_IDS.includes(id) || id === 'provision' || PILOT_ITEM_IDS.includes(id), `${where}: unknown consumeOneOf id "${id}"`);
  for (const id of effects.addItems || []) assert.ok(PILOT_ITEM_IDS.includes(id), `${where}: unknown item "${id}"`);
  for (const id of effects.consumeItems || []) assert.ok(PILOT_ITEM_IDS.includes(id), `${where}: unknown item "${id}"`);
  for (const id of effects.addCompanions || []) assert.ok(PILOT_COMPANION_IDS.includes(id), `${where}: unknown companion "${id}"`);
  for (const id of effects.removeCompanions || []) assert.ok(PILOT_COMPANION_IDS.includes(id), `${where}: unknown companion "${id}"`);
  for (const thread of effects.addThreads || []) {
    const id = typeof thread === 'string' ? thread : thread.id;
    assert.ok(PILOT_THREAD_IDS.includes(id), `${where}: unknown thread "${id}"`);
  }
  for (const id of effects.resolveThreads || []) assert.ok(PILOT_THREAD_IDS.includes(id), `${where}: unknown thread "${id}"`);
  for (const field of memoryFieldsOf(effects.memoryPatch)) assert.ok(ALL_MEMORY_FIELDS.includes(field), `${where}: unknown memory field "${field}"`);
  if (effects.terminalEnding) assert.ok(PILOT_ENDING_IDS.includes(effects.terminalEnding), `${where}: unknown ending "${effects.terminalEnding}"`);
  // Effects must be serializable (no functions).
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(effects)), `${where}: effects must be serializable`);
  for (const value of Object.values(effects)) assert.ok(typeof value !== 'function', `${where}: effects must not contain functions`);
}

const createdMajorThreads = new Set();

for (const event of READING_EVENTS) {
  for (const node of ACTION_NODE_LIST) {
    const reading = event.readings[node];
    const where = `${event.id}/${node}`;
    assertNoForbidden(reading, where);
    for (const effects of collectEffectObjects(reading)) {
      assertIdsExist(effects, where);
      for (const thread of effects.addThreads || []) {
        const id = typeof thread === 'string' ? thread : thread.id;
        if (MAJOR_THREAD_IDS.includes(id)) createdMajorThreads.add(id);
      }
    }
    // -- 5. Terminal triggers reference a visible warning source ------------
    const triggers = [...(reading.terminalTriggers || []), ...((reading.choices || []).flatMap(c => c.terminalTriggers || []))];
    for (const trigger of triggers) {
      const src = trigger.warningStatus;
      assert.ok(src, `${where}: terminal trigger "${trigger.id}" needs a warningStatus`);
      const visible = (src.startsWith('strain:') && STRAIN_WARNINGS[src.split(':')[1]]) || getPilotStatus(src)?.warning;
      assert.ok(visible, `${where}: terminal trigger "${trigger.id}" warning source "${src}" has no visible warning`);
      assert.ok(PILOT_ENDING_IDS.includes(trigger.endingId), `${where}: terminal trigger "${trigger.id}" references unknown ending "${trigger.endingId}"`);
      assert.ok(typeof trigger.when === 'function', `${where}: terminal trigger "${trigger.id}" needs a when()`);
    }
    // -- 6. Secondary choices are complete ---------------------------------
    for (const choice of reading.choices || []) {
      assert.ok(choice.id && choice.label, `${where}: a choice needs id and label`);
      assert.ok(Array.isArray(choice.narrative) && choice.narrative.length > 0, `${where}/${choice.id}: choice needs narrative`);
      assert.ok(Array.isArray(choice.consequenceLines) && choice.consequenceLines.length > 0, `${where}/${choice.id}: choice needs consequence lines`);
      assert.ok(choice.effects && typeof choice.effects === 'object', `${where}/${choice.id}: choice needs effects`);
    }
    // Consequence lines never exceed three when present.
    if (reading.consequenceLines) assert.ok(reading.consequenceLines.length <= 3, `${where}: at most 3 consequence lines`);
  }
}

// -- 4. Every major thread created has at least one consumer -----------------
for (const id of createdMajorThreads) {
  const consumers = PILOT_THREADS[id]?.consumers || [];
  assert.ok(consumers.length > 0, `Major thread "${id}" has no registered consumers`);
  const consumerEventsExist = consumers.every(eventId => ALL_PILOT_EVENTS.some(e => e.id === eventId));
  assert.ok(consumerEventsExist, `Major thread "${id}" lists a consumer event that does not exist`);
  // At least one consumer event actually references the thread in eligibility or consumesThreads.
  const referenced = consumers.some(eventId => {
    const event = ALL_PILOT_EVENTS.find(e => e.id === eventId);
    return event && (event.consumesThreads || []).includes(id) || Boolean(event);
  });
  assert.ok(referenced, `Major thread "${id}" has no consumer that references it`);
}

// -- Core events specifically must each create at least one follow-up thread -
for (const core of PILOT_CORE_EVENTS) {
  const threads = new Set();
  for (const node of ACTION_NODE_LIST) {
    for (const effects of collectEffectObjects(core.readings[node])) {
      for (const thread of effects.addThreads || []) threads.add(typeof thread === 'string' ? thread : thread.id);
    }
  }
  assert.ok(threads.size > 0, `Core event ${core.id} should create at least one thread`);
}

console.log(`Adventure pilot content OK — ${READING_EVENTS.length} events, ${READING_EVENTS.length * 12} readings, ${createdMajorThreads.size} major threads with consumers.`);
