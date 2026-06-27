// Adventure Mode — developer debug panel + dev-mode gate.
//
// Adventure Mode runs on the real Single-Player table, so player-facing run
// state (Resolve, Statuses, the current event) is shown by the live chrome that
// adventureMode.mjs mounts. The only thing left here is the developer debug
// panel that surfaces the hidden interpretation values, gated behind dev mode
// so it can never appear in a production build.

import { MEANING_TAGS } from '../../data/adventure/interpretations.mjs';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

/**
 * Is the developer debug panel allowed to render? True only in local/dev
 * contexts — never on a deployed production host.
 */
export function isAdventureDebugEnabled(env = globalThis) {
  if (env?.__TLR_DEV__ === true) return true;
  const loc = env?.location;
  if (!loc) return false;
  if (/[?&]advdebug=1\b/.test(loc.search || '')) return true;
  const host = loc.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '';
}

/** Pure HTML for the debug panel listing every hidden meaning value. */
export function buildDebugPanelHtml({ meanings, outcome } = {}) {
  const rows = MEANING_TAGS.map(tag => {
    const value = meanings ? meanings[tag] || 0 : 0;
    const label = tag.charAt(0).toUpperCase() + tag.slice(1);
    return `    <div class="adv-debug__row"><span>${label}</span><span>${value}</span></div>`;
  }).join('\n');
  const dominant = outcome ? `<div class="adv-debug__outcome">→ outcome: ${escapeHtml(outcome.id)}</div>` : '';
  return [
    '<div class="adv-debug" data-dev-only="true">',
    '  <div class="adv-debug__title">Spread Meanings (dev)</div>',
    rows,
    `  ${dominant}`,
    '</div>',
  ].join('\n');
}
