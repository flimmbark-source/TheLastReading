import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dependencyMarker = resolve(root, 'node_modules', 'esbuild', 'package.json');

// Claude/preview containers and fresh clones do not retain node_modules. The
// actual server builds dist/ before listening, but it cannot even import the
// bundler when dependencies are absent. Make the public start command recover
// that one missing prerequisite instead of dying before it can print a useful
// URL. Existing installations skip this entirely.
if (!existsSync(dependencyMarker)) {
  console.log('[start] Dependencies are missing; running npm ci...');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['ci'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error('[start] Could not launch npm ci.', result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await import('./serve.mjs');
