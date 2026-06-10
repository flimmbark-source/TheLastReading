import { reducer } from '../game/reducer.mjs';
import { createGameState } from '../game/state.mjs';

export function createStore(initialState = createGameState(), rootReducer = reducer) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    dispatch(action) {
      const previous = state;
      state = rootReducer(state, action);
      if (state !== previous) {
        for (const listener of listeners) listener(state, previous, action);
      }
      return action;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
