// Pilot run orchestration: enters stages, applies resolutions, records history,
// and drives the deterministic eight-stage flow. Keeps the current event as a
// value the caller holds between scheduling and resolving, so the serializable
// run state never has to carry authored functions.

import { createPilotRun } from './pilotState.mjs';
import { applyEffects } from './pilotEffects.mjs';
import { resolvePilotEvent, resolveWithChoice } from './pilotResolver.mjs';
import { scheduleStage, coreOrder, STAGE_KINDS } from './pilotScheduler.mjs';
import { createSeededRng } from './rng.mjs';
import { buildRecoveryChoices } from '../../../data/adventure/pilot/pilotRecovery.mjs';

export { STAGE_KINDS };

export function startPilotRun({ seed = 1, ...overrides } = {}) {
  const run = createPilotRun({ seed, ...overrides });
  run.coreOrderIds = coreOrder(run.seed);
  run.usedEventIds = [];
  run.stage = 0;
  run.finished = false;
  run.reachedDestination = false;
  return run;
}

// Positions the run at its current stage and returns a descriptor the caller
// keeps: { event, kind, isRecovery, isFinale, placeholder, recoveryChoices }.
export function enterStage(run) {
  const descriptor = scheduleStage(run);
  if (descriptor.isFinale) {
    run.currentEventId = null;
    run.finished = true;
    run.reachedDestination = true;
    return descriptor;
  }
  if (descriptor.isRecovery) {
    run.currentEventId = 'recovery';
    const seedValue = createSeededRng((run.seed ^ ((run.stage + 1) * 40503)) >>> 0)();
    descriptor.recoveryChoices = buildRecoveryChoices(run, seedValue);
    return descriptor;
  }
  if (descriptor.event) {
    run.currentEventId = descriptor.event.id;
    if (!run.usedEventIds.includes(descriptor.event.id)) run.usedEventIds.push(descriptor.event.id);
  } else {
    run.currentEventId = null;
  }
  return descriptor;
}

// Resolve a card (or explicit trait) against the current event. Returns the
// resolution packet, which may carry pendingChoices. Pure — does not mutate.
export function resolveCurrent(run, event, card, trait) {
  return resolvePilotEvent({ event, card, run, trait });
}

export function resolveChoice(run, event, trait, choiceId, card) {
  return resolveWithChoice({ event, card, run, trait, choiceId });
}

// Apply a resolution packet to the run: mutate state, record history, and flag
// a terminal ending if one fired. Does not advance the stage.
export function applyResolution(run, event, packet) {
  applyEffects(run, packet.effects || {});
  run.eventHistory.push({
    stage: run.stage,
    eventId: packet.eventId,
    eventTitle: event?.title || packet.eventId,
    kind: event?.kind || 'event',
    trait: packet.trait,
    traitLabel: packet.traitLabel,
    choiceId: packet.choiceId || null,
    choiceLabel: packet.choiceLabel || null,
    action: packet.action,
    narrative: packet.narrative,
    consequenceLines: packet.consequenceLines,
    interventionsApplied: packet.interventionsApplied || [],
    terminal: packet.terminal || null,
    placeholder: Boolean(event?.placeholder),
  });
  if (packet.cardId) {
    run.cardHistory.push({ stage: run.stage, eventId: packet.eventId, cardId: packet.cardId, trait: packet.trait });
  }
  if (packet.terminal) {
    run.terminalEnding = {
      endingId: packet.terminal.endingId,
      title: packet.terminal.title,
      prose: packet.terminal.prose,
      warningSource: packet.terminal.warningSource,
      activatingTrait: packet.terminal.activatingTrait,
      eventId: packet.eventId,
      eventTitle: event?.title || packet.eventId,
    };
    run.finished = true;
  }
  return { terminal: packet.terminal || null };
}

// Apply a recovery choice (from buildRecoveryChoices). Records history.
export function applyRecovery(run, choice) {
  applyEffects(run, choice.effects || {});
  run.eventHistory.push({
    stage: run.stage,
    eventId: 'recovery',
    eventTitle: 'A Place to Rest',
    kind: 'recovery',
    trait: null,
    traitLabel: null,
    choiceId: choice.id,
    choiceLabel: choice.label,
    action: choice.label,
    narrative: [choice.description],
    consequenceLines: choice.consequenceLines || [],
    interventionsApplied: [],
    terminal: null,
    placeholder: false,
  });
}

// Advance to the next stage. Returns the new stage descriptor (or a finished
// descriptor). No-op if the run is already finished.
export function advanceStage(run) {
  if (run.finished) return { event: null, kind: 'finale', isFinale: true, finished: true };
  run.stage += 1;
  return enterStage(run);
}

// ---------------------------------------------------------------------------
// Headless driver for validators. `strategy(context)` receives
// { event, kind, run, recoveryChoices } and returns:
//   - for a reading event: { trait, choiceId? }
//   - for recovery: { recoveryId }
// ---------------------------------------------------------------------------
export function playSeededRun({ seed = 1, overrides = {}, strategy }) {
  const run = startPilotRun({ seed, ...overrides });
  let descriptor = enterStage(run);
  let guard = 0;
  while (!run.finished && guard < 32) {
    guard += 1;
    if (descriptor.isFinale) break;
    if (descriptor.isRecovery) {
      const decision = strategy({ event: descriptor.event, kind: descriptor.kind, run, recoveryChoices: descriptor.recoveryChoices }) || {};
      const choice =
        descriptor.recoveryChoices.find(c => c.id === decision.recoveryId) || descriptor.recoveryChoices[0];
      applyRecovery(run, choice);
      descriptor = advanceStage(run);
      continue;
    }
    const event = descriptor.event;
    const decision = strategy({ event, kind: descriptor.kind, run }) || {};
    const trait = decision.trait;
    let packet = resolveCurrent(run, event, null, trait);
    if (packet.pendingChoices) {
      const choiceId = decision.choiceId || packet.pendingChoices[0].id;
      packet = resolveChoice(run, event, trait, choiceId);
    }
    applyResolution(run, event, packet);
    if (run.finished) break;
    descriptor = advanceStage(run);
  }
  return run;
}
