import './check-architecture.mjs';
import './validate-bridge.mjs';
import './validate-scoring-cases.mjs';
import './validate-modifier-cases.mjs';
import './validate-economy-cases.mjs';
import './validate-market-rebalance.mjs';
import './validate-multiplayer.mjs';
import './validate-personas.mjs';
import './validate-table-view.mjs';
import './validate-purge-reducer.mjs';
import './validate-ability-targeting.mjs';
import './validate-ability-targeting-bridge.mjs';
import './validate-ability-choice-flow.mjs';
import './validate-action-card-drops.mjs';
import './validate-draw-animation.mjs';
import './validate-hints.mjs';
import './validate-adventure.mjs';
import './validate-adventure-single-card.mjs';
import './validate-adventure-isolation.mjs';
import './validate-card-detail-placement.mjs';
import './validate-upgrade-announcements.mjs';
// jsdom-based UI checks run last: they populate a jsdom window on globalThis.
import './validate-menu.mjs';
import './validate-render.mjs';
import './validate-adventure-ui.mjs';

// These checks install whole-window gesture/runtime state and leave DOM globals
// or observers behind, so run them as isolated child processes.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(here, 'validate-card-detail-hold.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-mp-ability-flow.mjs')], { stdio: 'inherit' });

console.log('All architecture validation checks passed.');
