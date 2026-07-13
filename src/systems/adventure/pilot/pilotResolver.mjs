// The pilot event resolver: CARD-FIRST, direct-reading resolution.
//
// The chosen card's Adventure trait (its ACTION_NODE) selects the reading
// DIRECTLY: event.readings[trait]. There is deliberately no graph route, no
// nearest-node fallback, no potency-vs-requirement comparison, no distance
// penalty, and no Failure/Success/Great Success tier. Selecting an
// Investigation card resolves the Investigation reading — never Compassion,
// Protection, or some "nearest" node.

import { cardAdventureProfile } from '../../../data/adventure/cardNodes.mjs';
import { TRAIT_LABELS } from '../../../data/adventure/pilot/vocab.mjs';
import { selectInterventions, proseIntervention } from './pilotInterventions.mjs';
import { evaluateTerminal } from './pilotTerminal.mjs';

function clonePlainRun(run) {
  // Structured, deterministic deep clone of the plain-data run state used for
  // pre-effect trigger/intervention evaluation.
  return JSON.parse(JSON.stringify(run));
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function mergeEffects(...packets) {
  const merged = {};
  const arrayFields = [
    'addStatuses',
    'removeStatuses',
    'addMaterials',
    'consumeMaterials',
    'consumeOneOf',
    'addItems',
    'consumeItems',
    'addCompanions',
    'removeCompanions',
    'addThreads',
    'resolveThreads',
    'addWitnesses',
    'addAllies',
    'addEnemies',
    'debugNotes',
  ];
  const numberFields = ['advanceStrain', 'reduceStrain', 'consumeProvision', 'addProvisions', 'roadTrapEvidenceInc'];
  for (const packet of packets) {
    if (!packet) continue;
    for (const field of arrayFields) {
      if (packet[field]) merged[field] = [...(merged[field] || []), ...packet[field]];
    }
    for (const field of numberFields) {
      if (packet[field]) merged[field] = (merged[field] || 0) + packet[field];
    }
    if (packet.setStrain) merged.setStrain = packet.setStrain;
    if (packet.clearStrain) merged.clearStrain = true;
    if (packet.memoryPatch) merged.memoryPatch = { ...(merged.memoryPatch || {}), ...packet.memoryPatch };
    if (packet.echoChanges) {
      merged.echoChanges = { ...(merged.echoChanges || {}) };
      for (const [k, v] of Object.entries(packet.echoChanges)) merged.echoChanges[k] = (merged.echoChanges[k] || 0) + v;
    }
  }
  return merged;
}

export function getReading(event, trait) {
  return event?.readings?.[trait] || null;
}

// Available secondary choices for a reading given the current run.
export function availableChoices(reading, run) {
  const choices = reading?.choices || [];
  return choices.filter(choice => {
    if (typeof choice.available !== 'function') return true;
    try {
      return Boolean(choice.available({ run }));
    } catch {
      return false;
    }
  });
}

// Resolve a card played against an event. Returns a resolution packet. Does NOT
// mutate the run — application is a separate, explicit step (applyResolution in
// pilotRun.mjs) so the resolver stays pure and deterministic.
//
// If the reading exposes two or more available secondary choices, the packet
// carries `pendingChoices` and the caller must present them and then call
// resolveWithChoice(). A single available choice is applied automatically.
export function resolvePilotEvent({ event, card, run, trait: traitOverride }) {
  const profile = card ? cardAdventureProfile(card) : null;
  const trait = traitOverride || profile?.node;
  if (!event || !trait) throw new Error('Pilot resolver requires an event and a card trait.');

  const reading = getReading(event, trait);
  if (!reading) {
    // A missing reading must never fail silently.
    throw new Error(`Pilot event "${event.id}" has no reading for trait "${trait}".`);
  }

  const choices = availableChoices(reading, run);
  if (choices.length >= 2) {
    return {
      eventId: event.id,
      cardId: card?.id || null,
      trait,
      traitLabel: TRAIT_LABELS[trait] || trait,
      action: reading.action,
      pendingChoices: choices.map(choice => ({
        id: choice.id,
        label: choice.label,
        description: choice.description || '',
      })),
      narrative: asArray(reading.action ? [reading.action] : []),
      consequenceLines: [],
      interventionsApplied: [],
      terminal: null,
      effects: {},
      debugNotes: ['Awaiting secondary supernatural choice.'],
    };
  }

  const chosen = choices.length === 1 ? choices[0] : null;
  return buildResolution({ event, card, run, trait, reading, choice: chosen });
}

// Resolve after the player picked a secondary choice.
export function resolveWithChoice({ event, card, run, trait: traitOverride, choiceId }) {
  const profile = card ? cardAdventureProfile(card) : null;
  const trait = traitOverride || profile?.node;
  const reading = getReading(event, trait);
  if (!reading) throw new Error(`Pilot event "${event.id}" has no reading for trait "${trait}".`);
  const choice = (reading.choices || []).find(candidate => candidate.id === choiceId) || null;
  if (!choice) throw new Error(`Reading "${event.id}/${trait}" has no choice "${choiceId}".`);
  return buildResolution({ event, card, run, trait, reading, choice });
}

function buildResolution({ event, card, run, trait, reading, choice }) {
  const preRun = clonePlainRun(run);

  const baseInterventions = [...(reading.interventions || []), ...((choice && choice.interventions) || [])];
  const matched = selectInterventions(baseInterventions, preRun);
  const matchedIds = matched.map(intervention => intervention.id);
  const mitigatedTriggerIds = matched
    .filter(intervention => intervention.mitigatesTerminal)
    .map(intervention => intervention.mitigatesTerminal);

  // Narrative: base (or choice) narrative, optionally replaced/extended by the
  // single highest-priority prose intervention.
  let narrative = asArray((choice && choice.narrative) || reading.baseNarrative || []);
  let consequenceLines = asArray((choice && choice.consequenceLines) || reading.consequenceLines || []);
  const prose = proseIntervention(matched);
  if (prose) {
    if (prose.replaceNarrative) narrative = asArray(prose.replaceNarrative);
    else if (prose.addNarrative) narrative = [...narrative, ...asArray(prose.addNarrative)];
    if (prose.consequenceLines) consequenceLines = asArray(prose.consequenceLines);
  }

  // Terminal evaluation against pre-effect state.
  const triggers = [...(reading.terminalTriggers || []), ...((choice && choice.terminalTriggers) || [])];
  const terminal = evaluateTerminal({ triggers, preRun, matchedInterventions: matched, mitigatedTriggerIds, trait });

  // Effects: base + choice + every matched intervention's effects. The chosen
  // trait's echo is auto-incremented so authors never repeat it.
  const effects = mergeEffects(
    reading.effects,
    choice && choice.effects,
    ...matched.map(intervention => intervention.effects),
    { echoChanges: { [trait]: 1 } },
  );

  const packet = {
    eventId: event.id,
    cardId: card?.id || null,
    trait,
    traitLabel: TRAIT_LABELS[trait] || trait,
    action: (choice && choice.action) || reading.action,
    choiceId: choice ? choice.id : null,
    choiceLabel: choice ? choice.label : null,
    narrative,
    consequenceLines: consequenceLines.slice(0, 3),
    interventionsApplied: matchedIds,
    terminal: null,
    effects,
    pendingChoices: null,
    debugNotes: [`reading:${event.id}/${trait}${choice ? '/' + choice.id : ''}`, ...matchedIds.map(id => `intervention:${id}`)],
  };

  if (terminal) {
    // On a terminal outcome the journey ends; the beneficial effects of the
    // action do not resolve, but its echo still records the attempt.
    packet.terminal = terminal;
    packet.narrative = terminal.narrative ? asArray(terminal.narrative) : narrative;
    packet.consequenceLines = [];
    packet.effects = { echoChanges: { [trait]: 1 }, terminalEnding: terminal.endingId };
  }

  return packet;
}
