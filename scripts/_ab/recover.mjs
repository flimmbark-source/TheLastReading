// Reconstruct driver A's verified accepted/kept sets by diffing the working
// tree (which holds A's applied removals) against git HEAD, and write them
// into the B2 checkpoint format.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const ROOT = '/home/user/TheLastReading';
const DONE_FILES = [
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
];
function commentRanges(text) {
  const r = []; let i = 0;
  while ((i = text.indexOf('/*', i)) !== -1) { const e = text.indexOf('*/', i + 2); r.push([i, e === -1 ? text.length : e + 2]); if (e === -1) break; i = e + 2; }
  return r;
}
const accepted = {}, kept = {};
for (const rel of DONE_FILES) {
  const orig = execFileSync('git', ['-C', ROOT, 'show', `HEAD:${rel}`], { encoding: 'utf8' });
  const cur = readFileSync(join(ROOT, rel), 'utf8');
  const ranges = commentRanges(orig);
  const cands = [];
  for (const m of orig.matchAll(/\s*!\s*important/gi)) {
    if (ranges.some(([s, e]) => m.index + m[0].length - 1 >= s && m.index + m[0].length - 1 < e)) continue;
    cands.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  // Two-pointer: walk original and current; at each candidate, decide removed or not.
  let op = 0, cp = 0;
  const removed = [], keptIdx = [];
  cands.forEach((c, idx) => {
    const between = orig.slice(op, c.start);
    if (cur.slice(cp, cp + between.length) !== between) throw new Error(`desync in ${rel} at candidate ${idx}`);
    cp += between.length;
    if (cur.slice(cp, cp + c.text.length) === c.text) { keptIdx.push(idx); cp += c.text.length; }
    else removed.push(idx);
    op = c.end;
  });
  const tail = orig.slice(op);
  if (cur.slice(cp) !== tail) throw new Error(`tail desync in ${rel}`);
  accepted[rel] = removed; kept[rel] = keptIdx;
  console.log(`${rel}: removed ${removed.length}, kept ${keptIdx.length}`);
}
writeFileSync('/tmp/tlrB-scratch/checkpoint.json', JSON.stringify({ accepted, kept }));
let r = 0, k = 0;
for (const v of Object.values(accepted)) r += v.length;
for (const v of Object.values(kept)) k += v.length;
console.log(`checkpoint written: ${r} removed, ${k} kept`);
