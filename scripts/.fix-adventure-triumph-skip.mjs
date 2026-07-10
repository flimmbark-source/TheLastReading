import fs from 'node:fs';

const path = 'src/app/adventureModeV3.mjs';
const source = fs.readFileSync(path, 'utf8');
const before = "    const isTriumph = state.choose >= 2;";
const after = "    const isTriumph = Boolean(state.isTriumph);";
const count = source.split(before).length - 1;
if (count === 0) {
  if (source.includes(after)) process.exit(0);
  throw new Error('Adventure triumph-state target was not found.');
}
if (count !== 1) throw new Error(`Expected one triumph-state target, found ${count}.`);
fs.writeFileSync(path, source.replace(before, after));
