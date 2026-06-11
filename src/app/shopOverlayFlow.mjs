// Shop overlay flow adapter.
// This prepares pack animation and pack-purchase ownership for the final
// index.html cleanup. Existing inline functions remain authoritative until deleted.

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || {};}
function market(target){return target.tlrMarketFlow || {};}

export function packAccent(packId){
  return packId==='relic'?'180,80,220':packId==='ritual'?'220,80,80':packId==='pattern'?'255,200,80':packId==='innate'?'255,150,60':packId==='restless'?'80,180,220':'180,160,100';
}

export function animatePackOpen(packId,callback,target = window){
  const pack=(target.PACKS||{})[packId];
  if(!pack){if(typeof callback==='function')callback();return false;}
  const overlay=document.getElementById('packAnim');
  const card=document.getElementById('packAnimCard');
  const icon=document.getElementById('packAnimIcon');
  const label=document.getElementById('packAnimLabel');
  const burst=document.getElementById('packAnimBurst');
  const glow=document.getElementById('packAnimGlow');
  const rays=document.getElementById('packAnimRays');
  if(!overlay||!card||!icon||!label||!burst||!glow||!rays){if(typeof callback==='function')callback();return false;}
  const accent=packAccent(packId);
  glow.style.background=`radial-gradient(circle at 50% 50%,rgba(${accent},.55),rgba(${accent},.12) 60%,transparent 80%)`;
  glow.style.boxShadow=`0 0 28px rgba(${accent},.7),0 0 60px rgba(${accent},.3)`;
  burst.style.background=`radial-gradient(circle,rgba(255,240,180,1) 0%,rgba(${accent},.8) 30%,rgba(${accent},.2) 60%,transparent 75%)`;
  icon.className='isp isp-56 '+pack.icon;
  label.textContent=pack.name;
  rays.innerHTML='';
  const rayCount=12;
  for(let i=0;i<rayCount;i+=1){
    const angle=(i/rayCount)*360;
    const len=140+Math.random()*80;
    const wrapper=document.createElement('div');
    wrapper.style.cssText=`position:absolute;left:50%;top:50%;width:2px;height:${len}px;transform-origin:50% 0%;transform:translateX(-50%) rotate(${angle}deg);pointer-events:none`;
    const inner=document.createElement('div');
    inner.style.cssText=`width:100%;height:100%;background:linear-gradient(rgba(${accent},.9),transparent);border-radius:1px;transform-origin:50% 0%;animation:paRay .4s ease-out forwards;animation-delay:${0.82+i*0.012}s`;
    wrapper.appendChild(inner);
    rays.appendChild(wrapper);
  }
  const srcEl=document.querySelector('.shop-pack-banner .isp.'+pack.icon);
  let dx=0,dy=0;
  if(srcEl){
    const r=srcEl.getBoundingClientRect();
    dx=(r.left+r.width/2)-window.innerWidth/2;
    dy=(r.top+r.height/2)-window.innerHeight/2;
    srcEl.style.opacity='0';
  }
  burst.style.opacity='0';burst.style.transform='scale(0)';
  rays.style.opacity='0';
  overlay.classList.remove('pa-dim');
  overlay.style.opacity='1';
  card.style.cssText=`opacity:1;transform:translate(${dx}px,${dy}px) scale(0.52);transition:none`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    overlay.classList.add('pa-dim');
    card.style.transition='transform .45s cubic-bezier(.2,.8,.2,1),opacity .15s';
    card.style.transform='translate(0,0) scale(1)';
  }));
  setTimeout(()=>{card.style.transition='';glow.style.animation='paGlow .35s ease-in-out forwards';},450);
  setTimeout(()=>{card.style.animation='paShake .5s ease-in-out forwards';},500);
  setTimeout(()=>{
    burst.style.animation='paBurst .5s ease-out forwards';
    rays.style.opacity='1';
    card.style.animation='paFadeOut .22s ease-in forwards';
    overlay.classList.remove('pa-dim');
  },820);
  setTimeout(()=>{
    overlay.style.opacity='0';
    glow.style.animation='';
    burst.style.animation='';
    rays.style.opacity='0';
    if(srcEl)srcEl.style.opacity='';
    if(typeof callback==='function')callback();
  },1280);
  return true;
}

export function buildUpgradePicker(packId,target = window){
  const pack=(target.PACKS||{})[packId];
  if(!pack)return '';
  const pool=Object.keys(target.SHOP||{}).filter(k=>pack.pool==='all'||target.SHOP[k][5]===pack.pool);
  const shuffle=target.shuffle || (a=>a.sort(()=>Math.random()-.5));
  const options=shuffle([...pool]).slice(0,4);
  let html='<div class="summary tarot-shop">';
  html+=`<div class="pack-picker-header"><h3>${pack.name}</h3><p>Pick one upgrade to keep</p></div>`;
  html+='<div class="shop-items-row">';
  const persist=persistOf(target);
  for(const k of options){
    const s=target.SHOP[k],lvl=(persist.up||{})[k]||0,ic=(target.SHOP_ICON||{})[k]||'isp-scoring';
    html+=`<div class="upg-card pool-${s[5]}">
      <div class="upg-title-strip"><span>${s[0]}</span></div>
      <div class="upg-art"><span class="isp isp-40 ${ic}"></span></div>
      <div class="upg-body"><div class="upg-desc">${s[1]}</div></div>
      <div class="upg-footer"><span class="upg-lv">Lv <b>${lvl}</b></span>
      <button class="sbtn sbtn-pick" aria-label="Pick" onclick="pickPackUpgrade('${k}')"></button></div>
    </div>`;
  }
  html+='</div></div>';
  return html;
}

export function buyPack(packId,cost,target = window){
  const pack=(target.PACKS||{})[packId];
  if(!pack)return false;
  const persist=persistOf(target);
  const finalCost=cost!==undefined?cost:(market(target).packCost?market(target).packCost(packId,target):pack.cost);
  if((persist.pool||0)<finalCost)return false;
  if(typeof target.tlrMarketPurchase==='function'&&target.tlrMarketPurchase({kind:'pack',packId,cost:finalCost})!==true)return false;
  if(market(target).markPackBought)market(target).markPackBought(packId,target);
  animatePackOpen(packId,()=>{
    if(packId==='relic'){
      const options=target.tlrMarketFlow?.relicPool?target.tlrMarketFlow.relicPool(4,target):[];
      let html='<div class="summary tarot-shop">';
      html+=`<div class="pack-picker-header"><h3>${pack.name}</h3><p>Choose one relic to carry</p></div>`;
      html+='<div class="shop-items-row relic-picker-row">';
      for(const k of options){
        const r=target.RELICS[k];
        const style=typeof target.relicIconStyle==='function'?target.relicIconStyle(k,64):'';
        html+=`<div class="upg-card relic-option ${r.rarity}" onclick="acquireRelic('${k}')">
          <div class="upg-title-strip relic-title-strip"><span>${r.name}</span></div>
          <div class="upg-art relic-art"><div class="relic-art-sprite" style="${style}"></div></div>
          <div class="upg-body"><div class="upg-desc">${r.desc}</div></div>
          <div class="upg-footer"><button class="sbtn sbtn-pick" aria-label="Pick" onclick="acquireRelic('${k}');event.stopPropagation()"></button></div>
        </div>`;
      }
      html+='</div></div>';
      if(typeof target.showOverlay==='function')target.showOverlay(html);
      return;
    }
    const html=buildUpgradePicker(packId,target);
    if(html&&typeof target.showOverlay==='function')target.showOverlay(html);
  },target);
  return true;
}

export function installShopOverlayFlow(target = window){
  if(!target || target.__tlrShopOverlayFlowInstalled)return;
  target.__tlrShopOverlayFlowInstalled=true;
  const api={packAccent,animatePackOpen,buildUpgradePicker,buyPack};
  target.tlrShopOverlayFlow=api;
  if(typeof target.animatePackOpen!=='function')target.animatePackOpen=(packId,callback)=>animatePackOpen(packId,callback,target);
  if(typeof target.buyPack!=='function')target.buyPack=(packId,cost)=>buyPack(packId,cost,target);
}
