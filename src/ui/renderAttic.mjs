// Attic renderer (Phase 15.6). Moved verbatim from the attic module in
// index.html, parameterized: the attic flow keeps its visit state (searched
// props, current obals) and passes it in, so the table never learns how
// attic props render and the attic stops owning DOM construction.

export function renderAtticObals(count){const h=document.getElementById('obalsHud');if(!h)return;h.innerHTML='<span class="attic-obal-label">Obals</span><b class="attic-obal-count">'+count+'</b>';}

// Sticky note on the attic table. Not a collectable prop: clicking it opens
// a read-only detail view. Placeholder art is CSS-drawn (.attic-note-paper);
// swap that element's styling for real art later.
export function renderAtticNote(){
  const root=document.getElementById('atticObjects');if(!root)return;
  let el=root.querySelector('.attic-note');
  if(!el){
    el=document.createElement('div');
    el.className='attic-note';
    el.setAttribute('role','button');
    el.setAttribute('aria-label','Read the note on the table');
    el.innerHTML='<div class="attic-note-paper"></div>';
    el.addEventListener('click',function(e){e.stopPropagation();showAtticNoteDetail();});
    root.appendChild(el);
  }
}

function showAtticNoteDetail(){
  document.querySelectorAll('.attic-note-detail').forEach(function(d){d.remove();});
  const bg=document.createElement('div');
  bg.className='attic-note-detail';
  bg.innerHTML='<div class="attic-note-detail-card" role="dialog" aria-modal="true" aria-label="Note">'
    +'<button class="attic-note-detail-close" type="button" aria-label="Close">&#x2715;</button>'
    +'<p>The same 3 again.</p>'
    +'<p>Pay attention when their images begin turning up elsewhere.</p>'
    +'</div>';
  bg.addEventListener('click',function(e){if(e.target===bg)bg.remove();});
  bg.querySelector('.attic-note-detail-close').addEventListener('click',function(){bg.remove();});
  document.body.appendChild(bg);
}

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
      // Always bind; the searched class gates it. Binding only when !done
      // used to leave un-searched props dead if they were first rendered as
      // done and later reset.
      el.addEventListener('click',function(e){e.stopPropagation();if(el.classList.contains('searched'))return;onRummage(o.id,el);});
      root.appendChild(el);
    }
    if(done&&!el.classList.contains('searched')){
      el.classList.add('searched');
      el.setAttribute('aria-label',o.label+' already searched');
      el.style.pointerEvents='none';
    }else if(!done&&el.classList.contains('searched')){
      // The found-items record no longer covers this prop (e.g. it was reset
      // or lost). Un-latch the DOM state so the attic offers the item again
      // instead of staying "searched" with the item unrecoverable.
      el.classList.remove('searched');
      el.setAttribute('aria-label',o.verb+' '+o.label);
      el.style.pointerEvents='';
    }
  });
}
