// Terminal-trigger evaluation for the Adventure pilot.
//
// A terminal ending is only fair when four things are true (per the design
// spec): an established dangerous state, an event able to activate it, a chosen
// response that does not avoid/treat/transfer/redirect the danger, and a
// visible fictional warning shown before commitment. Triggers are therefore
// evaluated against the PRE-effect state (the "already Wounded / already
// Exhausted" the player could see) and can be mitigated by an intervention.

import { getPilotEnding, STRAIN_WARNINGS, PILOT_STATUSES } from '../../../data/adventure/pilot/vocab.mjs';

// Given a reading's terminal triggers, the pre-effect run, and the set of
// intervention ids that matched, returns the fired terminal descriptor or null.
export function evaluateTerminal({ triggers = [], preRun, matchedInterventions = [], mitigatedTriggerIds = [], trait }) {
  for (const trigger of triggers) {
    let fired = false;
    try {
      fired = Boolean(trigger.when && trigger.when({ run: preRun }));
    } catch {
      fired = false;
    }
    if (!fired) continue;
    if (mitigatedTriggerIds.includes(trigger.id)) continue;

    const ending = getPilotEnding(trigger.endingId);
    if (!ending) continue;
    return {
      triggerId: trigger.id,
      endingId: ending.id,
      title: ending.title,
      prose: ending.prose,
      warningSource: trigger.warningStatus || ending.warningSource,
      activatingTrait: trait,
      narrative: trigger.narrative,
    };
  }
  return null;
}

// Human-readable warning text for a danger source id, used by the HUD before
// commitment so terminal danger is never a surprise.
export function warningForSource(source) {
  if (!source) return null;
  if (source.startsWith('strain:')) {
    const stage = source.split(':')[1];
    return STRAIN_WARNINGS[stage] || null;
  }
  return PILOT_STATUSES[source]?.warning || null;
}
