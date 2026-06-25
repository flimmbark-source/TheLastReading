// Adventure Mode persistence isolation guardrail.
//
// The architecture store autosaves persist on every change. This verifies the
// guard that stops Adventure Mode from ever writing the Score Mode save: while
// window.__tlrAdventureActive is set, no store change reaches savePersistState.

import assert from 'node:assert/strict';
import { createArchitectureRuntime } from '../src/app/bootstrap.mjs';
import { ACTIONS } from '../src/game/actions.mjs';

const writes = [];
const storage = {
  getItem: () => null,
  setItem: (key, value) => writes.push({ key, value }),
};

const runtime = createArchitectureRuntime({ storage, saveKey: 'tlr_save' });

// Score Mode: a state-changing dispatch autosaves.
globalThis.__tlrAdventureActive = false;
runtime.store.dispatch({ type: ACTIONS.SET_BUSY, busy: true });
const afterScoreWrite = writes.length;
assert.ok(afterScoreWrite >= 1, 'Score Mode changes are persisted');

// Adventure Mode: state changes must NOT touch the Score Mode save.
globalThis.__tlrAdventureActive = true;
runtime.store.dispatch({ type: ACTIONS.SET_BUSY, busy: false });
runtime.store.dispatch({ type: ACTIONS.SET_BUSY, busy: true });
assert.equal(writes.length, afterScoreWrite, 'Adventure Mode never writes the Score Mode save');

// Back in Score Mode: persistence resumes.
globalThis.__tlrAdventureActive = false;
runtime.store.dispatch({ type: ACTIONS.SET_BUSY, busy: false });
assert.ok(writes.length > afterScoreWrite, 'Score Mode persistence resumes after leaving Adventure');

delete globalThis.__tlrAdventureActive;
console.log('Adventure Mode isolation checks passed.');
