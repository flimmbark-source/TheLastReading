// Adventure Mode — minimal HUD and developer debug panel.
//
// The HUD shows only player-facing run state (Resolve, Statuses, the current
// event, and its target/triumph scores). It MUST NOT surface hidden meanings.
//
// The debug panel renders the hidden meaning record and is gated behind
// development mode so it can never appear in a production build.

import { MEANING_TAGS } from '../../data/adventure/interpretations.mjs';
import { getStatus } from '../../data/adventure/statuses.mjs';

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

// --- Player-facing HUD -----------------------------------------------------

/** Pure HTML for the HUD. Hidden meanings never appear here by construction. */
export function buildHudHtml({ run, event } = {}) {
  if (!run) return '';
  const resolve = `${run.resolve} / ${run.maxResolve}`;
  const statuses = (run.statuses || [])
    .map(id => getStatus(id)?.name || id)
    .map(name => `<span class="adv-hud__status">${escapeHtml(name)}</span>`)
    .join('');
  const eventTitle = event ? escapeHtml(event.title) : '—';
  const target = event ? event.targetScore : '—';
  const triumph = event ? event.triumphScore : '—';

  return [
    '<div class="adv-hud">',
    `  <div class="adv-hud__resolve" title="Resolve">❤ Resolve: <strong>${escapeHtml(resolve)}</strong></div>`,
    `  <div class="adv-hud__statuses">${statuses || '<span class="adv-hud__status adv-hud__status--none">No statuses</span>'}</div>`,
    `  <div class="adv-hud__event">${eventTitle}</div>`,
    `  <div class="adv-hud__scores">Target <strong>${escapeHtml(target)}</strong> · Triumph <strong>${escapeHtml(triumph)}</strong></div>`,
    '</div>',
  ].join('\n');
}

export function mountAdventureHud(container, props, doc = globalThis.document) {
  if (!container || !doc) return;
  container.innerHTML = buildHudHtml(props);
}

// --- Developer debug panel -------------------------------------------------

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

/**
 * Mount the debug panel — a no-op (and explicit teardown) outside dev mode, so
 * it can never leak into production.
 */
export function mountAdventureDebugPanel(container, props, { env = globalThis, doc = globalThis.document } = {}) {
  if (!container) return false;
  if (!isAdventureDebugEnabled(env)) {
    container.innerHTML = '';
    return false;
  }
  if (doc) container.innerHTML = buildDebugPanelHtml(props);
  return true;
}
