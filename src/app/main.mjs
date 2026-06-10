// Application entry point (Phase 16). index.html is becoming a shell: this
// module mounts the architecture bridge, installs the UI modules as the
// globals the legacy markup/script still calls, and then boots the game.
import { installLiveMirror } from './liveMirror.mjs';
import * as abilitySystem from '../systems/abilities.mjs';
import * as shopSystem from '../systems/shop.mjs';
import * as cardRenderer from '../ui/renderCard.mjs';
import * as ghostRenderer from '../ui/renderGhost.mjs';
import * as hintRenderer from '../ui/renderHints.mjs';

export function startApp(target = window) {
  // Phase 15: the UI modules own the shared renderers. The legacy script and
  // markup still call them as globals, so install them on the target first.
  Object.assign(target, cardRenderer, ghostRenderer, hintRenderer);

  try {
    installLiveMirror(target);
    // Phase 10: the ability modal targets through the pure ability system.
    target.tlrAbilities = abilitySystem;
    // Phase 12: the market generates offers and costs through the shop system.
    target.tlrShop = shopSystem;
    // Phase 6: hand selection ownership to the reducer.
    target.tlrBindSelectionToStore();
    // Phase 14: seed archive save state from the live storage keys.
    try {
      target.tlrStore.dispatch({ type: target.tlrActions.SYNC_LEGACY_PERSIST, persist: {
        unlockedFragments: JSON.parse(target.localStorage.getItem('tlr_inv_unlocked') || '[]'),
        discoveredArchiveItems: JSON.parse(target.localStorage.getItem('tlr_attic_found_items') || '[]'),
      } });
    } catch (seedError) { /* corrupted local keys fall back to empty archive state */ }
    // Seed the store with the current legacy state so the mirror starts in sync.
    target.tlrSyncArchitectureToLiveSnapshot({ quiet: true });
    target.dispatchEvent(new Event('tlr-architecture-bridge-ready'));
  } catch (err) {
    console.warn('[TLR architecture] Live mirror failed to mount', err);
  }

  // Phase 16: boot the game. The legacy script defines tlrLegacyBoot() and a
  // fallback timer in case this module never runs (e.g. file://).
  if (!target.__tlrBooted && typeof target.tlrLegacyBoot === 'function') {
    target.__tlrBooted = true;
    clearTimeout(target.__tlrBootFallback);
    target.tlrLegacyBoot();
  }
}

if (typeof window !== 'undefined') startApp(window);
