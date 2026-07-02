import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const html = readFileSync(join(repoRoot, 'game.html'), 'utf8');

const links = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g)]
  .map(match => match[1].replace(/\?.*$/, ''))
  .filter(href => href.startsWith('src/styles/'));

const args = new Set(process.argv.slice(2));
const json = args.has('--json');
const legacyOnly = !args.has('--all-layers');

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function currentLayer(css, index) {
  const before = css.slice(0, index);
  const opens = [...before.matchAll(/@layer\s+([\w.-]+)\s*\{/g)];
  if (!opens.length) return 'implicit';
  return opens.at(-1)[1];
}

function specificity(selector) {
  const noStrings = selector.replace(/:where\([^)]*\)/g, '');
  const ids = (noStrings.match(/#[\w-]+/g) || []).length;
  const classes = (noStrings.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g) || []).length;
  const elements = (noStrings
    .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?|[*>+~(),]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)).length;
  return [ids, classes, elements];
}

function specificityGte(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

function selectorTokens(selector) {
  return new Set((selector.match(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|\b[a-z][\w-]*\b/gi) || [])
    .map(token => token.toLowerCase())
    .filter(token => !['body','html'].includes(token)));
}

function mayOverlap(a, b) {
  const at = selectorTokens(a);
  const bt = selectorTokens(b);
  if (!at.size || !bt.size) return true;
  for (const token of at) if (bt.has(token)) return true;
  return false;
}

function parseDeclarations() {
  const out = [];
  let order = 0;
  for (const href of links) {
    const file = href;
    const full = join(repoRoot, href);
    let css;
    try { css = readFileSync(full, 'utf8'); } catch { continue; }
    const body = stripComments(css);
    for (const rule of body.matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim().replace(/\s+/g, ' ');
      if (!selector || selector.includes('@')) continue;
      const layer = currentLayer(css, rule.index ?? 0);
      if (legacyOnly && layer !== 'legacy') continue;
      const spec = specificity(selector);
      for (const decl of rule[2].split(';')) {
        const idx = decl.indexOf(':');
        if (idx === -1) continue;
        const property = decl.slice(0, idx).trim().toLowerCase();
        const rawValue = decl.slice(idx + 1).trim();
        if (!property || !rawValue) continue;
        const important = /!important\s*$/i.test(rawValue);
        const value = rawValue.replace(/!important\s*$/i, '').trim();
        out.push({ order: order++, file, selector, property, value, important, layer, specificity: spec });
      }
    }
  }
  return out;
}

const declarations = parseDeclarations();
const candidates = [];

for (let i = 0; i < declarations.length; i += 1) {
  const decl = declarations[i];
  const winner = declarations.slice(i + 1).find(other => other.layer === decl.layer
    && other.property === decl.property
    && other.important === decl.important
    && specificityGte(other.specificity, decl.specificity)
    && mayOverlap(decl.selector, other.selector));
  if (!winner) continue;
  candidates.push({
    kind: winner.value === decl.value ? 'identical-value duplicate' : 'same-layer later equal-or-higher specificity',
    candidate: decl,
    laterCompetitor: winner,
  });
}

if (json) {
  console.log(JSON.stringify(candidates, null, 2));
} else {
  console.log(`# CSS dead-declaration candidates\n`);
  console.log(`Scanned ${declarations.length} declarations from ${legacyOnly ? 'legacy-layer' : 'all'} stylesheets. Found ${candidates.length} candidates.\n`);
  for (const item of candidates.slice(0, 80)) {
    const c = item.candidate;
    const w = item.laterCompetitor;
    console.log(`- **${item.kind}**: \`${c.file}\` \`${c.selector}\` has \`${c.property}: ${c.value}${c.important ? ' !important' : ''}\`; later \`${w.file}\` \`${w.selector}\` has \`${w.property}: ${w.value}${w.important ? ' !important' : ''}\`.`);
  }
  if (candidates.length > 80) console.log(`\n_Showing first 80 candidates. Re-run with --json for full output._`);
}
