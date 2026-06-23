import './check-architecture.mjs';
import './validate-bridge.mjs';
import './validate-scoring-cases.mjs';
import './validate-modifier-cases.mjs';
import './validate-economy-cases.mjs';
import './validate-multiplayer.mjs';
import './validate-personas.mjs';
import './validate-table-view.mjs';
import './validate-purge-reducer.mjs';
import './validate-ability-targeting.mjs';
import './validate-ability-targeting-bridge.mjs';
import './validate-ability-choice-flow.mjs';
import './validate-action-card-drops.mjs';
import './validate-hints.mjs';
import './validate-card-detail-placement.mjs';
// jsdom-based UI checks run last: they populate a jsdom window on globalThis.
import './validate-menu.mjs';
import './validate-render.mjs';

// The multiplayer ability-flow check installs the whole game and leaves a
// MutationObserver + jsdom timers running, so run it as an isolated child
// process. execFileSync throws on a non-zero exit, failing the suite.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(here, 'validate-mp-ability-flow.mjs')], { stdio: 'inherit' });

console.log('All architecture validation checks passed.');
