const fs = require('fs');
const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const cssMarker = '/* ── Attic MVP outer loop patch ── */';
const jsMarker = '// ── Attic MVP outer loop patch ──';

// 1) Light fiction/copy pass. Keep the working tarot loop intact.
html = html.replace('<button id="invTab">&#9660; Archives</button>', '<button id="invTab">&#9660; Attic Drawer</button>');
html = html.replace(/invOpen\?'&#9650; Archives':'&#9660; Archives'/g, "invOpen?'&#9650; Attic Drawer':'&#9660; Attic Drawer'");
html = html.replace('Your relative passed away recently, leaving behind their tarot deck. You used to play this game with them using it.', 'Your aunt Sophia made you promise that when she was gone, you would keep playing the tarot game you used to play together.');
html = html.replace('The <b>Archives</b> hold items discoved among the personal effects of your deceased relative. Tap to open and investigate.', 'The <b>Attic Drawer</b> holds objects you bring back from Sophia\'s attic. Tap to open and investigate.');

// 2) Add CSS for the attic scene, Candlelight, pickups, plaques, and transitions.
if (!html.includes(cssMarker)) {
  const css = `
${cssMarker}
#atticScene{position:fixed;inset:0;z-index:520;opacity:0;pointer-events:none;background:url('the_last_reading_attic_mvp_assets/backgrounds/attic_room_mvp_1080x1920.png') center center/cover no-repeat;transition:opacity .9s ease,filter .9s ease,transform 1.15s cubic-bezier(.22,.8,.22,1);transform:scale(1.04);filter:blur(2px);overflow:hidden;color:#ead9b5;font-family:Georgia,serif}
#atticScene::before{content:'';position:absolute;inset:0;background:url('the_last_reading_attic_mvp_assets/fx/transition_dark_vignette_1080x1920.png') center center/cover no-repeat;pointer-events:none;opacity:.72;z-index:1}
#atticScene::after{content:'';position:absolute;inset:0;background:url('the_last_reading_attic_mvp_assets/fx/table_to_attic_fog_overlay_1080x1920.png') center center/cover no-repeat;pointer-events:none;opacity:.36;z-index:2;mix-blend-mode:screen}
body.mode-to-attic #atticScene,body.mode-attic #atticScene{opacity:1;filter:none;transform:scale(1);pointer-events:auto}
body.mode-to-table #atticScene{opacity:0;filter:blur(3px);transform:scale(1.04);pointer-events:none}
body.mode-to-attic #titleWrap,body.mode-to-attic .score-stack,body.mode-to-attic .spread-wrap,body.mode-to-attic .handDock,body.mode-to-attic #relicRack,body.mode-to-attic #invWrap,body.mode-to-attic .refs-layer{opacity:0;transform:scale(.9) translateY(14vh);filter:blur(2px);pointer-events:none;transition:opacity .75s ease,transform 1.1s cubic-bezier(.22,.8,.22,1),filter .75s ease}
body.mode-attic #titleWrap,body.mode-attic .score-stack,body.mode-attic .spread-wrap,body.mode-attic .handDock,body.mode-attic #relicRack,body.mode-attic #invWrap,body.mode-attic .refs-layer{opacity:0!important;pointer-events:none!important;filter:blur(3px);transform:scale(.88) translateY(18vh)}
body.mode-to-table #titleWrap,body.mode-to-table .score-stack,body.mode-to-table .spread-wrap,body.mode-to-table .handDock,body.mode-to-table #relicRack,body.mode-to-table #invWrap,body.mode-to-table .refs-layer{opacity:1;transform:none;filter:none;transition:opacity .85s ease,transform 1.15s cubic-bezier(.22,.8,.22,1),filter .85s ease}
#atticObjects{position:absolute;inset:0;z-index:6}
.attic-prop{position:absolute;background-size:contain;background-repeat:no-repeat;background-position:center;touch-action:none;user-select:none;cursor:pointer;filter:drop-shadow(0 16px 22px rgba(0,0,0,.58));transition:transform .18s ease,filter .18s ease,opacity .18s ease}
.attic-prop:hover,.attic-prop:active{transform:translateY(-5px) scale(1.015);filter:drop-shadow(0 20px 28px rgba(0,0,0,.72)) drop-shadow(0 0 12px rgba(255,209,112,.3))}
.attic-prop.searched{opacity:.82;filter:drop-shadow(0 12px 18px rgba(0,0,0,.48)) saturate(.88)}
.attic-prop.spend{animation:atticPropSpend .38s ease}
@keyframes atticPropSpend{0%{transform:translateY(0) rotate(0deg)}35%{transform:translateY(-9px) rotate(-1.4deg)}100%{transform:translateY(0) rotate(0deg)}}
#candlelightHud{position:absolute;left:max(14px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));z-index:14;display:flex;gap:6px;align-items:center;padding:7px 9px;border:1px solid rgba(155,111,55,.55);border-radius:999px;background:rgba(15,9,5,.54);box-shadow:0 10px 28px rgba(0,0,0,.45)}
.candlelight-icon{width:34px;height:34px;background-size:contain;background-position:center;background-repeat:no-repeat;transition:opacity .25s ease,transform .25s ease}
.candlelight-icon.on{background-image:url('the_last_reading_attic_mvp_assets/ui/candle_flame_on.png')}
.candlelight-icon.off{background-image:url('the_last_reading_attic_mvp_assets/ui/candle_flame_off.png');opacity:.48;transform:scale(.92)}
#atticWhisper{position:absolute;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:16;min-width:min(82vw,420px);max-width:min(90vw,560px);min-height:62px;padding:18px 28px 20px;background:url('the_last_reading_attic_mvp_assets/ui/attic_whisper_plaque.png') center/100% 100% no-repeat;color:#ead9b5;text-align:center;font:700 14px Georgia,serif;text-shadow:0 2px 8px rgba(0,0,0,.9);opacity:0;pointer-events:none;transition:opacity .25s ease}
#atticWhisper.show{opacity:1}
#atticPickup{position:absolute;left:50%;top:55%;z-index:18;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 20px;background:rgba(18,11,6,.88);border:1px solid rgba(194,148,75,.65);border-radius:12px;box-shadow:0 22px 60px rgba(0,0,0,.75),0 0 24px rgba(255,202,101,.2);cursor:pointer;animation:atticPickupIn .34s ease forwards}
#atticPickup img{width:112px;height:112px;object-fit:cover;border-radius:4px;box-shadow:0 8px 22px rgba(0,0,0,.6)}
#atticPickup b{font-size:13px;color:#ffd978;text-align:center;line-height:1.25}
#atticPickup span{font:800 10px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#b99a5d}
@keyframes atticPickupIn{0%{opacity:0;transform:translate(-50%,-45%) scale(.92);filter:blur(6px)}100%{opacity:1;transform:translate(-50%,-50%) scale(1);filter:blur(0)}}
.attic-action-hint{position:absolute;z-index:17;min-width:220px;max-width:280px;padding:14px 20px 18px;background:url('the_last_reading_attic_mvp_assets/ui/attic_action_plaque.png') center/100% 100% no-repeat;color:#ead9b5;text-align:center;font:700 12px Georgia,serif;text-shadow:0 2px 8px rgba(0,0,0,.9);pointer-events:none;opacity:0;transition:opacity .2s ease,transform .2s ease;transform:translate(-50%,-12px)}
.attic-action-hint.show{opacity:1;transform:translate(-50%,-22px)}
@media(max-width:640px){#candlelightHud{gap:3px;padding:5px 7px}.candlelight-icon{width:28px;height:28px}#atticWhisper{font-size:12px;min-height:52px;padding:14px 20px 17px}#atticPickup img{width:92px;height:92px}.attic-action-hint{min-width:190px;font-size:11px}}
/* end Attic MVP outer loop patch */
`;
  html = html.replace('</style>', css + '\n</style>');
}

// 3) Add attic scene HTML layer.
if (!html.includes('<div id="atticScene"')) {
  const atticHtml = `<div id="atticScene" aria-hidden="true"><div id="candlelightHud"></div><div id="atticObjects"></div><div id="atticWhisper"></div></div>\n`;
  html = html.replace('<div id="summary"></div>', atticHtml + '<div id="summary"></div>');
}

// 4) Change final session end screen into final Reading -> Candlelight -> attic hook.
if (!html.includes('tlrScoreToCandlelight(total)')) {
  const endSessionRegex = /function endSession\(\)\{showOverlay\(`[\s\S]*?`\)\}function resetSession\(\)/;
  const replacement = `function endSession(){
  const total=persist.totalScore||0;
  const candles=tlrScoreToCandlelight(total);
  tlrAtticGame.pendingCandlelight=candles;
  showOverlay('<div class="result-panel pass end-reading-panel"><div class="rhead"><span class="rorn">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class="pass">The Reading Ends</h3></div><div class="rscore"><span class="rsf">'+total+'</span></div><span class="rverdict pass">Total Score</span><div class="rscore" style="margin-top:10px"><span class="rsf" style="font-size:32px">'+candles+'</span></div><span class="rverdict pass">Candlelight</span><p style="margin:16px 0 0;color:#8a7551;font-size:12px;text-align:center">Tap to close.</p></div>');
  const summary=document.getElementById('summary');
  const openedAt=Date.now();
  const handler=function(e){
    if(Date.now()-openedAt<280)return;
    summary.removeEventListener('click',handler);
    beginTableToAtticTransition();
  };
  summary.addEventListener('click',handler);
}function resetSession()`;
  if (!endSessionRegex.test(html)) {
    throw new Error('Could not find endSession() block to replace.');
  }
  html = html.replace(endSessionRegex, replacement);
}

// 5) Drawer should show base items only after attic finds. Story fragments remain unlocked by resonation.
const oldInventoryLine = "const allItems=[...INV_ITEMS,...getUnlockedFragments().map(id=>INV_FRAGMENTS[id]).filter(Boolean)];";
const newInventoryLine = "const allItems=[...INV_ITEMS.filter(item=>tlrFoundItems().includes(item.id)),...getUnlockedFragments().map(id=>INV_FRAGMENTS[id]).filter(Boolean)];";
if (html.includes(oldInventoryLine)) {
  html = html.replace(oldInventoryLine, newInventoryLine);
}

// 6) Add attic state, save helpers, object data, transitions, and rummage behavior.
if (!html.includes(jsMarker)) {
  const js = `
${jsMarker}
const TLR_ATTIC_ASSET_ROOT='the_last_reading_attic_mvp_assets/';
const TLR_SAVE_KEY='tlr_save_v1';
let tlrAtticGame={mode:'reading',candlelight:0,pendingCandlelight:0,pendingFinds:[],awaitingPickup:null,returning:false};
function tlrCreateDefaultSave(){return{foundItems:[],attic:{searchedObjects:{},movedObjects:{}},itemStates:{},expansions:{owned:[],subscriptionActive:false}}}
function tlrLoadSave(){try{const raw=localStorage.getItem(TLR_SAVE_KEY);if(!raw)return tlrCreateDefaultSave();const parsed=JSON.parse(raw);return Object.assign(tlrCreateDefaultSave(),parsed,{attic:Object.assign({searchedObjects:{},movedObjects:{}},parsed.attic||{})})}catch(e){return tlrCreateDefaultSave()}}
let tlrSave=tlrLoadSave();
function tlrSaveGame(){try{localStorage.setItem(TLR_SAVE_KEY,JSON.stringify(tlrSave))}catch(e){}}
function tlrFoundItems(){return(tlrSave&&Array.isArray(tlrSave.foundItems))?tlrSave.foundItems:[]}
function tlrMarkItemFound(itemId){if(!itemId)return;if(!tlrSave.foundItems)tlrSave.foundItems=[];if(!tlrSave.foundItems.includes(itemId)){tlrSave.foundItems.push(itemId);tlrSaveGame();}}
function tlrScoreToCandlelight(totalScore){if(totalScore>=1000)return 7;if(totalScore>=700)return 6;if(totalScore>=450)return 5;if(totalScore>=250)return 4;if(totalScore>=100)return 3;if(totalScore>=50)return 2;return 1}
const TLR_ATTIC_OBJECTS={
  newspaper_stack_01:{id:'newspaper_stack_01',label:'Stack of Newspapers',verb:'Move aside',cost:1,before:'props/newspaper_stack_closed.png',after:'props/newspaper_stack_moved.png',left:'7%',top:'67%',width:'42%',height:'22%',result:{type:'item',itemId:'clipping_01'},exhaustedText:'Only dust and old print remain.'},
  covered_frame_01:{id:'covered_frame_01',label:'Covered Frame',verb:'Lift cloth',cost:1,before:'props/covered_frame_closed.png',after:'props/covered_frame_uncovered.png',left:'57%',top:'28%',width:'42%',height:'43%',result:{type:'item',itemId:'photo_01'},exhaustedText:'The frame is bare now.'},
  coat_01:{id:'coat_01',label:'Old Coat',verb:'Check pocket',cost:1,before:'props/old_coat_closed.png',after:'props/old_coat_searched.png',left:'17%',top:'30%',width:'39%',height:'44%',result:{type:'item',itemId:'letter_01'},exhaustedText:'The pockets are empty.'}
};
function tlrAtticAsset(p){return TLR_ATTIC_ASSET_ROOT+p}
function beginTableToAtticTransition(){
  if(tlrAtticGame.mode==='attic'||tlrAtticGame.mode==='to_attic')return;
  clearOverlay();
  closeRefs&&closeRefs();
  tlrAtticGame.candlelight=tlrAtticGame.pendingCandlelight||1;
  tlrAtticGame.pendingFinds=[];
  tlrAtticGame.awaitingPickup=null;
  tlrAtticGame.returning=false;
  tlrAtticGame.mode='to_attic';
  document.body.classList.remove('mode-reading','mode-to-table');
  document.body.classList.add('mode-to-attic');
  const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','false');
  renderAttic();
  setTimeout(function(){
    document.body.classList.remove('mode-to-attic');
    document.body.classList.add('mode-attic');
    tlrAtticGame.mode='attic';
    renderAttic();
    tlrShowAtticWhisper('You get up from the table. The attic waits.');
  },1050);
}
function beginAtticToTableTransition(){
  if(tlrAtticGame.returning)return;
  tlrAtticGame.returning=true;
  tlrAtticGame.mode='to_table';
  tlrShowAtticWhisper('The candle gutters. You carry what you found back to the table.');
  setTimeout(function(){
    document.body.classList.remove('mode-attic');
    document.body.classList.add('mode-to-table');
    const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');
  },650);
  setTimeout(function(){
    document.body.classList.remove('mode-to-table');
    document.body.classList.add('mode-reading');
    tlrAtticGame.mode='reading';
    tlrAtticGame.candlelight=0;
    tlrAtticGame.pendingFinds=[];
    tlrAtticGame.awaitingPickup=null;
    tlrAtticGame.returning=false;
    renderInventory();
    resetSession();
  },1750);
}
function renderAttic(){renderCandlelightHud();renderAtticObjects();}
function renderCandlelightHud(){
  const hud=document.getElementById('candlelightHud');if(!hud)return;
  const max=Math.max(1,tlrAtticGame.pendingCandlelight||tlrAtticGame.candlelight||1);
  let html='';
  for(let i=0;i<max;i++)html+='<span class="candlelight-icon '+(i<tlrAtticGame.candlelight?'on':'off')+'"></span>';
  hud.innerHTML=html;
}
function renderAtticObjects(){
  const root=document.getElementById('atticObjects');if(!root)return;
  root.innerHTML='';
  Object.keys(TLR_ATTIC_OBJECTS).forEach(function(key){
    const obj=TLR_ATTIC_OBJECTS[key];
    const searched=!!(tlrSave.attic&&tlrSave.attic.searchedObjects&&tlrSave.attic.searchedObjects[obj.id]);
    const el=document.createElement('div');
    el.className='attic-prop'+(searched?' searched':'');
    el.dataset.atticObjectId=obj.id;
    el.style.left=obj.left;el.style.top=obj.top;el.style.width=obj.width;el.style.height=obj.height;
    el.style.backgroundImage='url("'+tlrAtticAsset(searched?obj.after:obj.before)+'")';
    el.setAttribute('role','button');
    el.setAttribute('aria-label',(searched?obj.exhaustedText:(obj.verb+' '+obj.label+', costs '+obj.cost+' Candlelight')));
    el.addEventListener('mouseenter',function(){tlrShowActionHint(el,obj,searched)});
    el.addEventListener('mouseleave',function(){tlrHideActionHint()});
    el.addEventListener('click',function(e){e.stopPropagation();tlrAttemptRummage(obj.id,el)});
    root.appendChild(el);
  });
}
function tlrShowActionHint(el,obj,searched){
  tlrHideActionHint();
  const hint=document.createElement('div');hint.className='attic-action-hint';
  hint.innerHTML=searched?'<b>'+obj.label+'</b><br>'+obj.exhaustedText:'<b>'+obj.verb+'</b><br>'+obj.cost+' Candlelight';
  document.getElementById('atticScene').appendChild(hint);
  const r=el.getBoundingClientRect();const sr=document.getElementById('atticScene').getBoundingClientRect();
  hint.style.left=(r.left-sr.left+r.width/2)+'px';hint.style.top=(r.top-sr.top)+'px';
  requestAnimationFrame(function(){hint.classList.add('show')});
}
function tlrHideActionHint(){document.querySelectorAll('.attic-action-hint').forEach(function(e){e.remove()})}
function tlrItemById(id){return INV_ITEMS.find(function(item){return item.id===id})}
function tlrShowAtticWhisper(text,duration){
  const el=document.getElementById('atticWhisper');if(!el)return;
  el.innerHTML=text;el.classList.add('show');
  clearTimeout(tlrShowAtticWhisper._t);
  tlrShowAtticWhisper._t=setTimeout(function(){el.classList.remove('show')},duration||3200);
}
function tlrAttemptRummage(objectId,el){
  if(tlrAtticGame.mode!=='attic')return;
  if(tlrAtticGame.awaitingPickup){tlrShowAtticWhisper('Take what you found first.');return;}
  const obj=TLR_ATTIC_OBJECTS[objectId];if(!obj)return;
  if(tlrSave.attic.searchedObjects[obj.id]){tlrShowAtticWhisper(obj.exhaustedText||'You already searched there.');return;}
  if(tlrAtticGame.candlelight<obj.cost){tlrShowAtticWhisper('The candle is almost gone.');return;}
  tlrAtticGame.candlelight-=obj.cost;
  tlrSave.attic.searchedObjects[obj.id]=true;
  tlrSaveGame();
  if(el){el.classList.add('spend');setTimeout(function(){el.classList.remove('spend')},420)}
  renderCandlelightHud();
  setTimeout(function(){renderAtticObjects();tlrRevealRummageResult(obj.result,obj)},260);
}
function tlrRevealRummageResult(result,obj){
  if(!result){if(tlrAtticGame.candlelight<=0)beginAtticToTableTransition();return;}
  if(result.type==='item'){
    const item=tlrItemById(result.itemId);
    if(!item){if(tlrAtticGame.candlelight<=0)beginAtticToTableTransition();return;}
    tlrMarkItemFound(item.id);
    if(!tlrAtticGame.pendingFinds.includes(item.id))tlrAtticGame.pendingFinds.push(item.id);
    tlrAtticGame.awaitingPickup=item.id;
    tlrRenderAtticPickup(item);
    tlrShowAtticWhisper('You find '+item.title+'.');
    setTimeout(function(){if(tlrAtticGame.awaitingPickup===item.id)tlrCollectAtticItem(item.id)},4200);
    return;
  }
  if(tlrAtticGame.candlelight<=0)beginAtticToTableTransition();
}
function tlrRenderAtticPickup(item){
  document.querySelectorAll('#atticPickup').forEach(function(e){e.remove()});
  const pick=document.createElement('div');pick.id='atticPickup';
  const img=item.image?'<img src="'+item.image+'" alt="">':'<div style="font-size:54px">'+(item.emoji||'✦')+'</div>';
  pick.innerHTML=img+'<b>'+item.title+'</b><span>Take</span>';
  pick.addEventListener('click',function(e){e.stopPropagation();tlrCollectAtticItem(item.id)});
  document.getElementById('atticScene').appendChild(pick);
}
function tlrCollectAtticItem(itemId){
  document.querySelectorAll('#atticPickup').forEach(function(e){e.remove()});
  const item=tlrItemById(itemId);
  tlrMarkItemFound(itemId);
  tlrAtticGame.awaitingPickup=null;
  renderInventory();
  tlrShowAtticWhisper(item?('You take '+item.title+' back to the table.'):'You take it back to the table.');
  if(tlrAtticGame.candlelight<=0)setTimeout(beginAtticToTableTransition,950);
}
document.body.classList.add('mode-reading');
// end Attic MVP outer loop patch
`;
  html = html.replace('// ── Card zoom (scroll up or pinch-expand on any card) ──', js + '\n// ── Card zoom (scroll up or pinch-expand on any card) ──');
}

fs.writeFileSync(path, html);
console.log('Applied attic MVP patch.');
