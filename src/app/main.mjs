// Application entry point (Phase 16). index.html is becoming a shell: this
// module mounts the architecture bridge, installs the UI modules as the
// globals the legacy markup/script still calls, and then boots the game.
import { installLiveMirror } from './liveMirror.mjs';
import { installDataGlobals } from './dataGlobals.mjs';
import { installAtticFlow } from './atticFlow.mjs';
import { installHandSwipeScroll } from '../ui/gestureHand.mjs';
import { installHandCardGestures } from '../ui/gestureCard.mjs';
import { installGestureDrawers } from '../ui/gestureDrawers.mjs';
import * as abilitySystem from '../systems/abilities.mjs';
import * as shopSystem from '../systems/shop.mjs';
import * as scoringSystem from '../systems/scoring.mjs';
import * as hintsSystem from '../systems/hints.mjs';
import * as cardRenderer from '../ui/renderCard.mjs';
import * as ghostRenderer from '../ui/renderGhost.mjs';
import * as hintRenderer from '../ui/renderHints.mjs';
import * as abilityRenderer from '../ui/renderAbility.mjs';
import * as marketRenderer from '../ui/renderMarket.mjs';
import * as spreadRenderer from '../ui/renderSpread.mjs';
import * as handRenderer from '../ui/renderHand.mjs';
import * as tableRenderer from '../ui/renderTable.mjs';
import * as atticRenderer from '../ui/renderAttic.mjs';
import * as effectsModule from './effects.mjs';
import * as tutorialModule from './tutorial.mjs';
import * as readingFlowModule from './readingFlow.mjs';
import * as archivesModule from './archives.mjs';

export function startApp(target = window) {
  // Phase 15: the UI modules own the renderers. The legacy script and
  // markup still call them as globals, so install them on the target first.
  Object.assign(target, cardRenderer, ghostRenderer, hintRenderer, abilityRenderer, marketRenderer,
    spreadRenderer, handRenderer, tableRenderer, atticRenderer, effectsModule, tutorialModule,
    readingFlowModule, archivesModule);

  // Step 3e (16.4): attic visit orchestration is owned by src/app/atticFlow.mjs.
  installAtticFlow(target);

  // Step 4: gesture handlers are owned by src/ui gesture modules. Each installer
  // uses the legacy install flags, so it does not double-mount while the inline
  // copies remain during the migration.
  installHandSwipeScroll(target);
  installHandCardGestures(target);
  installGestureDrawers(target);

  // Step 1 (16.4): install data module exports under legacy global names so
  // gameplay functions resolve them without inline const declarations.
  installDataGlobals(target);

  try {
    installLiveMirror(target);
    // Phase 10: the ability modal targets through the pure ability system.
    target.tlrAbilities = abilitySystem;
    // Phase 12: the market generates offers and costs through the shop system.
    target.tlrShop = shopSystem;
    // Step 2 (16.4): hint detection and scoring engine available for display bridge.
    target.tlrHints = hintsSystem;
    target.tlrScoring = scoringSystem;
  } catch (err) {
    console.error('The Last Reading module boot failed', err);
  }
}

startApp();
