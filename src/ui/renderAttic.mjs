// Attic renderer (Phase 15.6). Moved verbatim from the attic module in
// index.html, parameterized: the attic flow keeps its visit state (searched
// props, current obals) and passes it in, so the table never learns how
// attic props render and the attic stops owning DOM construction.

export function renderAtticObals(count){const h=document.getElementById('obalsHud');if(!h)return;h.innerHTML='<span class="attic-obal-label">Obals</span><b class="attic-obal-count">'+count+'</b>';}

export function renderAtticDeck({onOpen}){
  // Screen-anchored next to the Return to Table arch, not in the panning
  // room, so it stays reachable no matter where the attic view is panned.
  const root=document.getElementById('atticScene');if(!root)return;
  let el=root.querySelector('.attic-deck');
  if(!el){
    el=document.createElement('div');
    el.className='attic-deck';
    el.setAttribute('role','button');
    el.setAttribute('aria-label','Look through the deck of cards');
    for(let i=0;i<3;i++){const c=document.createElement('div');c.className='attic-deck-card';el.appendChild(c);}
    root.appendChild(el);
  }
  el.onclick=function(e){e.stopPropagation();onOpen();};
}

export function renderAtticObjects({objects,searchedMap,foundItemIds,onRummage}){
  const root=document.getElementById('atticObjects');if(!root)return;
  Object.keys(objects).forEach(function(k){
    const o=objects[k];const alreadyFound=foundItemIds.includes(o.itemId);const done=!!searchedMap[o.id]||alreadyFound;
    let el=root.querySelector('[data-prop-id="'+o.id+'"]');
    if(!el){
      el=document.createElement('div');
      el.className='attic-prop motion-'+o.motion;
      el.dataset.propId=o.id;
      el.style.left=o.left;el.style.top=o.top;el.style.width=o.width;el.style.height=o.height;
      const bef=document.createElement('div');bef.className='prop-img prop-img-before';bef.style.backgroundImage='url("'+o.before+'")';
      const aft=document.createElement('div');aft.className='prop-img prop-img-after';aft.style.backgroundImage='url("'+o.after+'")';
      el.appendChild(bef);el.appendChild(aft);
      el.setAttribute('role','button');el.setAttribute('aria-label',o.verb+' '+o.label);
      if(!done)el.addEventListener('click',function(e){e.stopPropagation();onRummage(o.id,el);});
      root.appendChild(el);
    }
    if(done&&!el.classList.contains('searched')){
      el.classList.add('searched');
      el.setAttribute('aria-label',o.label+' already searched');
      el.style.pointerEvents='none';
    }
  });
}
