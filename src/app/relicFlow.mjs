// Relic flow adapter for the final index.html cleanup.
// Provides module-owned equivalents for relic acquisition/replacement and the
// Watcher relic without overriding inline handlers while they still exist.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state;}
function persistOf(target){return runtime(target).persist || {};}
function market(target){return target.tlrMarketFlow || {};}

function markReturningToMarket(target = window){
  const doc = target.document;
  if(!doc || doc.querySelector('.store-front-shell:not(.store-exiting)'))return;
  const summary = doc.getElementById('summary');
  if(!summary)return;
  const marker = doc.createElement('div');
  marker.className = 'store-front-shell';
  marker.style.display = 'none';
  marker.innerHTML = '<div class="store-front"></div>';
  summary.appendChild(marker);
}

function returnToMarket(target = window){
  markReturningToMarket(target);
  if(typeof target.openShopMain==='function')target.openShopMain();
}

export function relicSlots(target = window){
  return typeof market(target).relicSlots==='function'?market(target).relicSlots(target):3+Math.min((persistOf(target).up||{}).relicSlot||0,2);
}

export function showRelicSlotsFullToast(target = window){
  if(typeof target.showToast==='function')setTimeout(()=>target.showToast('Relic slots full — your next relic will replace one you already carry.'),600);
}

export function markRelicTutorialPending(target = window){
  const firstRelic=!target.localStorage.getItem('tlr_tut_relic');
  if(firstRelic){target.localStorage.setItem('tlr_tut_relic','1');target._pendingRelicTut=true;}
}

export function doAcquireRelic(key,afterFn,target = window){
  const purchased=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'relic',relicId:key}):false;
  if(purchased!==true){if(typeof afterFn==='function')afterFn();return purchased;}
  if(typeof target.renderRelicRack==='function')target.renderRelicRack();
  if((persistOf(target).relics||[]).length>=relicSlots(target))showRelicSlotsFullToast(target);
  markRelicTutorialPending(target);
  if(typeof afterFn==='function')afterFn();
  return true;
}

export function acquireRelicFree(key,target = window){
  const persist=persistOf(target);
  const after=()=>returnToMarket(target);
  if((persist.relics||[]).length<relicSlots(target))return doAcquireRelic(key,after,target);
  return showRelicReplace(key,after,target);
}

export function acquireRelic(key,target = window){
  const persist=persistOf(target);
  const after=()=>returnToMarket(target);
  if((persist.relics||[]).length<relicSlots(target))return doAcquireRelic(key,after,target);
  return showRelicReplace(key,after,target);
}

export function showRelicReplace(newKey,afterFn,target = window){
  const rt=market(target).marketRuntime?market(target).marketRuntime(target):target.__tlrMarketRuntime;
  if(rt)rt.replaceSelectedKey=null;
  const persist=persistOf(target);
  const relics=target.RELICS||{};
  const nextRelic=relics[newKey];
  if(!nextRelic||typeof target.showOverlay!=='function')return false;
  let html='<div class="summary tarot-shop relic-replace-screen">';
  html+=`<div class="pack-picker-header"><h3>Relic Slots Full</h3><p>Your collection is full. Select a relic to replace it with <b>${nextRelic.name}</b>.</p></div>`;
  html+='<div class="shop-items-row relic-picker-row">';
  for(const k of persist.relics||[]){
    const r=relics[k];
    if(!r)continue;
    const style=typeof target.relicIconStyle==='function'?target.relicIconStyle(k,64):'';
    html+=`<div class="upg-card relic-option relic-replace-card ${r.rarity}" id="rrc-${k}" onclick="selectRelicReplace('${k}','${newKey}')">
      <div class="upg-title-strip relic-title-strip"><span>${r.name}</span></div>
      <div class="upg-art relic-art"><div class="relic-art-sprite" style="${style}"></div></div>
      <div class="upg-body"><div class="upg-desc">${r.desc}</div></div>
      <div class="upg-footer relic-replace-footer" id="rrf-${k}"><span class="relic-replace-hint">Tap to replace</span></div>
    </div>`;
  }
  html+='</div>';
  target._relicReplaceAfter=afterFn;
  html+='<div style="text-align:center;margin-top:8px"><button onclick="window._relicReplaceAfter&&window._relicReplaceAfter()" style="background:transparent;border:none;color:#8a7551;font-size:12px;cursor:pointer;text-decoration:underline">Cancel</button></div>';
  html+='</div>';
  target.showOverlay(html);
  return true;
}

export function selectRelicReplace(oldKey,newKey,target = window){
  const rt=market(target).marketRuntime?market(target).marketRuntime(target):(target.__tlrMarketRuntime ||= {});
  if(rt.replaceSelectedKey===oldKey){
    if(typeof target.tlrMarketPurchase==='function')target.tlrMarketPurchase({kind:'relic',relicId:newKey,replaceRelicId:oldKey});
    if(typeof target.renderRelicRack==='function')target.renderRelicRack();
    rt.replaceSelectedKey=null;
    markRelicTutorialPending(target);
    const after=target._relicReplaceAfter||(()=>returnToMarket(target));
    if(typeof after==='function')after();
    return true;
  }
  document.querySelectorAll('.relic-replace-card').forEach(el=>el.classList.remove('relic-replace-selected'));
  document.querySelectorAll('.relic-replace-footer').forEach(el=>{el.innerHTML='<span class="relic-replace-hint">Tap to replace</span>';});
  rt.replaceSelectedKey=oldKey;
  const card=document.getElementById('rrc-'+oldKey);
  const footer=document.getElementById('rrf-'+oldKey);
  if(card)card.classList.add('relic-replace-selected');
  if(footer)footer.innerHTML=`<button class="sbtn sbtn-pick relic-replace-confirm" onclick="selectRelicReplace('${oldKey}','${newKey}');event.stopPropagation()" aria-label="Confirm replace"></button>`;
  return true;
}

export function closeRelicDescription(target = window){
  const doc=target.document;
  if(!doc)return false;
  const hadOpenKey=target._openRelicKey!==null&&target._openRelicKey!==undefined;
  const callouts=[...doc.querySelectorAll('.relic-callout')];
  if(!hadOpenKey&&!callouts.length)return false;
  callouts.forEach(el=>el.remove());
  target._openRelicKey=null;
  const rt=market(target).marketRuntime?market(target).marketRuntime(target):target.__tlrMarketRuntime;
  if(rt)rt.openRelicKey=null;
  return true;
}

function installRelicDescriptionDismiss(target = window){
  if(!target||target.__tlrRelicDescriptionDismissInstalled)return;
  const doc=target.document;
  if(!doc)return;
  target.__tlrRelicDescriptionDismissInstalled=true;
  doc.addEventListener('click',event=>{
    if(target._openRelicKey===null||target._openRelicKey===undefined)return;
    const source=event.target;
    if(source&&typeof source.closest==='function'&&source.closest('.relic-btn'))return;
    const defer=typeof target.setTimeout==='function'?target.setTimeout.bind(target):setTimeout;
    defer(()=>closeRelicDescription(target),0);
  },true);
}

export function activateRelic(key,target = window){
  const persist=persistOf(target);
  const state=stateOf(target);
  if(persist.relicUsed&&persist.relicUsed[key])return false;
  if(key==='watcher'){
    if(!state.deck.length)return false;
    const top=state.deck.splice(0,Math.min(3,state.deck.length));
    persist.relicUsed[key]=true;
    closeRelicDescription(target);
    let html='<div class="box" style="max-width:520px;width:min(90vw,520px)">';
    html+='<div class="modalHead"><h2>The Watcher</h2></div>';
    html+='<p style="color:#b99a5d;font-size:12px">Choose one card to take into your hand. The rest return to the bottom of your deck.</p>';
    html+='<div class="choices">';
    for(const c of top){html+=`<div class="card ${c.type==='major'?'major':''}" onclick="watcherPick(${c.uid})" style="cursor:pointer">${target.cardHTML(c)}</div>`;}
    html+='</div></div>';
    state._watcherCards=top;
    const modal=document.getElementById('modal');
    if(modal){modal.innerHTML=html;modal.classList.add('show');}
    if(typeof target.renderRelicRack==='function')target.renderRelicRack();
    return true;
  }
  return false;
}

export function watcherPick(uid,target = window){
  const state=stateOf(target);
  const top=state._watcherCards||[];
  const card=top.find(c=>c.uid===uid);
  if(!card)return false;
  state.hand.push(card);
  state.deck.push(...top.filter(c=>c.uid!==uid));
  state._watcherCards=null;
  const modal=document.getElementById('modal');
  if(modal)modal.classList.remove('show');
  if(typeof target.render==='function')target.render();
  return true;
}

export function installRelicFlow(target = window){
  if(!target || target.__tlrRelicFlowInstalled)return;
  target.__tlrRelicFlowInstalled=true;
  installRelicDescriptionDismiss(target);
  const api={relicSlots,doAcquireRelic,acquireRelicFree,acquireRelic,showRelicReplace,selectRelicReplace,closeRelicDescription,activateRelic,watcherPick};
  target.tlrRelicFlow=api;
  if(typeof target.relicSlots!=='function')target.relicSlots=()=>relicSlots(target);
  if(typeof target.doAcquireRelic!=='function')target.doAcquireRelic=(key,afterFn)=>doAcquireRelic(key,afterFn,target);
  if(typeof target.acquireRelicFree!=='function')target.acquireRelicFree=key=>acquireRelicFree(key,target);
  if(typeof target.acquireRelic!=='function')target.acquireRelic=key=>acquireRelic(key,target);
  if(typeof target.showRelicReplace!=='function')target.showRelicReplace=(newKey,afterFn)=>showRelicReplace(newKey,afterFn,target);
  if(typeof target.selectRelicReplace!=='function')target.selectRelicReplace=(oldKey,newKey)=>selectRelicReplace(oldKey,newKey,target);
  if(typeof target.closeRelicDescription!=='function')target.closeRelicDescription=()=>closeRelicDescription(target);
  if(typeof target.activateRelic!=='function')target.activateRelic=key=>activateRelic(key,target);
  if(typeof target.watcherPick!=='function')target.watcherPick=uid=>watcherPick(uid,target);
}
