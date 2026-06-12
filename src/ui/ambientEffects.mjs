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
  if(target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;

  const layer=document.getElementById('ambientFX');
  if(!layer){
    target.setTimeout(()=>installAmbientMotes(target),250);
    return;
  }

  target.__tlrAmbientMotesInstalled=true;

  const isMobile=()=>target.innerWidth<=640;
  const maxMotes=()=>isMobile()?8:16;

  function makeMote(seed=false){
    if(layer.childElementCount>=maxMotes())return;
    const m=document.createElement('div');
    m.className='mote';
    m.style.setProperty('--s',(isMobile()?3+Math.random()*3.5:3.2+Math.random()*4.5).toFixed(1)+'px');
    m.style.left=(Math.random()*100).toFixed(1)+'vw';
    m.style.setProperty('--x',(Math.random()*72-36).toFixed(0)+'px');
    m.style.setProperty('--o',(0.34+Math.random()*0.24).toFixed(2));
    m.style.setProperty('--d',(12+Math.random()*8).toFixed(1)+'s');
    if(seed){
      m.style.animationDelay=(-Math.random()*9).toFixed(2)+'s';
      m.style.bottom=(Math.random()*76-10).toFixed(1)+'vh';
    }
    m.addEventListener('animationend',()=>m.remove());
    layer.appendChild(m);
  }

  function loop(){
    if(!document.hidden)makeMote(false);
    setTimeout(loop,(isMobile()?1300:850)+Math.random()*(isMobile()?1800:1500));
  }

  for(let i=0;i<(isMobile()?5:7);i++)setTimeout(()=>makeMote(true),i*160);
  loop();
}
