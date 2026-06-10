import { createInitialPersistState } from '../game/state.mjs';

export const SAVE_VERSION = 1;

export function serializePersistState(persist) {
  return JSON.stringify({
    version: SAVE_VERSION,
    persist,
  });
}

export function deserializePersistState(raw) {
  if (!raw) return createInitialPersistState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.persist) return createInitialPersistState();
    return createInitialPersistState(parsed.persist);
  } catch (_error) {
    return createInitialPersistState();
  }
}

export function loadPersistState(storage, key = 'tlr_save') {
  if (!storage) return createInitialPersistState();
  return deserializePersistState(storage.getItem(key));
}

export function savePersistState(storage, persist, key = 'tlr_save') {
  if (!storage) return;
  storage.setItem(key, serializePersistState(persist));
}
