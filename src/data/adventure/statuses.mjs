// Adventure Mode — status definitions.
//
// Statuses persist between events and alter how later events resolve. Where
// possible a status modifies the hidden *meanings* of a spread rather than
// raw numbers, so its influence stays felt-but-unseen. A few statuses affect
// run-level rules (resolve cost, reward count); those hooks are read by
// src/systems/adventure/run.mjs because they are cross-cutting.

import { SUPERNATURAL_TAGS } from './interpretations.mjs';

/**
 * @typedef {('haunted'|'exposed'|'prepared'|'distrusted'|'blessed')} StatusId
 */

export const STATUSES = Object.freeze({
  haunted: {
    id: 'haunted',
    name: 'Haunted',
    description: 'Something followed you. Strengthens any supernatural leanings in your spread, swaying Events toward eerier outcomes.',
    // Amplifies supernatural meaning axes already present in the spread.
    modifyMeanings(meanings, spread) {
      for (const tag of SUPERNATURAL_TAGS) {
        if (meanings[tag] > 0) meanings[tag] += 1;
      }
      return meanings;
    },
  },
  exposed: {
    id: 'exposed',
    name: 'Exposed',
    description: 'Your weaknesses are known. Failing a Hostile Event costs 1 additional Resolve.',
    // Behaviour lives in run.mjs: hostile failures cost +1 Resolve.
    extraHostileFailureResolveCost: 1,
  },
  prepared: {
    id: 'prepared',
    name: 'Prepared',
    description: 'You know what waits ahead. Reveals the title of your next Event, then fades.',
    // Behaviour: HUD may reveal the next event while this is active.
    revealsNextEvent: true,
  },
  distrusted: {
    id: 'distrusted',
    name: 'Distrusted',
    description: 'Word spread about you. A Great Success on a Social Event only lets you choose 1 reward instead of 2.',
    // Behaviour: suppresses the extra triumph reward on SOCIAL events.
    suppressesSocialTriumphBonus: true,
  },
  blessed: {
    id: 'blessed',
    name: 'Blessed',
    description: 'Fortune favours you. Your next Great Success offers 1 extra reward to choose from, then fades.',
    // Behaviour: +1 triumph reward, then the status removes itself.
    bonusTriumphReward: 1,
    consumedByTriumph: true,
  },
});

export const STATUS_LIST = Object.freeze(Object.values(STATUSES));

export function getStatus(id) {
  return STATUSES[id] || null;
}
