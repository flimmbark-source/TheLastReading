// Reusable empirical-verification harness for the app-wide CSS cascade-layer
// migration (see docs/css-cascade-layer-migration.md). Boots the real game,
// runs a caller-supplied probe against the current working tree, then
// git-stash-pushes the in-progress extraction, reloads, re-runs the same
// probe against that pre-extraction baseline, restores the stash, and diffs
// the two results. Replaces writing a new one-off Playwright script per file.
//
// Usage:
//   node scripts/cascade-probe.mjs <probe-module.mjs> -- <file1> [file2 ...]
//
// The probe module's default export is `async (page) => ({ ...jsonSafe })`.
// Files after `--` are the in-progress extraction's changed files (passed to
// `git stash push --`); omit `--` and the files to just run the probe once
// against the current tree with no baseline comparison.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const BASE_URL = `http://localhost:${PORT}`;

function parseArgs(argv) {
  const sepIndex = argv.indexOf('--');
  const probePath = sepIndex === -1 ? argv[0] : argv[0];
  const stashFiles = sepIndex === -1 ? [] : argv.slice(sepIndex + 1);
  if (!probePath) {
    console.error('Usage: node scripts/cascade-probe.mjs <probe-module.mjs> -- <file1> [file2 ...]');
    process.exit(2);
  }
  return { probePath, stashFiles };
}

function isServerUp() {
  return new Promise(resolveUp => {
    const req = http.get(`${BASE_URL}/game.html`, res => { res.resume(); resolveUp(res.statusCode === 200); });
    req.on('error', () => resolveUp(false));
    req.setTimeout(1000, () => { req.destroy(); resolveUp(false); });
  });
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

async function bootGame(page) {
  await page.goto(`${BASE_URL}/game.html`);
  await page.waitForSelector('#mainMenu', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.main-menu-btn')];
    const newGameBtn = btns.find(b => b.textContent.trim() === 'New Game');
    if (newGameBtn) newGameBtn.click();
  });
  await page.waitForTimeout(1200);
  await page.waitForSelector('#hand .card, .hand .card', { timeout: 10000 }).catch(() => {
    console.warn('[cascade-probe] warning: no hand card appeared after New Game');
  });
}

function deepDiff(a, b, path = '') {
  const diffs = [];
  if (a === b) return diffs;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    diffs.push(`${path || '(root)'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    return diffs;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    diffs.push(...deepDiff(a[key], b[key], path ? `${path}.${key}` : key));
  }
  return diffs;
}

async function main() {
  const { probePath, stashFiles } = parseArgs(process.argv.slice(2));
  const probeModule = await import(pathToFileURL(resolve(process.cwd(), probePath)).href);
  const probe = probeModule.default;
  if (typeof probe !== 'function') {
    console.error(`${probePath} must have a default export: async (page) => ({...})`);
    process.exit(2);
  }

  let serverProc = null;
  if (!(await isServerUp())) {
    const { spawn } = await import('node:child_process');
    serverProc = spawn('node', ['scripts/serve.mjs', String(PORT)], { cwd: repoRoot, stdio: 'ignore', detached: true });
    for (let i = 0; i < 20 && !(await isServerUp()); i++) await new Promise(r => setTimeout(r, 200));
  }

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let stashed = false;
  try {
    const page = await browser.newPage();
    await bootGame(page);
    const current = await probe(page);
    console.log('[cascade-probe] current tree:', JSON.stringify(current, null, 2));

    if (stashFiles.length === 0) {
      console.log('[cascade-probe] no baseline files given, single-run only.');
      return;
    }

    git(['stash', 'push', '--', ...stashFiles]);
    stashed = true;
    await bootGame(page);
    const baseline = await probe(page);
    console.log('[cascade-probe] baseline tree:', JSON.stringify(baseline, null, 2));

    const diffs = deepDiff(current, baseline);
    if (diffs.length === 0) {
      console.log('[cascade-probe] PASS: computed styles identical before/after extraction.');
    } else {
      console.log('[cascade-probe] FAIL: computed styles differ:');
      for (const d of diffs) console.log('  ' + d);
      process.exitCode = 1;
    }
  } finally {
    if (stashed) {
      git(['stash', 'pop']);
    }
    await browser.close();
    if (serverProc) {
      try { process.kill(-serverProc.pid); } catch { try { serverProc.kill(); } catch {} }
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
