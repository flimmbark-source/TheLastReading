// Aggregates all pilot content and exposes stable lookups. The scheduler, UI,
// and validators import from here so there is one canonical registry of pilot
// events.

import { PILOT_CORE_EVENTS } from './pilotEvents.mjs';
import { PILOT_FOLLOWUP_EVENTS } from './pilotFollowups.mjs';
import { PILOT_CONVERGENCE_EVENTS } from './pilotConvergences.mjs';
import { RECOVERY_EVENT } from './pilotRecovery.mjs';

export { PILOT_CORE_EVENTS, PILOT_FOLLOWUP_EVENTS, PILOT_CONVERGENCE_EVENTS, RECOVERY_EVENT };

export const CORE_EVENT_IDS = PILOT_CORE_EVENTS.map(e => e.id);
export const FOLLOWUP_EVENT_IDS = PILOT_FOLLOWUP_EVENTS.map(e => e.id);
export const CONVERGENCE_EVENT_IDS = PILOT_CONVERGENCE_EVENTS.map(e => e.id);

export const ALL_PILOT_EVENTS = [
  ...PILOT_CORE_EVENTS,
  ...PILOT_FOLLOWUP_EVENTS,
  ...PILOT_CONVERGENCE_EVENTS,
];

// Events with card-first trait readings (everything except the recovery menu).
export const READING_EVENTS = ALL_PILOT_EVENTS;

const EVENT_BY_ID = new Map([...ALL_PILOT_EVENTS, RECOVERY_EVENT].map(event => [event.id, event]));

export function getPilotEvent(id) {
  return EVENT_BY_ID.get(id) || null;
}
