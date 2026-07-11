import fs from 'node:fs';

const termsPath = 'src/ui/gameTerms.mjs';
const validationPath = 'scripts/validate-game-terms.mjs';

let terms = fs.readFileSync(termsPath, 'utf8');

const selectorNeedle = "const INTERACTIVE_SELECTOR = 'button,a,input,select,textarea,[role=\"button\"],[role=\"link\"]';\nconst SKIP_SELECTOR = [";
const selectorReplacement = `const INTERACTIVE_SELECTOR = 'button,a,input,select,textarea,[role="button"],[role="link"]';
const TITLE_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'legend',
  'caption',
  'th',
  'label',
  '[role="heading"]',
  '.spv2-label',
  '[class*="title"]',
  '[class*="heading"]',
  '[class*="header"]',
  '[class*="label"]',
].join(',');
const SKIP_SELECTOR = [`;
if (!terms.includes(selectorNeedle)) throw new Error('Could not locate game-term selectors');
terms = terms.replace(selectorNeedle, selectorReplacement);

const replaceNeedle = `function replaceTextNode(node, auto) {
  const text = node.nodeValue || '';
  if (!text || (!text.includes('[[') && !auto)) return false;
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP_SELECTOR)) return false;
`;
const replaceReplacement = `function plainTitleText(text) {
  return String(text).replace(/\\[\\[([a-z0-9_-]+)(?:\\|([^\\]]+))?\\]\\]/gi, (_match, id, label) => {
    return label || getGameTerm(id)?.label || id;
  });
}

function normalizeTitleSurfaces(root) {
  const surfaces = [];
  if (root?.nodeType === 1 && root.matches?.(TITLE_SELECTOR)) surfaces.push(root);
  root?.querySelectorAll?.(TITLE_SELECTOR).forEach(surface => surfaces.push(surface));

  for (const surface of surfaces) {
    surface.querySelectorAll('.game-term').forEach(term => {
      term.replaceWith(surface.ownerDocument.createTextNode(term.textContent || ''));
    });
    const doc = surface.ownerDocument;
    const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
    const walker = doc.createTreeWalker(surface, showText);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const plain = plainTitleText(node.nodeValue || '');
      if (plain !== node.nodeValue) node.nodeValue = plain;
    }
    if (surface.dataset.gameTerms !== 'off') surface.dataset.gameTerms = 'off';
  }
}

function replaceTextNode(node, auto) {
  const text = node.nodeValue || '';
  if (!text || (!text.includes('[[') && !auto)) return false;
  const parent = node.parentElement;
  if (!parent) return false;
  const titleSurface = parent.closest(TITLE_SELECTOR);
  if (titleSurface) {
    const plain = plainTitleText(text);
    if (plain !== text) node.nodeValue = plain;
    if (titleSurface.dataset.gameTerms !== 'off') titleSurface.dataset.gameTerms = 'off';
    return false;
  }
  if (parent.closest(SKIP_SELECTOR)) return false;
`;
if (!terms.includes(replaceNeedle)) throw new Error('Could not locate replaceTextNode');
terms = terms.replace(replaceNeedle, replaceReplacement);

const applyNeedle = `export function applyGameTerms(root, options = {}) {
  if (!root) return 0;
  const auto = options.auto ?? root.dataset?.gameTerms === 'auto';`;
const applyReplacement = `export function applyGameTerms(root, options = {}) {
  if (!root) return 0;
  normalizeTitleSurfaces(root);
  const auto = options.auto ?? root.dataset?.gameTerms === 'auto';`;
if (!terms.includes(applyNeedle)) throw new Error('Could not locate applyGameTerms');
terms = terms.replace(applyNeedle, applyReplacement);

fs.writeFileSync(termsPath, terms);

let validation = fs.readFileSync(validationPath, 'utf8');
const validationNeedle = `assert.match(archive.textContent, /\\[\\[chips\\]\\]/);
`;
const validationReplacement = `assert.match(archive.textContent, /\\[\\[chips\\]\\]/);

const titleDom = new JSDOM('<main><h2 id="heading">Threshold</h2><div id="resultTitle" class="result-title">[[score|Final Score]]</div><div id="hudLabel" class="spv2-label">Threshold</div><p id="explanation">Reach the Threshold to continue.</p></main>');
const titleRoot = titleDom.window.document.querySelector('main');
applyGameTerms(titleRoot, { auto: true });
assert.equal(titleDom.window.document.querySelector('#heading .game-term'), null, 'semantic headings stay plain');
assert.equal(titleDom.window.document.getElementById('heading').textContent, 'Threshold');
assert.equal(titleDom.window.document.querySelector('#resultTitle .game-term'), null, 'title classes stay plain');
assert.equal(titleDom.window.document.getElementById('resultTitle').textContent, 'Final Score', 'explicit title markup becomes normal text');
assert.equal(titleDom.window.document.querySelector('#hudLabel .game-term'), null, 'HUD labels stay plain');
assert.equal(titleDom.window.document.querySelectorAll('#explanation .game-term').length, 1, 'explanatory copy keeps term treatment');
const priorToken = titleDom.window.document.createElement('h3');
priorToken.innerHTML = '<span class="game-term" data-term-id="threshold">Threshold</span>';
titleRoot.appendChild(priorToken);
applyGameTerms(titleRoot, { auto: true });
assert.equal(priorToken.querySelector('.game-term'), null, 'existing title tokens are normalized back to text');
assert.equal(priorToken.textContent, 'Threshold');
`;
if (!validation.includes(validationNeedle)) throw new Error('Could not locate terminology validation insertion point');
validation = validation.replace(validationNeedle, validationReplacement);
fs.writeFileSync(validationPath, validation);
