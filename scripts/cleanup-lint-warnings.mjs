import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  fs.writeFileSync(path, after);
}

edit('scripts/_ab/reduceB2.mjs', text => text
  .replaceAll('for (const [rel, s]', 'for (const [, s]'));

edit('scripts/validate-multiplayer.mjs', text => text.replace(
  /\/\/ --- Final turn triggered when spread fills ---\n\nfunction fillSpread[\s\S]*?\n}\n\n(?=\{\n  \/\/ In the simultaneous model)/,
  '// --- Final turn triggered when spread fills ---\n\n',
));

edit('src/app/adventureCardSigils.mjs', text => text
  .replace("import { getEventApproaches } from '../data/adventure/eventApproaches.mjs';\n", '')
  .replace("const SVG_NS = 'http://www.w3.org/2000/svg';\n", '')
  .replace("const REQUIREMENT_SET_KEY = '__tlrAdventureRequirementSetIndex';\n", ''));

edit('src/app/adventureModeV3.mjs', text => text.replace('  setEchoText,\n', ''));

edit('src/app/archives.mjs', text => text
  .replace(
    '   getUnlockedFragments, playSound, applyResonationGlows, _resStateKey */',
    '   getUnlockedFragments, playSound, applyResonationGlows */',
  )
  .replace(
    'let psx,psy,esx,esy,dw,dh,iw,ih,moved=false,active=false;',
    'let psx,psy,esx,esy,dw,dh,iw,moved=false,active=false;',
  )
  .replace('iw=el.offsetWidth||84;ih=el.offsetHeight||100;', 'iw=el.offsetWidth||84;'));

edit('src/app/atticFlow.mjs', text => text.replace(
  /  function candleSpend\(\)\{[^\n]*\}\n/,
  '',
));

edit('src/app/loadoutScreen.mjs', text => text
  .replace("const SWITCH_CUE_FILE = 'assets/audio/soundreality-bell-fx-410608.mp3';\n", '')
  .replace('  let switchAudio = null;\n', '')
  .replace(
    /\n  \/\/ Plays the persona-switch chime\.[\s\S]*?\n  function playSwitchCue\(\) \{[\s\S]*?\n  \}\n/,
    '\n',
  ));

edit('src/app/mainMenu.mjs', text => text.replace(
  /\nfunction hasSavedProgress\(storage\) \{[\s\S]*?\n\}\n\n(?=function syncInitialRunToStore)/,
  '\n',
));

edit('src/app/readingFlow.mjs', text => {
  text = text.replace(
    /\/\* global state,[\s\S]*?tlrScoreToObals \*\//,
    `/* global state, persist, TH, $, effectsUntil, _slotEls,
   _scoreLegacy, _getPlacedScore, _relicMeldNameToKey, _relicMeldNames,
   render, refreshHandState,
   ghost, bump, centerGhost, fireMultGhost, fireScoreGhost, holdEffects, fireChipProjectile,
   meldStr, normMeldName, sortCards, cleanName, choice,
   buildDeck, shuffle, drawN, slotsForMeld, playSound, haptic, meldMagnitude,
   tlrSyncPersistToStore, tlrStoreReady, tlrResolveAbilityThroughStore,
   tlrAbilityDraw, maxHand, tlrArchitectureSync */`,
  );
  text = text.replace(
    'const threshold=Number(_elThreshold?.textContent)||Infinity;let el=_elCurrent,start=performance.now(),dead=false,lastVal=from,popAnim=null,thCrossed=from>=threshold;',
    'const threshold=Number(_elThreshold?.textContent)||Infinity;const el=_elCurrent,start=performance.now();let dead=false,lastVal=from,popAnim=null,thCrossed=from>=threshold;',
  );
  text = text.replace(
    /\/\/ Between reveals only the ability's `count` cards[\s\S]*?\nfunction relation\([\s\S]*?\n}\n\n(?=export function checkEnd)/,
    '',
  );
  text = text.replace(
    'let cards=state.spread.filter(Boolean),res=_scoreLegacy(cards),total=res.finalScore,curTH=TH[state.th]+(state.thBonus||0),pass=total>=curTH;',
    'const cards=state.spread.filter(Boolean);let res=_scoreLegacy(cards),total=res.finalScore,curTH=TH[state.th]+(state.thBonus||0),pass=total>=curTH;',
  );
  text = text.replace(
    'let needsNext=false,roundTotal=total,setNumber=(state.setIndex||0)+1,setsPerRound=state.setsPerRound||2;',
    'let needsNext=false,roundTotal=total;',
  );
  return text
    .replace('  setNumber=(_run.setIndex||0)+1;\n', '')
    .replace('  setsPerRound=_run.setsPerRound||setsPerRound;\n', '');
});

edit('src/app/tutorialCore.mjs', text => text.replace('let placementCount = 0;\n', ''));

edit('src/multiplayer/mpSelectors.mjs', text => text.replace(
  "import { MP_ABILITY_TYPES } from './interactionCards.mjs';\n",
  '',
));

edit('src/ui/gestureCard.mjs', text => text
  .replace(
    '/* global state, refreshHandState, expandCard, render, placeCard */',
    '/* global state, refreshHandState, expandCard, render */',
  )
  .replace('  const HOLD_MS=400;\n', '')
  .replace('  const inSelectionMode=()=>!!(gestureTargeting()||purgeSelecting()||gestureBusy());\n', '')
  .replace(
    /\n  const restoreCardToHand=\(\)=>\{[\s\S]*?\n  \};\n\n(?=  const startSelectDrag)/,
    '\n',
  ));

edit('src/ui/gestureHand.mjs', text => text.replace(
  'let springRaf=null,springLastT=0,springState=new WeakMap();',
  'let springRaf=null,springLastT=0;const springState=new WeakMap();',
));

edit('src/ui/renderMarket.mjs', text => text.replace("const STORE_ASSET_PATH = './';\n", ''));

edit('src/ui/renderTable.mjs', text => text.replace(
  /\/\* global state, persist, TH, \$, [^\n]* \*\//,
  '/* global state, persist, TH, $, _hintsKey, _hintsCacheKey, _hintsCache, _getPlacedScore, applyResonationGlows, _scoreLegacy, hasMull, maxHand, tlrArchitectureSync, _elThreshold, _elPool, _elDiscards, _elDiscardBtn, _elPurgeBtn, _elMullBtn */',
));

console.log('Lint cleanup transformations applied.');
