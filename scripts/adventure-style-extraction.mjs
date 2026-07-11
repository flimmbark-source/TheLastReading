const FUNCTION_START = 'function ensureStyles(doc) {';
const ASSIGNMENT_START = '  style.textContent = `';
const FUNCTION_END = '\n  `;\n  doc.head.appendChild(style);\n}';

export const ADVENTURE_STYLE_OUTPUT = 'dist/adventure-mode-v3.css';
export const ADVENTURE_STYLE_HREF = '/dist/adventure-mode-v3.css';

function locate(source) {
  const functionStart = source.indexOf(FUNCTION_START);
  if (functionStart < 0) throw new Error('Adventure style extraction: ensureStyles() was not found.');

  const assignmentStart = source.indexOf(ASSIGNMENT_START, functionStart);
  if (assignmentStart < 0) throw new Error('Adventure style extraction: style.textContent template was not found.');

  const cssStart = assignmentStart + ASSIGNMENT_START.length;
  const functionEnd = source.indexOf(FUNCTION_END, cssStart);
  if (functionEnd < 0) throw new Error('Adventure style extraction: ensureStyles() closing marker was not found.');

  return {
    functionStart,
    cssStart,
    functionEnd,
    replaceEnd: functionEnd + FUNCTION_END.length,
  };
}

export function extractAdventureCss(source) {
  const range = locate(source);
  const css = source.slice(range.cssStart, range.functionEnd).trim();
  if (!css) throw new Error('Adventure style extraction: extracted CSS is empty.');
  if (css.includes('${')) {
    throw new Error('Adventure style extraction: dynamic template expressions are not supported.');
  }
  if (!css.includes('#advEventDeck') || !css.includes('#advHud') || !css.includes('.adv-reward')) {
    throw new Error('Adventure style extraction: expected core Adventure selectors are missing.');
  }
  return `${css}\n`;
}

export function externalizeAdventureStyles(source, href = ADVENTURE_STYLE_HREF) {
  const range = locate(source);
  // Extraction validates both content and the no-interpolation contract before
  // the source is transformed for esbuild.
  extractAdventureCss(source);
  const replacement = `function ensureStyles(doc) {\n  if (!doc) return;\n  const existing = doc.getElementById(STYLE_ID);\n  if (existing?.tagName === 'LINK') return;\n  existing?.remove();\n  const link = doc.createElement('link');\n  link.id = STYLE_ID;\n  link.rel = 'stylesheet';\n  link.href = '${href}';\n  doc.head.appendChild(link);\n}`;
  const transformed = source.slice(0, range.functionStart) + replacement + source.slice(range.replaceEnd);
  if (transformed.includes('style.textContent = `')) {
    throw new Error('Adventure style extraction: inline style assignment remained after transformation.');
  }
  return transformed;
}
