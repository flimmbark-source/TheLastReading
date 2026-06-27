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
    description: 'Something followed you. Supernatural readings run stronger.',
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
    description: 'Your weaknesses are known. Failing a hostile event hurts more.',
    // Behaviour lives in run.mjs: hostile failures cost +1 Resolve.
    extraHostileFailureResolveCost: 1,
  },
  prepared: {
    id: 'prepared',
    name: 'Prepared',
    description: 'You know what waits ahead. The next event is revealed.',
    // Behaviour: HUD may reveal the next event while this is active.
    revealsNextEvent: true,
  },
  distrusted: {
    id: 'distrusted',
    name: 'Distrusted',
    description: 'Word spread about you. Social triumphs earn no bonus.',
    // Behaviour: suppresses the extra triumph reward on SOCIAL events.
    suppressesSocialTriumphBonus: true,
  },
  blessed: {
    id: 'blessed',
    name: 'Blessed',
    description: 'Fortune favours you. Your next triumph grants an extra reward, then fades.',
    // Behaviour: +1 triumph reward, then the status removes itself.
    bonusTriumphReward: 1,
    consumedByTriumph: true,
  },
});

export const STATUS_LIST = Object.freeze(Object.values(STATUSES));

export function getStatus(id) {
  return STATUSES[id] || null;
}
