// Bundles game.html's CSS and JS into dist/ so the browser makes a handful
// of requests instead of ~110 separate ones. game.html references the
// stable paths written below directly, so this is the one place to update
// when a stylesheet or entry script is added/removed/renamed -- it does not
// scrape game.html for the list.
//
// JS keeps the app's existing lazy-load boundaries: menuBoot.mjs dynamically
// imports main.mjs (core game) and deferredAssets.mjs, and main.mjs
// dynamically imports an adventure-mode chunk and a multiplayer chunk. Those
// import() calls use string literals (not variables) specifically so
// esbuild's automatic code-splitting can discover and bundle each of those
// targets into its own chunk and rewrite the import() call to match --
// see src/app/menuBoot.mjs and src/app/main.mjs.
import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = join(root, 'dist');

const CSS_GROUPS = [
  {
    out: 'dist/styles-core.css',
    files: [
      'src/styles/base.css',
      'src/styles/spread.css',
      'src/styles/hand.css',
      'src/styles/cards.css',
      'src/styles/market.css',
      'src/styles/constellations.css',
      'src/styles/mobile.css',
      'src/styles/dragStability.css',
      'src/styles/handDragFix.css',
      'src/styles/attic.css',
      'src/styles/drawers.css',
      'src/styles/performance.css',
      'src/styles/mainMenu.css',
      'src/styles/premiumStore.css',
      'src/styles/loadout.css',
      'src/styles/matchmaking.css',
      'src/styles/mpGame.css',
      'src/styles/mpMobile.css',
      'src/styles/mpSpreadCards.css',
      'src/styles/mpFixes.css',
      'src/styles/mpMultMobile.css',
      'src/styles/assetLazy.css',
    ],
  },
  {
    // ps1aesthetic.css + the components/*.css cluster: kept separate from
    // the group above only because the two SPv2 <link id=...> tags sit
    // between them in game.html and are left alone (singlePlayerV2.mjs
    // manages those two by id/href at runtime). Cascade order itself
    // doesn't depend on this split -- game.html's master `@layer` statement
    // pre-declares layer precedence independent of file/link order -- this
    // grouping just avoids moving anything JS looks up by id.
    out: 'dist/styles-components.css',
    files: [
      'src/styles/ps1aesthetic.css',
      'src/styles/components/mpGameChrome.css',
      'src/styles/components/relicRack.css',
      'src/styles/components/handSwipeZone.css',
      'src/styles/components/tutTip.css',
      'src/styles/components/invWrap.css',
      'src/styles/components/invTab.css',
      'src/styles/components/titleWrap.css',
      'src/styles/components/atticFade.css',
    ],
  },
];

// The 3 <script type="module"> entries game.html loads directly.
const JS_ENTRY_POINTS = [
  'src/ui/flushBoundaryGuard.mjs',
  'src/app/mpModeClassGuard.mjs',
  'src/app/menuBoot.mjs',
];

function rewriteRelativeUrls(cssText, sourceRelPath) {
  const sourceDir = posix.dirname(sourceRelPath);
  return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, _quote, value) => {
    if (/^([a-z]+:)?\/\//i.test(value) || value.startsWith('/') || value.startsWith('data:')) return match;
    const resolved = posix.normalize(posix.join(sourceDir, value));
    return `url(/${resolved})`;
  });
}

async function buildCss() {
  for (const group of CSS_GROUPS) {
    const combined = group.files
      .map(relPath => {
        const text = readFileSync(join(root, relPath), 'utf8');
        return `/* ${relPath} */\n${rewriteRelativeUrls(text, relPath)}`;
      })
      .join('\n');
    const { code } = await esbuild.transform(combined, { loader: 'css', minify: true });
    writeFileSync(join(root, group.out), code);
    console.log(`[build-bundle] ${group.out}  (${group.files.length} files, ${code.length} bytes)`);
  }
}

async function buildJs() {
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: JS_ENTRY_POINTS,
    bundle: true,
    splitting: true,
    format: 'esm',
    outdir: 'dist/js',
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    minify: true,
    metafile: true,
    logLevel: 'warning',
  });
  const outputs = Object.keys(result.metafile.outputs).filter(f => !f.endsWith('.map'));
  const bytes = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0);
  console.log(`[build-bundle] dist/js  (${outputs.length} files from ${JS_ENTRY_POINTS.length} entry points, ${bytes} bytes)`);
}

export async function buildBundle() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  await buildCss();
  await buildJs();
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await buildBundle();
