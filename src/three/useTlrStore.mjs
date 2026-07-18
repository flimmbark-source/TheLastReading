// React bridge onto the architecture store (src/app/store.mjs).
//
// window.tlrStore is the same observable store the reducer migration installed
// for the legacy bridge: getState() + subscribe(listener) -> unsubscribe. That
// contract is exactly what React 18+'s useSyncExternalStore consumes, so 3D
// components can select from live game state with no extra plumbing.
//
// Selectors must return primitives (or stable references) — the selector runs
// inside getSnapshot, so a selector that allocates a fresh object every call
// would render-loop.

import { useSyncExternalStore } from 'react';

const emptyStore = {
  subscribe() {
    return () => {};
  },
  getState() {
    return null;
  },
};

function storeOr(fallback) {
  const store = typeof window !== 'undefined' ? window.tlrStore : null;
  return store && typeof store.subscribe === 'function' && typeof store.getState === 'function' ? store : fallback;
}

export function useTlrStore(selector) {
  const store = storeOr(emptyStore);
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
