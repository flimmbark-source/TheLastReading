const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Remove older versions if this is running on an already-patched local file.
html = html.replace(/\/\* Attic stable return UI patch \*\/[\s\S]*?(?=\n<\/style>)/, '');
html = html.replace(/\/\* Attic mobile pan patch \*\/[\s\S]*?(?=\n<\/style>)/, '');

const marker = '/* Attic stable return UI patch v2 */';
const panMarker = '/* Attic mobile pan patch v2 */';
const panJsMarker = '// Attic mobile pan patch v2';

if (!html.includes(marker)) {
  const css = `
${marker}
body.mode-return-hard-hide #titleWrap,
body.mode-return-hard-hide .score-stack,
body.mode-return-hard-hide .spread-wrap,
body.mode-return-hard-hide .handDock,
body.mode-return-hard-hide #handSwipeZone,
body.mode-return-hard-hide #relicRack,
body.mode-return-hard-hide .refs-layer,
body.mode-return-hard-hide .ability-prompt,
body.mode-return-hard-hide #abilityPrompt,
body.mode-return-hard-hide #purgePrompt,
body.mode-return-hard-hide .actions,
body.mode-to-table #titleWrap,
body.mode-to-table .score-stack,
body.mode-to-table .spread-wrap,
body.mode-to-table .handDock,
body.mode-to-table #handSwipeZone,
body.mode-to-table #relicRack,
body.mode-to-table .refs-layer,
body.mode-to-table .ability-prompt,
body.mode-to-table #abilityPrompt,
body.mode-to-table #purgePrompt,
body.mode-to-table .actions,
body.mode-table-return #titleWrap,
body.mode-table-return .score-stack,
body.mode-table-return .spread-wrap,
body.mode-table-return .handDock,
body.mode-table-return #handSwipeZone,
body.mode-table-return #relicRack,
body.mode-table-return .refs-layer,
body.mode-table-return .ability-prompt,
body.mode-table-return #abilityPrompt,
body.mode-table-return #purgePrompt,
body.mode-table-return .actions{opacity:0!important;transform:none!important;filter:none!important;transition:none!important;pointer-events:none!important;will-change:auto!important}
body.mode-return-hard-hide #invWrap,body.mode-to-table #invWrap,body.mode-table-return #invWrap{transform:translateY(calc(-1 * var(--inv-h)))!important;pointer-events:none!important}
`;
  html = html.replace('</style>', css + '\n</style>');
}

const oldScene = '<div id="atticScene" aria-hidden="true"><div id="candlelightHud"></div><div id="atticObjects"></div><div id="atticWhisper"></div></div>';
const newScene = '<div id="atticScene" aria-hidden="true"><div id="atticPan"><div id="atticRoom"><div id="atticObjects"></div></div></div><div id="candlelightHud"></div><div id="atticWhisper"></div></div>';
if (html.includes(oldScene)) html = html.replace(oldScene, newScene);

if (!html.includes(panMarker)) {
  const css = `
${panMarker}
#atticScene{background:#0f0905!important;overflow:hidden!important}
#atticScene::before,#atticScene::after{z-index:9!important;pointer-events:none!important}
#atticPan{position:absolute;inset:0;z-index:3;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-x;overscroll-behavior:contain;scrollbar-width:none;background:#0f0905}
#atticPan::-webkit-scrollbar{display:none}
#atticRoom{position:relative;height:100vh;height:100dvh;width:177.7778vh;width:177.7778dvh;min-height:100vh;min-height:100dvh;min-width:177.7778vh;min-width:177.7778dvh;background:url('backgrounds/attic_room_mvp_1080x1920.png') left top / 100% 100% no-repeat}
#atticObjects{position:absolute!important;inset:0!important;z-index:6!important}
.attic-prop{background-color:transparent!important;background-repeat:no-repeat!important;background-size:contain!important;background-position:center!important;filter:none!important;box-shadow:none!important;border:0!important;outline:0!important;overflow:visible!important}
.attic-prop.searched{cursor:default!important;pointer-events:none!important;opacity:1!important}
.attic-prop::before,.attic-prop::after{display:none!important;background:none!important;box-shadow:none!important}
.attic-prop.spend{animation:none!important}
.attic-dust{display:none!important;background:none!important}
@media (min-width:981px){#atticPan{overflow:hidden;display:flex;justify-content:center;align-items:flex-start}#atticRoom{margin:0 auto}}
@media (max-width:980px){#atticPan{display:block;cursor:grab}#atticPan.dragging{cursor:grabbing}#atticRoom{margin:0}.attic-pan-hint{position:absolute;left:50%;top:86px;z-index:20;transform:translateX(-50%);padding:8px 12px;border:1px solid rgba(197,149,74,.55);border-radius:999px;background:rgba(20,12,7,.78);color:#f0d99b;font:800 10px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;pointer-events:none;box-shadow:0 10px 28px rgba(0,0,0,.5);opacity:0;animation:atticPanHint 3.4s ease forwards}@keyframes atticPanHint{0%{opacity:0;transform:translateX(-50%) translateY(-8px)}14%{opacity:1;transform:translateX(-50%) translateY(0)}78%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-8px)}}}
`;
  html = html.replace('</style>', css + '\n</style>');
}

// Reposition the three rummage props for the wide attic art. These are separate full PNGs, not sprite sheets.
html = html.replace(/newspaper_stack_01:\{[^\n]*?itemTitle:'Strange Obituary',thumb:'strange_obituary\.png'\}/g, "newspaper_stack_01:{id:'newspaper_stack_01',label:'Stack of Newspapers',verb:'Move aside',motion:'move',cost:1,before:'props/newspaper_stack_closed.png',after:'props/newspaper_stack_moved.png',left:'14%',top:'71%',width:'25%',height:'20%',itemId:'clipping_01',itemTitle:'Strange Obituary',thumb:'strange_obituary.png'}");
html = html.replace(/covered_frame_01:\{[^\n]*?itemTitle:'The Reading Room',thumb:'Reading_room\.png'\}/g, "covered_frame_01:{id:'covered_frame_01',label:'Covered Frame',verb:'Lift cloth',motion:'lift',cost:1,before:'props/covered_frame_closed.png',after:'props/covered_frame_uncovered.png',left:'67%',top:'16%',width:'25%',height:'44%',itemId:'photo_01',itemTitle:'The Reading Room',thumb:'Reading_room.png'}");
html = html.replace(/coat_01:\{[^\n]*?itemTitle:'Unsigned Letter',thumb:'handwritten_note\.png'\}/g, "coat_01:{id:'coat_01',label:'Old Coat',verb:'Check pocket',motion:'search',cost:1,before:'props/old_coat_closed.png',after:'props/old_coat_searched.png',left:'4%',top:'14%',width:'24%',height:'67%',itemId:'letter_01',itemTitle:'Unsigned Letter',thumb:'handwritten_note.png'}");

// Render the full closed/open PNGs. Do not crop with background-size:200%.
html = html.replace(/el\.style\.backgroundImage='url\("'\+o\.before\+'"\)';el\.style\.backgroundSize='200% 100%';el\.style\.backgroundPosition=done\?'100% 50%':'0% 50%';/g, "el.style.backgroundImage='url(\"'+(done?o.after:o.before)+'\")';el.style.backgroundSize='contain';el.style.backgroundPosition='center';");
html = html.replace(/el\.style\.backgroundImage='url\("'\+\(done\?o\.after:o\.before\)\+'"\)';el\.style\.backgroundSize='contain';el\.style\.backgroundPosition='center';/g, "el.style.backgroundImage='url(\"'+(done?o.after:o.before)+'\")';el.style.backgroundSize='contain';el.style.backgroundPosition='center';");
html = html.replace(/el\.style\.backgroundImage='url\("'\+\(done\?o\.after:o\.before\)\+'"\)';/g, "el.style.backgroundImage='url(\"'+(done?o.after:o.before)+'\")';el.style.backgroundSize='contain';el.style.backgroundPosition='center';");
html = html.replace(/function dustNear\(el\)\{[\s\S]*?\n  function showPickup\(o\)\{/g, "function dustNear(el){return;}\n  function showPickup(o){");

if (!html.includes(panJsMarker)) {
  const js = `
${panJsMarker}
(function(){
  function positionAtticView(){const pan=document.getElementById('atticPan');if(!pan)return;requestAnimationFrame(function(){const maxX=Math.max(0,pan.scrollWidth-pan.clientWidth);pan.scrollLeft=Math.round(maxX*.34);pan.scrollTop=0;});}
  function showPanHint(){if(window.innerWidth>980)return;try{if(localStorage.getItem('tlr_attic_pan_hint'))return;localStorage.setItem('tlr_attic_pan_hint','1');}catch(e){}const scene=document.getElementById('atticScene');if(!scene)return;document.querySelectorAll('.attic-pan-hint').forEach(function(el){el.remove();});const hint=document.createElement('div');hint.className='attic-pan-hint';hint.textContent='Swipe to look around';scene.appendChild(hint);setTimeout(function(){hint.remove();},3600);}
  function installDragPan(){const pan=document.getElementById('atticPan');if(!pan||pan.__tlrDragPan)return;pan.__tlrDragPan=true;let active=false,startX=0,startLeft=0;pan.addEventListener('pointerdown',function(e){if(e.target&&e.target.closest&&e.target.closest('.attic-prop,#atticPickup'))return;active=true;startX=e.clientX;startLeft=pan.scrollLeft;pan.classList.add('dragging');});pan.addEventListener('pointermove',function(e){if(!active)return;pan.scrollLeft=startLeft-(e.clientX-startX);});function end(){active=false;pan.classList.remove('dragging');}pan.addEventListener('pointerup',end);pan.addEventListener('pointercancel',end);}
  window.tlrPositionAtticView=positionAtticView;window.tlrInstallAtticPan=installDragPan;
  window.tlrResetAtticFoundItems=function(){try{localStorage.removeItem('tlr_attic_found_items')}catch(e){};if(typeof renderInventory==='function')renderInventory();};
  const oldEnter=window.tlrDebugEnterAttic;if(typeof oldEnter==='function'&&!oldEnter.__tlrMobilePanWrapped){const wrapped=function(){const result=oldEnter.apply(this,arguments);installDragPan();setTimeout(positionAtticView,60);setTimeout(positionAtticView,260);setTimeout(function(){positionAtticView();showPanHint();},960);return result;};wrapped.__tlrMobilePanWrapped=true;window.tlrDebugEnterAttic=wrapped;}
  const oldReadingEnter=window.tlrEnterAtticAfterReading;if(typeof oldReadingEnter==='function'&&!oldReadingEnter.__tlrMobilePanWrapped){const wrapped=function(){const result=oldReadingEnter.apply(this,arguments);installDragPan();setTimeout(positionAtticView,60);setTimeout(positionAtticView,260);setTimeout(function(){positionAtticView();showPanHint();},960);return result;};wrapped.__tlrMobilePanWrapped=true;window.tlrEnterAtticAfterReading=wrapped;}
  window.addEventListener('DOMContentLoaded',installDragPan);window.addEventListener('resize',function(){if(document.body.classList.contains('mode-attic')||document.body.classList.contains('mode-to-attic'))positionAtticView();});
})();
`;
  html = html.replace('</script>', js + '\n</script>');
}

const oldLeave = "function leave(){\n    if(window.tlrCloseArchives)window.tlrCloseArchives();\n    if(!inAttic)return;inAttic=false;document.querySelectorAll('#atticPickup,.attic-action-tag,.attic-dust').forEach(function(p){p.remove();});\n    document.body.classList.remove('mode-attic','mode-to-attic','mode-reading');document.body.classList.add('mode-to-table');\n    const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');\n    setTimeout(function(){if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}document.body.classList.remove('mode-to-table');document.body.classList.add('mode-reading','mode-table-return');},720);\n    setTimeout(function(){document.body.classList.remove('mode-table-return');},1650);\n  }";
const newLeave = "function leave(){\n    if(window.tlrCloseArchives)window.tlrCloseArchives();\n    if(!inAttic)return;inAttic=false;document.querySelectorAll('#atticPickup,.attic-action-tag,.attic-dust').forEach(function(p){p.remove();});\n    document.body.classList.add('mode-return-hard-hide');\n    if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}\n    setTimeout(function(){document.body.classList.remove('mode-attic','mode-to-attic','mode-reading');document.body.classList.add('mode-to-table');const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');},60);\n    setTimeout(function(){document.body.classList.remove('mode-to-table','mode-table-return','mode-return-hard-hide');document.body.classList.add('mode-reading');},1080);\n  }";
if (html.includes(oldLeave)) html = html.replace(oldLeave, newLeave);

fs.writeFileSync(file, html);
console.log('Applied attic stable return and mobile pan patch.');
