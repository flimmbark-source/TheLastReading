const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const cssMarker = '/* Attic mobile pan patch */';
const jsMarker = '// Attic mobile pan patch';

// Rebuild the attic scene shell so the wide room can live inside a scrollable viewport.
const oldScene = '<div id="atticScene" aria-hidden="true"><div id="candlelightHud"></div><div id="atticObjects"></div><div id="atticWhisper"></div></div>';
const newScene = '<div id="atticScene" aria-hidden="true"><div id="atticPan"><div id="atticRoom"><div id="atticObjects"></div></div></div><div id="candlelightHud"></div><div id="atticWhisper"></div></div>';
if (html.includes(oldScene)) {
  html = html.replace(oldScene, newScene);
}

if (!html.includes(cssMarker)) {
  const css = `
${cssMarker}
#atticScene{
  background:#0f0905!important;
  overflow:hidden!important;
}
#atticScene::before,
#atticScene::after{
  z-index:9!important;
  pointer-events:none!important;
}
#atticPan{
  position:absolute;
  inset:0;
  z-index:3;
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  touch-action:pan-x;
  overscroll-behavior:contain;
  scrollbar-width:none;
}
#atticPan::-webkit-scrollbar{display:none}
#atticRoom{
  position:relative;
  width:1920px;
  height:1080px;
  min-width:1920px;
  min-height:1080px;
  background:url('backgrounds/attic_room_mvp_1080x1920.png') left top / 100% 100% no-repeat;
}
#atticObjects{
  position:absolute!important;
  inset:0!important;
  z-index:6!important;
}
@media (min-width:981px){
  #atticPan{
    overflow:hidden;
    display:flex;
    justify-content:center;
    align-items:flex-start;
  }
  #atticRoom{
    margin:0 auto;
  }
}
@media (max-width:980px){
  #atticPan{
    display:block;
    cursor:grab;
  }
  #atticPan.dragging{
    cursor:grabbing;
  }
  #atticRoom{
    margin:0;
  }
  .attic-pan-hint{
    position:absolute;
    left:50%;
    top:86px;
    z-index:20;
    transform:translateX(-50%);
    padding:8px 12px;
    border:1px solid rgba(197,149,74,.55);
    border-radius:999px;
    background:rgba(20,12,7,.78);
    color:#f0d99b;
    font:800 10px system-ui,sans-serif;
    letter-spacing:.08em;
    text-transform:uppercase;
    pointer-events:none;
    box-shadow:0 10px 28px rgba(0,0,0,.5);
    opacity:0;
    animation:atticPanHint 3.4s ease forwards;
  }
  @keyframes atticPanHint{
    0%{opacity:0;transform:translateX(-50%) translateY(-8px)}
    14%{opacity:1;transform:translateX(-50%) translateY(0)}
    78%{opacity:1;transform:translateX(-50%) translateY(0)}
    100%{opacity:0;transform:translateX(-50%) translateY(-8px)}
  }
}
`;
  html = html.replace('</style>', css + '\n</style>');
}

if (!html.includes(jsMarker)) {
  const js = `
${jsMarker}
(function(){
  function positionAtticView(){
    const pan=document.getElementById('atticPan');
    if(!pan)return;
    requestAnimationFrame(function(){
      const maxX=Math.max(0,pan.scrollWidth-pan.clientWidth);
      pan.scrollLeft=Math.round(maxX*.36);
      pan.scrollTop=0;
    });
  }
  function showPanHint(){
    if(window.innerWidth>980)return;
    try{if(localStorage.getItem('tlr_attic_pan_hint'))return;localStorage.setItem('tlr_attic_pan_hint','1');}catch(e){}
    const scene=document.getElementById('atticScene');
    if(!scene)return;
    document.querySelectorAll('.attic-pan-hint').forEach(function(el){el.remove();});
    const hint=document.createElement('div');
    hint.className='attic-pan-hint';
    hint.textContent='Swipe to look around';
    scene.appendChild(hint);
    setTimeout(function(){hint.remove();},3600);
  }
  function installDragPan(){
    const pan=document.getElementById('atticPan');
    if(!pan||pan.__tlrDragPan)return;
    pan.__tlrDragPan=true;
    let active=false,startX=0,startLeft=0,moved=false;
    pan.addEventListener('pointerdown',function(e){
      if(e.target&&e.target.closest&&e.target.closest('.attic-prop,#atticPickup'))return;
      active=true;moved=false;startX=e.clientX;startLeft=pan.scrollLeft;pan.classList.add('dragging');
    });
    pan.addEventListener('pointermove',function(e){
      if(!active)return;
      const dx=e.clientX-startX;
      if(Math.abs(dx)>3)moved=true;
      pan.scrollLeft=startLeft-dx;
    });
    function end(){active=false;pan.classList.remove('dragging');}
    pan.addEventListener('pointerup',end);
    pan.addEventListener('pointercancel',end);
  }
  window.tlrPositionAtticView=positionAtticView;
  window.tlrInstallAtticPan=installDragPan;

  const oldEnter=window.tlrDebugEnterAttic;
  if(typeof oldEnter==='function'&&!oldEnter.__tlrMobilePanWrapped){
    const wrapped=function(){
      const result=oldEnter.apply(this,arguments);
      installDragPan();
      setTimeout(positionAtticView,60);
      setTimeout(positionAtticView,260);
      setTimeout(function(){positionAtticView();showPanHint();},960);
      return result;
    };
    wrapped.__tlrMobilePanWrapped=true;
    window.tlrDebugEnterAttic=wrapped;
  }

  const oldReadingEnter=window.tlrEnterAtticAfterReading;
  if(typeof oldReadingEnter==='function'&&!oldReadingEnter.__tlrMobilePanWrapped){
    const wrapped=function(){
      const result=oldReadingEnter.apply(this,arguments);
      installDragPan();
      setTimeout(positionAtticView,60);
      setTimeout(positionAtticView,260);
      setTimeout(function(){positionAtticView();showPanHint();},960);
      return result;
    };
    wrapped.__tlrMobilePanWrapped=true;
    window.tlrEnterAtticAfterReading=wrapped;
  }

  window.addEventListener('DOMContentLoaded',installDragPan);
  window.addEventListener('resize',function(){
    if(document.body.classList.contains('mode-attic')||document.body.classList.contains('mode-to-attic'))positionAtticView();
  });
})();
`;
  html = html.replace('</script>', js + '\n</script>');
}

fs.writeFileSync(file, html);
console.log('Applied attic mobile pan patch.');
