import { ATTIC_OBJECTS, MIN_OBALS, OBAL_SCORE_LADDER } from '../data/atticObjects.mjs';

// Session score converts to obals (attic candles) on the live ladder.
export function obalsFromScore(score) {
  for (const [threshold, obals] of OBAL_SCORE_LADDER) {
    if (score >= threshold) return obals;
  }
  return MIN_OBALS;
}

export function atticObjectList() {
  return Object.values(ATTIC_OBJECTS);
}

export function getAtticObject(id) {
  return ATTIC_OBJECTS[id] || null;
}

// An object can be searched when it has not been searched this visit and its
// item has not already been found in a previous session.
export function canSearchAtticObject(objectId, searchedMap = {}, foundItemIds = []) {
  const object = getAtticObject(objectId);
  if (!object) return false;
  if (searchedMap[objectId]) return false;
  if (foundItemIds.includes(object.itemId)) return false;
  return true;
}

export function searchAtticObject(objectId, searchedMap = {}, foundItemIds = []) {
  if (!canSearchAtticObject(objectId, searchedMap, foundItemIds)) {
    return { searched: searchedMap, foundItemId: null };
  }
  return {
    searched: { ...searchedMap, [objectId]: true },
    foundItemId: getAtticObject(objectId).itemId,
  };
}
