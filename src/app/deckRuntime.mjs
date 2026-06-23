// Deck runtime adapter.
// Pure helpers live in systems/deck.mjs. This file exposes legacy-compatible
// wrappers so index.html deck helpers can be removed later without changing call sites.

import {
  buildLegacyDeck,
  maxHandSize,
  maxDiscardCount,
  hasMulligan,
  maxMulliganCount,
  drawNIntoRun,
  drawToHandSize,
  uniqueCards as uniqueCardsPure,
} from '../systems/deck.mjs';
import { installDrawAnimation, queueDrawAnimation } from '../ui/drawAnimation.mjs';
import { installMulliganRuntime } from './mulliganRuntime.mjs';

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state;}
function persistOf(target){return runtime(target).persist;}

export function buildDeck(target = window){
  return buildLegacyDeck({
    majors:target.MAJORS,
    courts:target.COURTS,
    suits:target.SUITS,
    roman:target.ROMAN,
  });
}

export function maxHand(target = window){return maxHandSize(persistOf(target));}
export function maxDiscards(target = window){return maxDiscardCount(persistOf(target));}
export function hasMull(target = window){return hasMulligan(persistOf(target));}
export function maxMull(target = window){return maxMulliganCount(persistOf(target));}
export function uniqueCards(cards){return uniqueCardsPure(cards);}

export function drawN(count,target = window){
  const state=stateOf(target);
  const drew=drawNIntoRun(state,count,{
    shuffle:target.shuffle,
    onDraw:()=>{if(typeof target.playSound==='function')target.playSound('draw');},
  });
  if(drew>0)queueDrawAnimation(state.hand.slice(-drew),target);
  return drew;
}

export function drawTo(count,target = window){
  const state=stateOf(target);
  const drew=drawToHandSize(state,count,{
    onDraw:()=>{if(typeof target.playSound==='function')target.playSound('draw');},
  });
  if(drew>0)queueDrawAnimation(state.hand.slice(-drew),target);
  return drew;
}

export function installDeckRuntime(target = window){
  if(!target || target.__tlrDeckRuntimeInstalled)return;
  target.__tlrDeckRuntimeInstalled=true;
  const api={buildDeck,maxHand,maxDiscards,hasMull,maxMull,drawN,drawTo,uniqueCards};
  target.tlrDeckRuntime=api;

  // Only fill gaps. The inline script still owns these names until final cleanup.
  if(typeof target.buildDeck!=='function')target.buildDeck=()=>buildDeck(target);
  if(typeof target.maxHand!=='function')target.maxHand=()=>maxHand(target);
  if(typeof target.maxDiscards!=='function')target.maxDiscards=()=>maxDiscards(target);
  if(typeof target.hasMull!=='function')target.hasMull=()=>hasMull(target);
  if(typeof target.maxMull!=='function')target.maxMull=()=>maxMull(target);
  if(typeof target.drawN!=='function')target.drawN=count=>drawN(count,target);
  if(typeof target.drawTo!=='function')target.drawTo=count=>drawTo(count,target);
  if(typeof target.uniqueCards!=='function')target.uniqueCards=uniqueCards;
  installMulliganRuntime(target);
  installDrawAnimation(target);
}
