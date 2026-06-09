const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* hand mouse-drag slide patch */';
if (html.includes(marker)) {
  console.log('Hand mouse-drag slide patch already present, skipping.');
  fs.writeFileSync(file, html);
  process.exit(0);
}

// 1. Widen the slide trigger: on mouse (pointerType==='mouse'), also accept
//    drags originating anywhere in the handDock / swipe zone that isn't
//    directly on a card element.
const oldPointerDown = `    // Single-finger slide only kicks in inside the swipe strip; on the cards
    // themselves we leave the existing card-press / drag-select handler alone.
    if(inSwipeZone(ev.target)&&mode==null){
      try{zoneEl()?.setPointerCapture(ev.pointerId);}catch(e){}
      startSlideMode(ev);
    }`;

const newPointerDown = `    // Single-finger slide: touch must start in the dedicated swipe strip.
    // Mouse can start anywhere in the hand dock that isn't a card itself,
    // so desktop users don't need to find the invisible 88px strip.
    const isMouse=ev.pointerType==='mouse';
    const mouseInHand=isMouse&&ev.target instanceof Element&&ev.target.closest('.handDock,#handSwipeZone')&&!ev.target.closest('.card[data-uid]');
    if((inSwipeZone(ev.target)||mouseInHand)&&mode==null){
      try{(isMouse?ev.target.closest('.handDock,#handSwipeZone'):zoneEl())?.setPointerCapture(ev.pointerId);}catch(e){}
      startSlideMode(ev);
    }`;

if (html.includes(oldPointerDown)) {
  html = html.replace(oldPointerDown, newPointerDown);
  console.log('Fixed: widened slide trigger for mouse pointerType');
} else {
  console.warn('WARN: could not find pointerdown slide block to patch');
}

// 2. Show grabbing cursor during active slide on desktop.
//    The zone already has cursor:grab; add cursor:grabbing on the body
//    while hand-scroll-dragging is active.
const oldHandCss = `.hand-swipe-zone{position:fixed;left:0;right:0;bottom:197px;height:88px;z-index:19;pointer-events:auto;touch-action:none;cursor:grab;background:transparent}`;
const newHandCss = `.hand-swipe-zone{position:fixed;left:0;right:0;bottom:197px;height:88px;z-index:19;pointer-events:auto;touch-action:none;cursor:grab;background:transparent}
.hand-scroll-dragging~* .card,.hand-scroll-dragging .card{pointer-events:none!important}
body:has(.hand-scroll-dragging){cursor:grabbing!important}
body:has(.hand-scroll-dragging) .handDock *{cursor:grabbing!important}`;

if (html.includes(oldHandCss)) {
  html = html.replace(oldHandCss, newHandCss);
  console.log('Fixed: added grabbing cursor and card pointer-events block during drag');
} else {
  console.warn('WARN: could not find .hand-swipe-zone CSS to augment');
}

// 3. Prevent native browser drag from swallowing pointer events during mouse drag.
const oldAttachObserver = `  attachObserver();
  window.addEventListener('resize',scheduleRecheck);
})();`;

const newAttachObserver = `  // Prevent native HTML drag from intercepting pointer events during mouse slide.
  document.addEventListener('dragstart',ev=>{
    if(mode==='slide'||mode==='pinch')ev.preventDefault();
  },true);
  attachObserver();
  window.addEventListener('resize',scheduleRecheck);
})();`;

if (html.includes(oldAttachObserver) && !html.includes('dragstart')) {
  html = html.replace(oldAttachObserver, newAttachObserver);
  console.log('Fixed: added dragstart prevention during slide');
} else if (html.includes('dragstart')) {
  console.log('dragstart handler already present, skipping');
} else {
  console.warn('WARN: could not find attachObserver to inject dragstart handler');
}

// Stamp marker so re-runs are idempotent
html = html.replace('</style>', `/* ${marker} */\n</style>`);

fs.writeFileSync(file, html);
console.log('Applied hand mouse-drag slide patch.');
