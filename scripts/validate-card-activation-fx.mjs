import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateCardActivationMotion } from '../src/ui/cardActivationFx.mjs';

const motion=calculateCardActivationMotion({
  startRect:{left:140,top:700,width:100,height:150},
  vector:{x:0,y:1,speed:1100},
  viewportWidth:390,
  viewportHeight:844,
});
assert.ok(Number.isFinite(motion.dx)&&Number.isFinite(motion.dy),'activation motion is finite');
assert.ok(motion.dy<0,'a bottom-edge activation returns into the visible play area');
assert.ok(motion.anchorY<=844*.60,'activation anchor stays out of the bottom table rim');

const gestureSource=readFileSync(new URL('../src/ui/gestureCard.mjs',import.meta.url),'utf8');
const fxSource=readFileSync(new URL('../src/ui/cardActivationFx.mjs',import.meta.url),'utf8');
assert.ok(gestureSource.includes('installCardActivationFx(target)'),'gesture installs the activation coordinator');
assert.ok(gestureSource.includes('tlrPrepareCardActivation'),'card visual is prepared before release');
assert.ok(gestureSource.includes('tlrActivateCardFromGesture'),'gesture delegates activation instead of resolving gameplay');
assert.ok(!gestureSource.includes('cloneNode('),'release path no longer deep-clones the live card');
assert.ok(!gestureSource.includes('FLICK_ABILITY_DELAY_MS'),'gameplay no longer runs on an overlapping guessed timer');
assert.ok(!gestureSource.includes('mixBlendMode'),'gesture no longer creates screen-blended burst DOM');
assert.ok(!gestureSource.includes('drop-shadow'),'armed drag feedback avoids live blur filters');
assert.ok(fxSource.includes('contain:layout paint style'),'permanent FX layer contains layout and paint work');
assert.ok(fxSource.includes('isolation:isolate'),'FX compositing is isolated from the table');
assert.ok(!fxSource.includes('mix-blend-mode'),'activation FX avoids blend-mode compositing');
assert.ok(!fxSource.includes('drop-shadow'),'activation flight avoids live blur filters');
const playIndex=fxSource.indexOf('await playCardActivation');
const discardIndex=fxSource.indexOf('target.discardCardUid(uid)');
assert.ok(playIndex>=0&&discardIndex>playIndex,'gameplay commit occurs after presentation completion');
console.log('Card activation architecture checks passed.');
