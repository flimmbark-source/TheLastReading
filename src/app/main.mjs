// Application entry point (Phase 16). index.html is becoming a shell: this
// module mounts the architecture bridge, installs the UI modules as the
// globals the legacy markup/script still calls, and then boots the game.
import { installLiveMirror } from './liveMirror.mjs';
import { installDataGlobals } from './dataGlobals.mjs';
import { installRuntimeState } from './runtimeState.mjs';
import { installLegacyBridge } from './legacyBridge.mjs';
import { installDeckRuntime } from './deckRuntime.mjs';
import { installMarketFlow } from './marketFlow.mjs';
import { installControlBindings } from './controlBindings.mjs';
import { installAtticFlow } from './atticFlow.mjs';
import { installAudioControls } from './audio.mjs';
import { bootGame } from './boot.mjs';
import { installMenuControls } from './menuControls.mjs';
import { installResonationFlow } from './resonationFlow.mjs';
import { installHintRuntime } from './hintRuntime.mjs';
import { installAmbientEffects } from '../ui/ambientEffects.mjs';
import { installHandSwipeScroll } from '../ui/gestureHand.mjs';
import { installHandCardGestures } from '../ui/gestureCard.mjs';
import { installGestureDrawers } from '../ui/gestureDrawers.mjs';
import { installPressHighlight } from '../ui/gesturePressHighlight.mjs';
import { installHandSelectionVisuals } from '../ui/handSelectionVisuals.mjs';
import * as abilitySystem from '../systems/abilities.mjs';
import * as shopSystem from '../systems/shop.mjs';
import * as scoringSystem from '../systems/scoring.mjs';
import * as hintsSystem from '../systems/hints.mjs';
import * as resonationSystem from '../systems/resonations.mjs';
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
  target.requestAnimationFrame(()=>target.requestAnimationFrame(()=>document.body.classList.remove('tlr-loading')));

  Object.assign(target, cardRenderer, ghostRenderer, hintRenderer, abilityRenderer, marketRenderer,
    spreadRenderer, handRenderer, tableRenderer, atticRenderer, effectsModule, tutorialModule,
    readingFlowModule, archivesModule);

  installRuntimeState(target);
  installAtticFlow(target);

  installHandSwipeScroll(target);
  installHandCardGestures(target);
  installGestureDrawers(target);
  installPressHighlight(target);
  installHandSelectionVisuals(target);
  installAmbientEffects(target);
  installAudioControls(target);
  installMenuControls(target);

  installDataGlobals(target);
  installDeckRuntime(target);
  installLegacyBridge(target);
  installMarketFlow(target);
  installResonationFlow(target);
  installHintRuntime(target);
  installControlBindings(target);

  try {
    installLiveMirror(target);
    target.tlrAbilities = abilitySystem;
    target.tlrShop = shopSystem;
    target.tlrHints = hintsSystem;
    target.tlrScoring = scoringSystem;
    target.tlrResonationSystem = resonationSystem;
    bootGame(target);
  } catch (err) {
    console.error('The Last Reading module boot failed', err);
  }
}

startApp();
