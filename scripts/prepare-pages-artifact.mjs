import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { buildBundle } from './build-bundle.mjs';

const repoRoot = process.cwd();
// Named differently from build-bundle.mjs's own repoRoot/dist output (listed
// below as one of the entries to copy) -- this is the *site* staging
// directory, one level further out, so game.html's `dist/styles-core.css`
// etc. references still resolve correctly once this directory becomes the
// Pages deployment root.
const outputDir = path.join(repoRoot, 'pages-site');

const entries = [
  '_headers',
  'asset_manifest.json',
  'assets',
  'backgrounds',
  'dist',
  'fx',
  'game.html',
  'index.html',
  'props',
  'public',
  'src',
  'ui',
];

await buildBundle();
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const entry of entries) {
  const source = path.join(repoRoot, entry);
  try {
    await stat(source);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Cannot prepare Pages artifact: missing required path ${entry}`);
    }
    throw error;
  }

  await cp(source, path.join(outputDir, entry), {
    recursive: true,
    dereference: true,
    errorOnExist: false,
    force: true,
  });
}

console.log(`Prepared GitHub Pages artifact in ${path.relative(repoRoot, outputDir)}`);
