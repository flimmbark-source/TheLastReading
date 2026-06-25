import { createStore } from './store.mjs';
import { loadPersistState, savePersistState } from './save.mjs';
import { ACTIONS } from '../game/actions.mjs';
import { createGameState } from '../game/state.mjs';
import * as selectors from '../game/selectors.mjs';

export function createArchitectureRuntime(options = {}) {
  const storage = options.storage || null;
  const persist = options.persist || loadPersistState(storage, options.saveKey);
  const initialState = createGameState({ persist });
  const store = createStore(initialState);

  if (storage && options.autosave !== false) {
    store.subscribe(state => {
      // Adventure Mode runs on a throwaway, fresh profile. Never let its store
      // changes overwrite the player's persisted Score Mode save.
      if (globalThis.__tlrAdventureActive) return;
      savePersistState(storage, state.persist, options.saveKey);
    });
  }

  return {
    store,
    actions: ACTIONS,
    selectors,
  };
}

export function installArchitectureBridge(target = globalThis, options = {}) {
  const runtime = createArchitectureRuntime({
    storage: target.localStorage,
    ...options,
  });

  target.tlrArchitecture = runtime;
  target.tlrStore = runtime.store;
  target.tlrActions = runtime.actions;
  target.tlrSelectors = runtime.selectors;

  return runtime;
}

export function uninstallArchitectureBridge(target = globalThis) {
  delete target.tlrArchitecture;
  delete target.tlrStore;
  delete target.tlrActions;
  delete target.tlrSelectors;
}

if (typeof window !== 'undefined' && window.__TLR_INSTALL_ARCHITECTURE_BRIDGE__) {
  installArchitectureBridge(window);
}
