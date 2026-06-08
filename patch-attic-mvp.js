const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Attic scene shell patch */';
const jsMarker = '// Attic end screen transition patch';

if (!html.includes(marker)) {
  const css = `
${marker}
#atticScene{position:fixed;inset:0;z-index:520;opacity:0;pointer-events:none;background:url('backgrounds/attic_room_mvp_1080x1920.png') center center/cover no-repeat;transition:opacity .9s ease,filter .9s ease,transform 1.15s ease;transform:scale(1.04);filter:blur(2px);overflow:hidden;color:#ead9b5;font-family:Georgia,serif}
#atticScene::before{content:'';position:absolute;inset:0;background:url('fx/transition_dark_vignette_1080x1920.png') center center/cover no-repeat;opacity:.72;z-index:1;pointer-events:none}
#atticScene::after{content:'';position:absolute;inset:0;background:url('fx/table_to_attic_fog_overlay_1080x1920.png') center center/cover no-repeat;opacity:.36;z-index:2;mix-blend-mode:screen;pointer-events:none}
body.mode-to-attic #atticScene,body.mode-attic #atticScene{opacity:1;filter:none;transform:scale(1);pointer-events:auto}
body.mode-to-table #atticScene{opacity:0;filter:blur(4px);transform:scale(1.08);pointer-events:none}
body.mode-table-return #atticScene{opacity:0;filter:blur(4px);transform:scale(1.08);pointer-events:none}
body.mode-to-attic #titleWrap,body.mode-to-attic .score-stack,body.mode-to-attic .spread-wrap,body.mode-to-attic .handDock,body.mode-to-attic #relicRack,body.mode-to-attic #invWrap,body.mode-to-attic .refs-layer{opacity:0;transform:scale(.9) translateY(14vh);filter:blur(2px);pointer-events:none;transition:opacity .75s ease,transform 1.1s ease,filter .75s ease}
body.mode-attic #titleWrap,body.mode-attic .score-stack,body.mode-attic .spread-wrap,body.mode-attic .handDock,body.mode-attic #relicRack,body.mode-attic #invWrap,body.mode-attic .refs-layer{opacity:0!important;pointer-events:none!important;filter:blur(3px);transform:scale(.88) translateY(18vh)}
body.mode-to-table #titleWrap,body.mode-to-table .score-stack,body.mode-to-table .spread-wrap,body.mode-to-table .handDock,body.mode-to-table #relicRack,body.mode-to-table #invWrap,body.mode-to-table .refs-layer{opacity:0;transform:scale(.92) translateY(12vh);filter:blur(2px);pointer-events:none;transition:opacity .65s ease,transform .9s ease,filter .65s ease}
body.mode-table-return #titleWrap,body.mode-table-return .score-stack,body.mode-table-return .spread-wrap,body.mode-table-return .handDock,body.mode-table-return #relicRack,body.mode-table-return #invWrap,body.mode-table-return .refs-layer{opacity:1;transform:none;filter:none;transition:opacity .8s ease,transform 1s ease,filter .8s ease}
#atticObjects{position:absolute;inset:0;z-index:6}
.attic-prop{position:absolute;background-size:contain;background-repeat:no-repeat;background-position:center;touch-action:manipulation;user-select:none;cursor:pointer;filter:drop-shadow(0 16px 22px rgba(0,0,0,.58));transition:transform .18s ease,filter .18s ease,opacity .18s ease}
.attic-prop:active{transform:translateY(-5px) scale(1.015);filter:drop-shadow(0 20px 28px rgba(0,0,0,.72)) drop-shadow(0 0 12px rgba(255,209,112,.3))}
.attic-prop.searched{opacity:.86;filter:drop-shadow(0 12px 18px rgba(0,0,0,.48)) saturate(.9)}
.attic-prop.spend{animation:atticPropSpend .38s ease}
@keyframes atticPropSpend{0%{transform:translateY(0) rotate(0deg)}35%{transform:translateY(-9px) rotate(-1.4deg)}100%{transform:translateY(0) rotate(0deg)}}
#candlelightHud{position:absolute;left:14px;top:12px;z-index:14;display:flex;gap:6px;align-items:center;padding:7px 9px;border:1px solid rgba(155,111,55,.55);border-radius:999px;background:rgba(15,9,5,.54);box-shadow:0 10px 28px rgba(0,0,0,.45)}
.candlelight-icon{width:34px;height:34px;background-size:contain;background-position:center;background-repeat:no-repeat;transition:opacity .25s ease,transform .25s ease}
.candlelight-icon.on{background-image:url('ui/candle_flame_on.png')}
.candlelight-icon.off{background-image:url('ui/candle_flame_off.png');opacity:.48;transform:scale(.92)}
#atticWhisper{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:16;min-width:min(82vw,420px);max-width:min(90vw,560px);min-height:62px;padding:18px 28px 20px;background:url('ui/attic_whisper_plaque.png') center/100% 100% no-repeat;color:#ead9b5;text-align:center;font:700 14px Georgia,serif;text-shadow:0 2px 8px rgba(0,0,0,.9);opacity:0;pointer-events:none;transition:opacity .25s ease}
#atticWhisper.show{opacity:1}
#atticPickup{position:absolute;left:50%;top:55%;z-index:18;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 20px;background:rgba(18,11,6,.88);border:1px solid rgba(194,148,75,.65);border-radius:12px;box-shadow:0 22px 60px rgba(0,0,0,.75),0 0 24px rgba(255,202,101,.2);cursor:pointer;animation:atticPickupIn .34s ease forwards}
#atticPickup img{width:112px;height:112px;object-fit:cover;border-radius:4px;box-shadow:0 8px 22px rgba(0,0,0,.6)}
#atticPickup b{font-size:13px;color:#ffd978;text-align:center;line-height:1.25}
#atticPickup span{font:800 10px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#b99a5d}
@keyframes atticPickupIn{0%{opacity:0;transform:translate(-50%,-45%) scale(.92);filter:blur(6px)}100%{opacity:1;transform:translate(-50%,-50%) scale(1);filter:blur(0)}}
`;
  html = html.replace('</style>', css + '\n</style>');
}

if (!html.includes('<div id="atticScene"')) {
  const scene = '<div id="atticScene" aria-hidden="true"><div id="candlelightHud"></div><div id="atticObjects"></div><div id="atticWhisper"></div></div>\n';
  html = html.replace('<div id="summary"></div>', scene + '<div id="summary"></div>');
}

if (!html.includes(jsMarker)) {
  const js = `
${jsMarker}
(function(){
  let inAttic=false;
  let resetOnLeave=false;
  let candleCount=0;
  let maxCandles=0;
  let searched={};
  let awaitingPickup=false;
  const objects={
    newspaper_stack_01:{id:'newspaper_stack_01',label:'Stack of Newspapers',verb:'Move aside',cost:1,before:'props/newspaper_stack_closed.png',after:'props/newspaper_stack_moved.png',left:'7%',top:'67%',width:'42%',height:'22%',itemId:'clipping_01',itemTitle:'Strange Obituary',thumb:'strange_obituary.png'},
    covered_frame_01:{id:'covered_frame_01',label:'Covered Frame',verb:'Lift cloth',cost:1,before:'props/covered_frame_closed.png',after:'props/covered_frame_uncovered.png',left:'57%',top:'28%',width:'42%',height:'43%',itemId:'photo_01',itemTitle:'The Reading Room',thumb:'Reading_room.png'},
    coat_01:{id:'coat_01',label:'Old Coat',verb:'Check pocket',cost:1,before:'props/old_coat_closed.png',after:'props/old_coat_searched.png',left:'17%',top:'30%',width:'39%',height:'44%',itemId:'letter_01',itemTitle:'Unsigned Letter',thumb:'handwritten_note.png'}
  };
  function candlesFromScore(score){if(score>=1000)return 7;if(score>=700)return 6;if(score>=450)return 5;if(score>=250)return 4;if(score>=100)return 3;if(score>=50)return 2;return 1;}
  function renderCandles(){const h=document.getElementById('candlelightHud');if(!h)return;let out='';const n=Math.max(1,maxCandles||candleCount||1);for(let i=0;i<n;i++)out+='<span class="candlelight-icon '+(i<candleCount?'on':'off')+'"></span>';h.innerHTML=out;}
  function whisper(text,duration){const w=document.getElementById('atticWhisper');if(!w)return;w.textContent=text;w.classList.add('show');clearTimeout(whisper.t);whisper.t=setTimeout(function(){w.classList.remove('show')},duration||2600);}
  function renderObjects(){
    const root=document.getElementById('atticObjects');if(!root)return;root.innerHTML='';
    Object.keys(objects).forEach(function(k){const o=objects[k];const done=!!searched[o.id];const el=document.createElement('div');el.className='attic-prop'+(done?' searched':'');el.style.left=o.left;el.style.top=o.top;el.style.width=o.width;el.style.height=o.height;el.style.backgroundImage='url("'+(done?o.after:o.before)+'")';el.setAttribute('role','button');el.setAttribute('aria-label',done?(o.label+' already searched'):(o.verb+' '+o.label));el.addEventListener('click',function(e){e.stopPropagation();rummage(o.id,el);});root.appendChild(el);});
  }
  function saveFound(itemId){try{const key='tlr_attic_found_items';const arr=JSON.parse(localStorage.getItem(key)||'[]');if(!arr.includes(itemId)){arr.push(itemId);localStorage.setItem(key,JSON.stringify(arr));}}catch(e){}}
  function showPickup(o){
    awaitingPickup=true;document.querySelectorAll('#atticPickup').forEach(function(p){p.remove();});
    const p=document.createElement('div');p.id='atticPickup';p.innerHTML='<img src="'+o.thumb+'" alt=""><b>'+o.itemTitle+'</b><span>Take</span>';p.addEventListener('click',function(e){e.stopPropagation();takePickup(o);});document.getElementById('atticScene').appendChild(p);
  }
  function takePickup(o){document.querySelectorAll('#atticPickup').forEach(function(p){p.remove();});awaitingPickup=false;saveFound(o.itemId);if(typeof renderInventory==='function')renderInventory();whisper('You take '+o.itemTitle+' back to the table.');if(candleCount<=0)setTimeout(leave,900);}
  function rummage(id,el){
    const o=objects[id];if(!o||awaitingPickup)return;
    if(searched[id]){whisper('You already searched there.');return;}
    if(candleCount<o.cost){whisper('The candle is almost gone.');return;}
    candleCount-=o.cost;searched[id]=true;renderCandles();if(el){el.classList.add('spend');setTimeout(function(){el.classList.remove('spend')},420);}setTimeout(function(){renderObjects();showPickup(o);whisper('You find '+o.itemTitle+'.');},260);
  }
  function enter(candles,shouldReset){
    inAttic=true;resetOnLeave=!!shouldReset;maxCandles=Math.max(1,Number(candles)||1);candleCount=maxCandles;searched={};awaitingPickup=false;renderCandles();renderObjects();
    document.body.classList.remove('mode-reading','mode-to-table','mode-table-return');document.body.classList.add('mode-to-attic');
    const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','false');
    setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic');whisper('You get up from the table. Spend Candlelight to search.');},900);
  }
  function leave(){
    if(!inAttic)return;inAttic=false;document.querySelectorAll('#atticPickup').forEach(function(p){p.remove();});
    document.body.classList.remove('mode-attic','mode-to-attic','mode-reading');document.body.classList.add('mode-to-table');
    const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');
    setTimeout(function(){if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}document.body.classList.remove('mode-to-table');document.body.classList.add('mode-reading','mode-table-return');},720);
    setTimeout(function(){document.body.classList.remove('mode-table-return');},1650);
  }
  window.tlrScoreToCandlelight=candlesFromScore;
  window.tlrDebugEnterAttic=enter;
  window.tlrDebugLeaveAttic=leave;
  window.tlrEnterAtticAfterReading=function(score){enter(candlesFromScore(Number(score)||0),true);};
  document.addEventListener('keydown',function(e){if(e.shiftKey&&e.key==='A'){inAttic?leave():enter(3,false);}});
  window.addEventListener('DOMContentLoaded',function(){const scene=document.getElementById('atticScene');if(scene)scene.addEventListener('click',function(){if(inAttic&&!awaitingPickup)leave();});});
})();
`;
  html = html.replace('</script>', js + '\n</script>');
}

const inventoryOld = "const allItems=[...INV_ITEMS,...getUnlockedFragments().map(id=>INV_FRAGMENTS[id]).filter(Boolean)];";
const inventoryNew = "const foundAtticItems=(()=>{try{return JSON.parse(localStorage.getItem('tlr_attic_found_items')||'[]')}catch(e){return []}})();const allItems=[...INV_ITEMS.filter(item=>foundAtticItems.includes(item.id)),...getUnlockedFragments().map(id=>INV_FRAGMENTS[id]).filter(Boolean)];";
if (html.includes(inventoryOld)) {
  html = html.replace(inventoryOld, inventoryNew);
}

const oldEnd = "function endSession(){showOverlay(`<div class=\"result-panel pass\"><div class=\"rhead\"><span class=\"rorn\">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class=\"pass\">The Session Ends</h3></div><div class=\"rscore\"><span class=\"rsf\">${persist.totalScore||0}</span></div><span class=\"rverdict pass\">Total Score</span><div class=\"rbtns\"><button class=\"btn-gold\" onclick=\"resetSession()\">Begin Again</button></div></div>`)}function resetSession(){";
const newEnd = "function endSession(){const total=persist.totalScore||0;const candles=window.tlrScoreToCandlelight?window.tlrScoreToCandlelight(total):1;showOverlay(`<div class=\"result-panel pass\"><div class=\"rhead\"><span class=\"rorn\">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class=\"pass\">The Reading Ends</h3></div><div class=\"rscore\"><span class=\"rsf\">${total}</span></div><span class=\"rverdict pass\">Total Score</span><div class=\"rscore\" style=\"margin-top:10px\"><span class=\"rsf\" style=\"font-size:32px\">${candles}</span></div><span class=\"rverdict pass\">Candlelight</span><p style=\"margin:16px 0 0;color:#8a7551;font-size:12px;text-align:center\">Tap to close.</p></div>`);const s=document.getElementById('summary');const openedAt=Date.now();const go=function(){if(Date.now()-openedAt<250)return;s.removeEventListener('click',go);clearOverlay();if(window.tlrDebugEnterAttic)window.tlrDebugEnterAttic(candles,true);};s.addEventListener('click',go)}function resetSession(){";
if (html.includes(oldEnd)) {
  html = html.replace(oldEnd, newEnd);
} else {
  console.warn('Attic end screen hook not applied; original endSession signature was not found.');
}

fs.writeFileSync(file, html);
console.log('Applied attic drawer found-item filter patch.');
