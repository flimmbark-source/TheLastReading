// Small ambient visual effects extracted from the legacy inline tail.

function inlineScriptStillContains(marker){
  return [...document.scripts].some(script=>script.textContent&&script.textContent.includes(marker));
}

export function installAmbientEffects(target = window){
  if(!target || target.__tlrAmbientEffectsInstalled)return;

  // While the legacy inline tail still exists, do not start duplicate timers.
  if(inlineScriptStillContains('function ambientMotes()')||inlineScriptStillContains('function handAnim()')){
    target.__tlrLegacyInlineAmbientEffectsDetected=true;
    return;
  }

  target.__tlrAmbientEffectsInstalled=true;
  installHandIdleAnimation(target);
  installAmbientMotes(target);
}

function installHandIdleAnimation(target){
  if(target.__tlrHandIdleAnimationInstalled)return;
  target.__tlrHandIdleAnimationInstalled=true;
  (function handAnim(){
    const hand=document.querySelector('.hand');
    if(!hand)return;
    const rot=(Math.random()*3.2-1.6).toFixed(2);
    const tx=(Math.random()*6-3).toFixed(1);
    const ty=(Math.random()*5).toFixed(1);
    const dur=900+Math.random()*500;
    hand.style.transition=`rotate ${dur}ms ease-in-out,translate ${dur}ms ease-in-out`;
    hand.style.rotate=rot+'deg';
    hand.style.translate=`${tx}px ${ty}px`;
    const pause=2000+Math.random()*10000;
    setTimeout(handAnim,dur+pause);
  })();
}

function installAmbientMotes(target){
  if(target.__tlrAmbientMotesInstalled)return;
  target.__tlrAmbientMotesInstalled=true;
  if(target.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const layer=document.getElementById('ambientFX');
  if(!layer)return;
  const MAX=14;
  function makeMote(){
    if(layer.childElementCount>=MAX)return;
    const m=document.createElement('div');m.className='mote';
    m.style.setProperty('--s',(2+Math.random()*4).toFixed(1)+'px');
    const leftPct=(Math.random()*100).toFixed(1);
    m.style.left=leftPct+'vw';
    m.style.setProperty('--x',(Math.random()*64-32).toFixed(0)+'px');
    m.style.setProperty('--o',(0.14+Math.random()*0.34).toFixed(2));
    m.style.setProperty('--d',(12+Math.random()*8).toFixed(1)+'s');
    m.addEventListener('animationend',()=>m.remove());
    layer.appendChild(m);
  }
  function loop(){if(!document.hidden)makeMote();setTimeout(loop,900+Math.random()*1700)}
  for(let i=0;i<4;i++)setTimeout(makeMote,i*1800);
  loop();
}
