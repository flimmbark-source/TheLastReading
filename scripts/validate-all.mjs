import './check-architecture.mjs';
import './validate-bridge.mjs';
import './validate-scoring-cases.mjs';
import './validate-modifier-cases.mjs';
import './validate-economy-cases.mjs';
import './validate-multiplayer.mjs';
import './validate-personas.mjs';
import './validate-table-view.mjs';
// jsdom-based UI checks run last: they populate a jsdom window on globalThis.
import './validate-menu.mjs';
import './validate-render.mjs';

console.log('All architecture validation checks passed.');
