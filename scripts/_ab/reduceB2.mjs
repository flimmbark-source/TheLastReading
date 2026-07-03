// Parallel driver B: verifies !important removals for the non-SPv2 back half
// of the file queue against a pristine repo copy served on :8081, while
// driver A continues the SPv2 partials on :8080. Writes a checkpoint after
// every file so results survive interruption. Group-batches small files.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const MAIN = '/home/user/TheLastReading';
const COPY = '/tmp/tlrB';
const SCRATCH = '/tmp/tlrB-scratch';
const PORT = '8081';
execFileSync('mkdir', ['-p', SCRATCH]);
const MASK = new Set(JSON.parse(readFileSync(
  '/tmp/claude-0/-home-user-TheLastReading/e9f0f13a-ead6-5430-be53-94a769ad0de7/scratchpad/mask.json', 'utf8')));
const GENERATE = join(COPY, 'scripts/generate-single-player-v2-cascade.mjs');
const CHECKPOINT = join(SCRATCH, 'checkpoint.json');

// actionDropTargets.css, assetLazy.css, handDragFix.css, and dragStability.css
// are excluded by design: their header comments (and the budget validator's
// notes) document importance-dominance as the intended mechanism — the whole
// file exists to outrank other layers' importants.
const FILES = [
  // SPv2 partials: 12 already verified via the recovered checkpoint (skipped
  // by fileDone); relics/assets/utilityButtons still need processing.
  'src/styles/singlePlayerV2/desktop.css',
  'src/styles/singlePlayerV2/mobile.css',
  'src/styles/singlePlayerV2/compat.css',
  'src/styles/singlePlayerV2/components/spread.css',
  'src/styles/singlePlayerV2/components/artIntegration.css',
  'src/styles/singlePlayerV2/components/hand.css',
  'src/styles/singlePlayerV2/components/scoreHud.css',
  'src/styles/singlePlayerV2/states.css',
  'src/styles/singlePlayerV2/components/spreadHints.css',
  'src/styles/singlePlayerV2/layout.css',
  'src/styles/singlePlayerV2/components/utilityIcons.css',
  'src/styles/singlePlayerV2/base.css',
  'src/styles/singlePlayerV2/components/relics.css',
  'src/styles/singlePlayerV2/assets.css',
  'src/styles/singlePlayerV2/components/utilityButtons.css',
  'src/styles/mpFixes.css',
  'src/styles/mpMobile.css',
  'src/styles/mpGame.css',
  'src/styles/drawers.css',
  'src/styles/mobile.css',
  'src/styles/ps1aesthetic.css',
  'src/styles/components/relicRack.css',
  'src/styles/mpSpreadCards.css',
  'src/styles/components/mpGameChrome.css',
  'src/styles/components/handSwipeZone.css',
  'src/styles/attic.css',
  'src/styles/performance.css',
  'src/styles/market.css',
  'src/styles/drawAnimation.css',
  'src/styles/components/invWrap.css',
  'src/styles/mpMultMobile.css',
  'src/styles/components/titleWrap.css',
  'src/styles/components/atticFade.css',
  'src/styles/matchmaking.css',
  'src/styles/mainMenu.css',
  'src/styles/base.css',
  'src/styles/hand.css',
  'src/styles/components/tutTip.css',
  'src/styles/components/invTab.css',
];

function commentRanges(text) {
  const ranges = [];
  let i = 0;
  while ((i = text.indexOf('/*', i)) !== -1) {
    const end = text.indexOf('*/', i + 2);
    ranges.push([i, end === -1 ? text.length : end + 2]);
    if (end === -1) break;
    i = end + 2;
  }
  return ranges;
}
function inComment(ranges, pos) { return ranges.some(([s, e]) => pos >= s && pos < e); }

// Originals come from git HEAD — the copy's files are mutated by whichever
// driver ran last, so they cannot be trusted as the enumeration source.
// Candidate indexing must stay identical to driver B's original enumeration
// for the checkpoint's indexes to remain valid (same regex, same source text).
const originals = new Map();
const candidates = new Map();
function declProperty(text, start) {
  // Walk back from the "!important" token to the property name of its declaration.
  let i = start;
  while (i > 0 && !';{}'.includes(text[i - 1])) i--;
  const m = text.slice(i, start).match(/((?:--)?[a-zA-Z][a-zA-Z0-9-]*)\s*:/);
  return m ? m[1].toLowerCase() : null;
}
for (const rel of FILES) {
  const text = execFileSync('git', ['-C', MAIN, 'show', `3f652057b739dbb1572877ac5363f01c147f51aa:${rel}`], { encoding: 'utf8' });
  originals.set(rel, text);
  const ranges = commentRanges(text);
  const list = [];
  for (const m of text.matchAll(/\s*!\s*important/gi)) {
    if (inComment(ranges, m.index + m[0].length - 1)) continue;
    list.push({ start: m.index, end: m.index + m[0].length, prop: declProperty(text, m.index) });
  }
  candidates.set(rel, list);
}
let totalCandidates = 0;
for (const [, l] of candidates) totalCandidates += l.length;
console.log(`B candidates: ${totalCandidates} across ${candidates.size} files`);

function applyState(removals) {
  for (const [rel, text] of originals) {
    const rm = removals.get(rel);
    if (!rm || !rm.size) { writeFileSync(join(COPY, rel), text); continue; }
    const list = candidates.get(rel);
    let out = '', pos = 0;
    list.forEach((r, i) => {
      if (!rm.has(i)) return;
      out += text.slice(pos, r.start);
      pos = r.end;
    });
    out += text.slice(pos);
    writeFileSync(join(COPY, rel), out);
  }
  execFileSync(process.execPath, [GENERATE], { stdio: 'ignore' });
}

const IGNORES = [
  { el: /#(invTab|menuPullTab|scoringPullTab|abilitiesPullTab)\b/, prop: /^(left|right|inset)$/ },
  { el: /#mpTurnBadge/, prop: /^opacity$/ },
];
function ignored(elKey, prop) { return IGNORES.some(r => r.el.test(elKey) && r.prop.test(prop)); }
const NUM_RE = /-?\d+(?:\.\d+)?/g;
function valuesEquivalent(a, b) {
  if (a === b) return true;
  const na = a.match(NUM_RE), nb = b.match(NUM_RE);
  if (!na || !nb || na.length !== nb.length) return false;
  if (a.replace(NUM_RE, '#') !== b.replace(NUM_RE, '#')) return false;
  for (let i = 0; i < na.length; i++) if (Math.abs(parseFloat(na[i]) - parseFloat(nb[i])) > 0.1) return false;
  return true;
}

let runCounter = 0;
function capture(outPath) {
  execFileSync(process.execPath, [join(MAIN, 'scripts/_ab/capture.mjs'), outPath],
    { stdio: ['ignore', 'ignore', 'ignore'], env: { ...process.env, TLR_PORT: PORT } });
}
let BASE = null;
function runDiff(label) {
  runCounter += 1;
  const out = join(SCRATCH, 'run.json');
  capture(out);
  const b = JSON.parse(readFileSync(out, 'utf8'));
  let diffs = 0;
  const detail = [];
  const diffProps = new Set();
  for (const state of Object.keys(BASE)) {
    if (!b[state]) { diffs += 1e6; continue; }
    const ea = BASE[state], eb = b[state];
    if (ea.length !== eb.length) {
      if (!MASK.has(`${state}|__length`)) { diffs++; detail.push(`${state}: count ${ea.length} vs ${eb.length}`); }
      continue;
    }
    for (let i = 0; i < ea.length; i++) {
      const [ka, sa] = ea[i], [kb, sb] = eb[i];
      if (ka !== kb) { if (!MASK.has(`${state}|${i}|__key`)) { diffs++; if (detail.length < 8) detail.push(`${state} #${i} key`); } continue; }
      if (sa === sb) continue;
      const pa = sa.split(''), pb = sb.split('');
      for (let j = 0; j < Math.max(pa.length, pb.length); j++) {
        if (pa[j] === pb[j]) continue;
        const prop = (pa[j] || pb[j] || '').split('=')[0];
        if (MASK.has(`${state}|${ka}|${prop}`)) continue;
        if (ignored(ka, prop)) continue;
        if (pa[j] !== undefined && pb[j] !== undefined && valuesEquivalent(pa[j], pb[j])) continue;
        diffs++;
        diffProps.add(prop.replace(/^::(before|after)/, '').toLowerCase());
        if (detail.length < 8) detail.push(`${state} ${ka} :: ${(pa[j]||'').slice(0,90)} -> ${(pb[j]||'').slice(0,90)}`);
      }
    }
  }
  console.log(`[B run ${runCounter}] ${label}: ${diffs} diffs${detail.length ? '\n    ' + detail.join('\n    ') : ''}`);
  return { diffs, props: diffProps };
}

// Does a declaration's property plausibly explain a diffed computed property?
// Covers shorthand expansion in both directions plus the physical/logical
// aliases getComputedStyle reports.
const PROP_ALIASES = {
  inset: ['top', 'right', 'bottom', 'left'],
  gap: ['row-gap', 'column-gap'],
  overflow: ['overflow-x', 'overflow-y'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  translate: ['transform'], rotate: ['transform'], scale: ['transform'],
};
function propExplains(declProp, diffProp) {
  if (!declProp) return true; // unknown property: always suspect (sound fallback)
  if (declProp === diffProp) return true;
  if (diffProp.startsWith(declProp + '-')) return true;
  if (declProp.startsWith(diffProp + '-')) return true;
  const aliases = PROP_ALIASES[declProp];
  if (aliases && aliases.some(a => diffProp === a || diffProp.startsWith(a + '-'))) return true;
  // any diffed prop can be a layout side-effect of display/position/content changes
  if (['display', 'position', 'content', 'all'].includes(declProp)) return true;
  return false;
}

// ── Baseline (reuse driver B's if present — same pristine state, same port) ──
const basePath = join(SCRATCH, 'baseline.json');
if (!existsSync(basePath)) {
  applyState(new Map());
  capture(basePath);
  console.log('B2 baseline captured');
} else {
  console.log('B2 reusing existing baseline');
}
BASE = JSON.parse(readFileSync(basePath, 'utf8'));

// ── Pair-based bisection with file grouping ──
const accepted = new Map();
const keptImportant = new Map();
let checkpointReady = false;
function addPairs(map, pairs) {
  for (const [rel, i] of pairs) {
    if (!map.has(rel)) map.set(rel, new Set());
    map.get(rel).add(i);
  }
  // Persist after every accepted/kept decision — a container restart mid-file
  // must never cost more than one verification run again.
  if (checkpointReady) checkpoint();
}
function mergedWith(pairs) {
  const merged = new Map();
  for (const [rel, s] of accepted) merged.set(rel, new Set(s));
  for (const [rel, i] of pairs) { if (!merged.has(rel)) merged.set(rel, new Set()); merged.get(rel).add(i); }
  return merged;
}
function testPairs(pairs, label) {
  applyState(mergedWith(pairs));
  return runDiff(label);
}
function bisect(pairs, label) {
  if (!pairs.length) return;
  const result = testPairs(pairs, `${label} [${pairs.length} decls]`);
  if (result.diffs === 0) { addPairs(accepted, pairs); return; }
  if (pairs.length === 1) { addPairs(keptImportant, pairs); return; }
  // Diff-guided split: declarations whose property explains a diffed computed
  // property are the suspects; the rest usually pass as one clean batch.
  // Correctness never depends on the attribution — every acceptance still
  // requires its own zero-diff run — it only steers the splitting.
  const suspects = pairs.filter(([rel, i]) => [...result.props].some(p => propExplains(candidates.get(rel)[i].prop, p)));
  if (suspects.length && suspects.length < pairs.length) {
    const suspectSet = new Set(suspects.map(([rel, i]) => rel + '#' + i));
    const rest = pairs.filter(([rel, i]) => !suspectSet.has(rel + '#' + i));
    bisect(rest, label + '/rest');
    bisect(suspects, label + '/sus');
    return;
  }
  const mid = Math.floor(pairs.length / 2);
  bisect(pairs.slice(0, mid), label + '/l');
  bisect(pairs.slice(mid), label + '/r');
}
function checkpoint() {
  const dump = m => Object.fromEntries([...m].map(([k, v]) => [k, [...v]]));
  writeFileSync(CHECKPOINT, JSON.stringify({ accepted: dump(accepted), kept: dump(keptImportant) }));
}

// Resume from driver B's checkpoint: indexes are compatible because both
// drivers enumerate candidates from the identical git-HEAD text.
if (existsSync(CHECKPOINT)) {
  const cp = JSON.parse(readFileSync(CHECKPOINT, 'utf8'));
  for (const [rel, idxs] of Object.entries(cp.accepted || {})) addPairs(accepted, idxs.map(i => [rel, i]));
  for (const [rel, idxs] of Object.entries(cp.kept || {})) addPairs(keptImportant, idxs.map(i => [rel, i]));
  let resumed = 0;
  for (const [, s] of accepted) resumed += s.size;
  console.log(`B2 resumed from checkpoint: ${resumed} removals already verified`);
}
checkpointReady = true;
function fileDone(rel) {
  const n = candidates.get(rel)?.length ?? 0;
  return n > 0 && ((accepted.get(rel)?.size ?? 0) + (keptImportant.get(rel)?.size ?? 0)) >= n;
}

// Group files into batches of ~60 candidates; bisection descends into
// files and then declarations only when a group is dirty.
const t0 = Date.now();
let group = [];
let groupSize = 0;
const flushGroup = () => {
  if (!group.length) return;
  const pairs = group.flatMap(rel => candidates.get(rel).map((_, i) => [rel, i]));
  bisect(pairs, group.map(g => g.split('/').pop()).join('+'));
  checkpoint();
  console.log(`== B group done: ${group.join(', ')} (elapsed ${((Date.now()-t0)/60000).toFixed(1)}min)`);
  group = []; groupSize = 0;
};
for (const rel of FILES) {
  const n = candidates.get(rel)?.length ?? 0;
  if (!n || fileDone(rel)) continue;
  if (groupSize + n > 60) flushGroup();
  group.push(rel); groupSize += n;
}
flushGroup();

// Final combined verification for B's own set.
applyState(mergedWith([]));
const finalDiffs = runDiff('B FINAL combined').diffs;
checkpoint();
if (finalDiffs !== 0) { console.log('B FINAL VERIFY FAILED'); process.exit(2); }

let removedTotal = 0, keptTotal = 0;
for (const [rel, s] of accepted) removedTotal += s.size;
for (const [rel, s] of keptImportant) keptTotal += s.size;
console.log(`B DONE: removed ${removedTotal}, kept ${keptTotal}, of ${totalCandidates}. Checkpoint at ${CHECKPOINT}`);
