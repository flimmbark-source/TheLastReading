// Diff two capture files. Prints per-state diff counts and detailed diffs.
// Usage: node scripts/_ab/diff.mjs a.json b.json [--mask mask.json] [--write-mask mask.json] [--quiet]
import { readFileSync, writeFileSync } from 'node:fs';

const [aPath, bPath, ...rest] = process.argv.slice(2);
const a = JSON.parse(readFileSync(aPath, 'utf8'));
const b = JSON.parse(readFileSync(bPath, 'utf8'));
const maskIdx = rest.indexOf('--mask');
const mask = maskIdx >= 0 ? new Set(JSON.parse(readFileSync(rest[maskIdx + 1], 'utf8'))) : new Set();
const writeMaskIdx = rest.indexOf('--write-mask');
const quiet = rest.includes('--quiet');

const newMask = [];
let totalDiffs = 0;
const detail = [];

for (const state of Object.keys(a)) {
  if (!b[state]) { console.log(`STATE MISSING in B: ${state}`); totalDiffs += 1e6; continue; }
  const ea = a[state], eb = b[state];
  if (ea.length !== eb.length) {
    const key = `${state}|__length`;
    if (!mask.has(key)) { totalDiffs++; detail.push(`${state}: element count ${ea.length} vs ${eb.length}`); }
    newMask.push(key);
    continue; // element alignment broken; skip per-element compare
  }
  for (let i = 0; i < ea.length; i++) {
    const [ka, sa] = ea[i], [kb, sb] = eb[i];
    if (ka !== kb) {
      const key = `${state}|${i}|__key`;
      newMask.push(key);
      if (!mask.has(key)) { totalDiffs++; detail.push(`${state} #${i}: key "${ka}" vs "${kb}"`); }
      continue;
    }
    if (sa === sb) continue;
    const pa = sa.split(''), pb = sb.split('');
    for (let j = 0; j < Math.max(pa.length, pb.length); j++) {
      if (pa[j] === pb[j]) continue;
      const prop = (pa[j] || pb[j] || '').split('=')[0];
      const key = `${state}|${ka}|${prop}`;
      newMask.push(key);
      if (mask.has(key)) continue;
      totalDiffs++;
      if (detail.length < 400) detail.push(`${state} ${ka} :: ${pa[j] || '(missing)'}  ->  ${pb[j] || '(missing)'}`);
    }
  }
}

if (writeMaskIdx >= 0) {
  writeFileSync(rest[writeMaskIdx + 1], JSON.stringify([...new Set(newMask)]));
  console.log(`wrote mask with ${new Set(newMask).size} entries`);
}
if (!quiet) for (const d of detail) console.log(d);
console.log(`TOTAL_DIFFS=${totalDiffs}`);
