const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// ── 1. Swap hint text: mobile gets pinch/pull, desktop gets scroll ──
// Replace the static hint HTML with JS-generated hint that detects pointer type.
const oldHint = `<div id="handSwipeZone" class="hand-swipe-zone"><div class="hand-swipe-hint"><div class="swipe-hint-line swipe-hint-line-1"><span></span>&#x2724; swipe to drift &#x2724;<span></span></div><div class="swipe-hint-line swipe-hint-line-2"><span></span>&#x2724; pinch to constrict &#x2724;<span></span></div><div class="swipe-hint-line swipe-hint-line-3"><span></span>&#x2724; pull open to expand &#x2724;<span></span></div></div></div>`;
const newHint = `<div id="handSwipeZone" class="hand-swipe-zone"><div class="hand-swipe-hint"><div class="swipe-hint-line swipe-hint-line-1"><span></span>&#x2724; swipe to drift &#x2724;<span></span></div><div class="swipe-hint-line swipe-hint-line-2" id="handHintLine2"><span></span>&#x2724; pinch to constrict &#x2724;<span></span></div><div class="swipe-hint-line swipe-hint-line-3" id="handHintLine3"><span></span>&#x2724; pull open to expand &#x2724;<span></span></div></div></div>`;

if (html.includes(oldHint)) {
  html = html.replace(oldHint, newHint);
  console.log('Fixed: added IDs to hint lines 2 and 3');
} else {
  console.warn('WARN: could not find hand hint HTML to patch');
}

// ── 2. Inject scroll-wheel handler inside the existing swipe closure,
//       right before attachObserver() call, and swap hint text on load. ──
const oldAttach = `  attachObserver();
  window.addEventListener('resize',scheduleRecheck);
})();`;

const newAttach = `  // ── Desktop scroll-wheel: scroll down = constrict, scroll up = expand ──
  (function(){
    const isDesktop=()=>window.matchMedia('(pointer:fine)').matches;
    // Swap hint text for desktop on first opportunity
    const setHintText=()=>{
      const l2=document.getElementById('handHintLine2');
      const l3=document.getElementById('handHintLine3');
      if(!l2||!l3)return;
      if(isDesktop()){
        l2.innerHTML='<span></span>&#x2724; scroll down to constrict &#x2724;<span></span>';
        l3.innerHTML='<span></span>&#x2724; scroll up to expand &#x2724;<span></span>';
      } else {
        l2.innerHTML='<span></span>&#x2724; pinch to constrict &#x2724;<span></span>';
        l3.innerHTML='<span></span>&#x2724; pull open to expand &#x2724;<span></span>';
      }
    };
    if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',setHintText);}
    else{setHintText();}
    window.matchMedia('(pointer:fine)').addEventListener('change',setHintText);

    // Scroll to adjust spacing — desktop only
    const DEG_PER_SCROLL=0.012;  // degrees of spacing per pixel of scroll delta
    let scrollRaf=null;
    let pendingDelta=0;
    const applyScroll=()=>{
      scrollRaf=null;
      if(!pendingDelta)return;
      const delta=pendingDelta;pendingDelta=0;
      // deltaY > 0 = scroll down = constrict (reduce spacing)
      const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
      let next=s - delta*DEG_PER_SCROLL;
      next=Math.max(SPACING_MIN,Math.min(SPACING_MAX,next));
      if(next===manualSpacing)return;
      manualSpacing=next;
      cachedCap=null;
      applySpacing(next);
      applyOffset(clampOffset(offset));
    };
    const onWheel=ev=>{
      if(!isDesktop())return;
      const z=zoneEl();if(!z)return;
      // Only activate when hovering the swipe zone or the hand area
      if(!ev.target.closest('#handSwipeZone,.handDock'))return;
      ev.preventDefault();
      // Normalise delta across different wheel modes
      let dy=ev.deltaY;
      if(ev.deltaMode===1)dy*=20;   // line mode
      if(ev.deltaMode===2)dy*=400;  // page mode
      pendingDelta+=dy;
      if(scrollRaf==null)scrollRaf=requestAnimationFrame(applyScroll);
    };
    window.addEventListener('wheel',onWheel,{passive:false});
  })();
  attachObserver();
  window.addEventListener('resize',scheduleRecheck);
})();`;

if (html.includes(oldAttach)) {
  html = html.replace(oldAttach, newAttach);
  console.log('Fixed: injected desktop scroll-wheel spacing handler');
} else {
  console.warn('WARN: could not find attachObserver block to inject scroll handler');
}

fs.writeFileSync(file, html);
console.log('Applied hand desktop scroll patch.');
