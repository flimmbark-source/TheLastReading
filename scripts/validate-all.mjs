import './check-architecture.mjs';
import './validate-bridge.mjs';
import './validate-scoring-cases.mjs';
import './validate-modifier-cases.mjs';
import './validate-economy-cases.mjs';
import './validate-multiplayer.mjs';
import './validate-personas.mjs';
// Render harness runs last: it populates a jsdom window on globalThis.
import './validate-render.mjs';

console.log('All architecture validation checks passed.');
