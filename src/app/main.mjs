// Application entry point (Phase 16). index.html is becoming a shell: this
// module mounts the architecture bridge, installs the UI modules as the
// globals the legacy markup/script still calls, and then boots the game.
import { bootGame } from './boot.mjs';
import { installArchitectureBridge } from './bootstrap.mjs';
import { installDataGlobals } from './dataGlobals.mjs';
import { installRuntimeState } from './runtimeState.mjs';
import { installLegacyBridge } from './legacyBridge.mjs';
import { installDeckRuntime } from './deckRuntime.mjs';
import { installMarketFlow } from './marketFlow.mjs';
import { installShopOverlayFlow } from './shopOverlayFlow.mjs';
import { installRelicFlow } from './relicFlow.mjs';
import { installShopPolish } from './shopPolish.mjs';
import { installReferenceControls } from './referenceControls.mjs';
import { installControlBindings } from './controlBindings.mjs';
import { installScoringRuntime } from './scoringRuntime.mjs';
import { installPlacementRuntime } from './placementRuntime.mjs';
import { installDiscardRuntime } from './discardRuntime.mjs';
import { installAbilityTargetBridge } from './abilityTargetBridge.mjs';
import { installSpreadPlacementBridge } from './spreadPlacementBridge.mjs';
import { installAtticFlow } from './atticFlow.mjs';
import { installAudioControls } from './audio.mjs';
import { installMainMenu } from './mainMenu.mjs';
import { installLoadoutScreen } from './loadoutScreen.mjs';
import { installMatchmakingScreen } from './matchmakingScreen.mjs';
import { installMpGame } from './mpGameHost.mjs';
import { installMpCpuSafety } from './mpCpuSafety.mjs';
import { installMpAbilitySurfaceCleanup } from './mpAbilitySurfaceCleanup.mjs';
import { installMenuControls } from './menuControls.mjs';
import { installResonationFlow } from './resonationFlow.mjs';
import { installHintRuntime } from './hintRuntime.mjs';
import { installAmbientEffects } from '../ui/ambientEffects.mjs';
import { installHandSwipeScroll } from '../ui/gestureHand.mjs';
import { installHandCardGestures } from '../ui/gestureCard.mjs';
import { installCardDetailGestures } from '../ui/cardDetailGestures.mjs';
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
import * as tutorialModule from './tutorialCore.mjs';
import * as readingFlowModule from './readingFlow.mjs';
import * as archivesModule from './archives.mjs';

function installStoreFrontTuning(target = window) {
  const doc = target.document;
  if (!doc || doc.getElementById('store-front-tuning-style')) return;

  const style = doc.createElement('style');
  style.id = 'store-front-style';
  style.textContent = `
    #summary.modal.show:has(.store-front-shell){background:transparent!important}
    #tutTip{z-index:2147483000!important}
    .store-front .store-offer-row .store-pack-offer:first-child{transform:translateX(-2.4%)!important}
    .store-front .store-offer-row .store-pack-offer:first-child:hover{transform:translateX(-2.4%) translateY(-1px)!important}
    .store-front .store-relic-row{left:10.6%!important;right:9.9%!important}
    .store-front .store-relic-row .store-relic-offer:first-child{transform:translateX(-3.2%)!important}
    .store-front .store-relic-row .store-relic-offer:last-child{transform:translateX(3.2%)!important}
    .store-front .store-relic-row .store-relic-offer:first-child:hover{transform:translateX(-3.2%) translateY(-1px)!important}
    .store-front .store-relic-row .store-relic-offer:last-child:hover{transform:translateX(3.2%) translateY(-1px)!important}
    @media(max-width:640px){.store-front .store-offer-row .store-pack-offer:first-child{transform:translateX(-1.8%)!important}.store-front .store-offer-row .store-pack-offer:first-child:hover{transform:translateX(-1.8%) translateY(-1px)!important}.store-front .store-relic-row{left:9.8%!important;right:8.8%!important}.store-front .store-relic-row .store-relic-offer:first-child{transform:translateX(-2.6%)!important}.store-front .store-relic-row .store-relic-offer:last-child{transform:translateX(2.6%)!important}.store-front .store-relic-row .store-relic-offer:first-child:hover{transform:translateX(-2.6%) translateY(-1px)!important}.store-front .store-relic-row .store-relic-offer:last-child:hover{transform:translateX(2.6%) translateY(-1px)!important}}
  `;
  doc.head.appendChild(style);

  const placeStoreCallout = (callout, anchor) => {
    doc.body.appendChild(callout);
    const rect = anchor.getBoundingClientRect();
    callout.style.top = `${rect.bottom + 6}px`;
    callout.style.left = '0px';
    target.requestAnimationFrame(() => {
      const cw = callout.offsetWidth;
      const ch = callout.offsetHeight;
      const mg = 8;
      let left = rect.left + rect.width / 2 - cw / 2;
      left = Math.max(mg, Math.min(target.innerWidth - cw - mg, left));
      let top = rect.bottom + 6;
      if (top + ch > target.innerHeight - mg) top = Math.max(mg, rect.top - ch - 6);
      callout.style.left = `${left}px`;
      callout.style.top = `${top}px`;
    });
  };

  const showVesselCallout = anchor => {
    doc.querySelectorAll('.relic-callout,.store-relic-callout').forEach(el => el.remove());
    const vesselLevel = (target.persist?.up || {}).relicSlot || 0;
    const maxed = vesselLevel >= 2;
    const callout = doc.createElement('div');
    callout.className = 'relic-callout store-relic-callout';
    callout.innerHTML = `<div class="relic-callout-name"><span style="display:inline-block;width:24px;height:24px;vertical-align:middle;text-align:center;font:800 23px/24px Georgia,serif;color:#f1d196;text-shadow:0 2px 5px #000">＋</span> Relic Vessel</div><div class="relic-callout-desc">${maxed ? 'Relic Slots maxed.' : 'Gain +1 Relic Slot. Max 5.'}</div>`;
    placeStoreCallout(callout, anchor);
  };

  doc.addEventListener('pointerdown', event => {
    const storeOpen = doc.querySelector('.store-front-shell');
    if (!storeOpen) return;

    const vesselIcon = event.target.closest?.('.store-relic-offer.vessel .store-relic-art');
    if (vesselIcon) {
      showVesselCallout(vesselIcon);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const callout = doc.querySelector('.relic-callout,.store-relic-callout,.store-pack-callout');
    if (!callout) return;
    if (callout.contains(event.target)) return;
    callout.remove();
    if (!event.target.closest('button,a,[role="button"]')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

function installMarketTutorialTrigger(target = window) {
  const doc = target.document;
  if (!doc || target.__marketTutorialTriggerInstalled) return;
  target.__marketTutorialTriggerInstalled = true;
  let wasOpen = false;
  let marketReadyPromise = null;

  const afterPaint = () => new Promise(resolve => {
    target.requestAnimationFrame(() => target.requestAnimationFrame(resolve));
  });

  const preloadStoreFrontArt = () => new Promise(resolve => {
    const ImageCtor = target.Image || Image;
    const img = new ImageCtor();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(true);
    };
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().catch(() => {}).then(done);
      else done();
    };
    img.onerror = done;
    img.src = './Store_Front.png';
    if (img.complete) {
      if (typeof img.decode === 'function') img.decode().catch(() => {}).then(done);
      else done();
    }
    target.setTimeout(done, 1200);
  });

  const waitForMarketIntro = () => {
    if (!doc.querySelector('.store-front-shell .store-front')) return Promise.resolve(false);
    if (!marketReadyPromise) {
      marketReadyPromise = new Promise(resolve => {
        let settled = false;
        let observer = null;
        let fallback = null;

        const done = () => {
          if (settled) return;
          settled = true;
          if (observer) observer.disconnect();
          if (fallback) target.clearTimeout(fallback);
          afterPaint().then(() => resolve(true));
        };

        const ready = () => {
          const front = doc.getElementById('storeFront') || doc.querySelector('.store-front-shell .store-front');
          const candle = doc.getElementById('storeCandle');
          return !!front && front.classList.contains('store-visible') && (!candle || candle.classList.contains('lit'));
        };

        const waitForVisibleTransition = () => {
          const front = doc.getElementById('storeFront') || doc.querySelector('.store-front-shell .store-front');
          if (!front) return done();
          if (ready()) {
            const transitionMs = target.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 280;
            target.setTimeout(done, transitionMs);
          }
        };

        preloadStoreFrontArt().then(() => {
          if (target.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            done();
            return;
          }
          if (ready()) {
            waitForVisibleTransition();
            return;
          }

          observer = new MutationObserver(waitForVisibleTransition);
          const shell = doc.querySelector('.store-front-shell');
          if (shell) observer.observe(shell, { attributes: true, subtree: true, attributeFilter: ['class'] });
          fallback = target.setTimeout(done, 1100);
          waitForVisibleTransition();
        });
      });
    }
    return marketReadyPromise;
  };

  const check = () => {
    const isOpen = !!doc.querySelector('.store-front-shell .store-front');
    if (isOpen && !wasOpen && typeof target.maybeShowMarketTutorial === 'function') {
      waitForMarketIntro().then(() => {
        if (doc.querySelector('.store-front-shell .store-front')) target.maybeShowMarketTutorial();
      });
    }
    if (!isOpen) marketReadyPromise = null;
    wasOpen = isOpen;
  };
  new MutationObserver(check).observe(doc.body, { childList: true, subtree: true });
}

export function startApp(target = window) {
  target.requestAnimationFrame(()=>target.requestAnimationFrame(()=>document.body.classList.remove('tlr-loading')));

  Object.assign(target, cardRenderer, ghostRenderer, hintRenderer, abilityRenderer, marketRenderer,
    spreadRenderer, handRenderer, tableRenderer, atticRenderer, effectsModule, tutorialModule,
    readingFlowModule, archivesModule);

  installRuntimeState(target);
  installArchitectureBridge(target);
  installAtticFlow(target);

  installHandSwipeScroll(target);
  installHandCardGestures(target);
  installCardDetailGestures(target);
  installGestureDrawers(target);
  installPressHighlight(target);
  installHandSelectionVisuals(target);
  installAmbientEffects(target);
  installAudioControls(target);
  installMenuControls(target);
  installMainMenu(target);
  installLoadoutScreen(target);
  installMatchmakingScreen(target);
  installMpGame(target);
  installMpCpuSafety(target);
  installMpAbilitySurfaceCleanup(target);
  installStoreFrontTuning(target);
  installMarketTutorialTrigger(target);

  installDataGlobals(target);
  target.tlrAbilities = abilitySystem;
  target.tlrShop = shopSystem;
  target.tlrHints = hintsSystem;
  target.tlrScoring = scoringSystem;
  target.tlrResonationSystem = resonationSystem;
  installScoringRuntime(target);
  installDeckRuntime(target);
  installLegacyBridge(target);
  installMarketFlow(target);
  installShopOverlayFlow(target);
  installRelicFlow(target);
  installShopPolish(target);
  installResonationFlow(target);
  installReferenceControls(target);
  installHintRuntime(target);
  installPlacementRuntime(target);
  installDiscardRuntime(target);
  installAbilityTargetBridge(target);
  installSpreadPlacementBridge(target);
  installControlBindings(target);

  try {
    bootGame(target);
  } catch (err) {
    console.error('The Last Reading module boot failed', err);
  }
}

startApp();