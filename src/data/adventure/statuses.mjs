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
    description: 'Sways Supernatural Events toward eerier Outcomes.',
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
    description: 'Fail a Hostile [[event]]: lose 1 additional [[resolve]].',
    // Behaviour lives in run.mjs: hostile failures cost +1 Resolve.
    extraHostileFailureResolveCost: 1,
  },
  prepared: {
    id: 'prepared',
    name: 'Prepared',
    description: '[[reveal]] the next [[event]]’s title, then remove Prepared.',
    // Behaviour: HUD may reveal the next event while this is active.
    revealsNextEvent: true,
  },
  distrusted: {
    id: 'distrusted',
    name: 'Distrusted',
    description: 'A Social Great Success lets you [[choose]] 1 reward instead of 2.',
    // Behaviour: suppresses the extra triumph reward on SOCIAL events.
    suppressesSocialTriumphBonus: true,
  },
  blessed: {
    id: 'blessed',
    name: 'Blessed',
    description: 'Your next Great Success offers +1 reward, then removes Blessed.',
    // Behaviour: +1 triumph reward, then the status removes itself.
    bonusTriumphReward: 1,
    consumedByTriumph: true,
  },
});

export const STATUS_LIST = Object.freeze(Object.values(STATUSES));

export function getStatus(id) {
  return STATUSES[id] || null;
}
