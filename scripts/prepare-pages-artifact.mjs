import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'dist');

const entries = [
  '_headers',
  'asset_manifest.json',
  'assets',
  'backgrounds',
  'fx',
  'game.html',
  'index.html',
  'props',
  'public',
  'src',
  'ui',
];

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
