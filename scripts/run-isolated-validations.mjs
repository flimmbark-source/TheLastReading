import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(here, 'validate-hint-settings.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-tutorial-controls.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-card-activation-fx.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-tutorial-placement.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-tutorial-ability-panel-step.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-pattern-hint-stack.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-card-detail-hold.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-ability-choice-layout.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-mp-ability-flow.mjs')], { stdio: 'inherit' });
