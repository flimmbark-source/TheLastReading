export const SETS_PER_ROUND = 2;

export const CONSTELLATIONS = Object.freeze([]);

export const CONSTELLATION_BY_ID = Object.freeze({});

export function getConstellation(id) {
  return CONSTELLATION_BY_ID[id] || null;
}

export function constellationForRound(roundIndex = 0) {
  return null;
}
