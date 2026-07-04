import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(here, 'validate-card-detail-hold.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-mp-ability-flow.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(here, 'validate-mp-hand-return.mjs')], { stdio: 'inherit' });
