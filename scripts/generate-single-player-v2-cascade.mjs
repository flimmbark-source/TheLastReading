import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const singlePlayerV2CascadeSources = [
  ['singlePlayerV2/tokens.css', 'tokens'],
  ['singlePlayerV2/base.css', 'base layout'],
  ['singlePlayerV2/compat.css', 'composition compatibility'],
  ['singlePlayerV2/components/spreadHints.css', 'component: spread hints and choice polish'],
  ['singlePlayerV2/desktop.css', 'desktop phone-column layout'],
  ['singlePlayerV2/components/relics.css', 'component: relic placement'],
  ['singlePlayerV2/assets.css', 'generated assets'],
  ['singlePlayerV2/layout.css', 'layout pass'],
  ['singlePlayerV2/mobile.css', 'mobile visual fixes'],
  ['singlePlayerV2/components/hand.css', 'component: hand gesture restore'],
  ['singlePlayerV2/components/spread.css', 'component: spread final placement'],
  ['singlePlayerV2/components/scoreHud.css', 'component: score HUD table pass'],
  ['singlePlayerV2/states.css', 'state correction pass'],
  ['singlePlayerV2/components/artIntegration.css', 'component: art integration'],
  ['singlePlayerV2/components/utilityIcons.css', 'component: utility icons'],
  ['singlePlayerV2/components/utilityButtons.css', 'component: utility button visibility'],
];

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const stylesDir = join(repoRoot, 'src', 'styles');
const outputPath = join(stylesDir, 'singlePlayerV2', 'index.css');

export function buildSinglePlayerV2Cascade() {
  const sections = [`/* AUTO-GENERATED FILE. Do not edit directly.

   Run \`node scripts/generate-single-player-v2-cascade.mjs\` after changing any
   source stylesheet listed below. The generated file is the only stylesheet
   game.html and the runtime installer should load for Single Player V2. It
   preserves the previous direct-link cascade order while making the active
   cascade traceable in one file. tokens/utilityIcons/utilityButtons/relics/
   hand/spreadHints own real cascade layers; the remaining sources here still
   live in the app-wide \`legacy\` layer declared in game.html (see that file's
   layer statement for why -- their !important declarations are load-bearing
   against other legacy-layer files elsewhere in the app in ways that aren't
   yet safe to split further without per-component visual verification). */
@layer spv2.tokens, spv2.base, spv2.components, spv2.mobile, spv2.states, spv2.compat;
`];

  for (const [fileName, label] of singlePlayerV2CascadeSources) {
    let css = readFileSync(join(stylesDir, fileName), 'utf8');
    sections.push(`\n/* === ${fileName}: ${label} === */\n${css.trimEnd()}\n`);
  }

  return sections.join('\n');
}

export function writeSinglePlayerV2Cascade() {
  writeFileSync(outputPath, buildSinglePlayerV2Cascade());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeSinglePlayerV2Cascade();
}
