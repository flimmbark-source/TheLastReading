import { installGeneratedSheetAssets } from './generatedSheetAssets.mjs?v=clean-tiles-1';

// Phase 1 composition bridge plus the generated Phase 2 art kit.
// Reuses the existing live DOM and state; no gameplay state is duplicated.

(function installSinglePlayerV2(target = window){
  if(!target || target.__tlrSinglePlayerV2Installed)return;
  target.__tlrSinglePlayerV2Installed=true;

  const doc=target.document;
  if(!doc)return;

  const ensureStylesheet=(id,href)=>{
    let link=doc.getElementById(id);
    if(!link){
      link=doc.createElement('link');
      link.id=id;
      link.rel='stylesheet';
      doc.head.appendChild(link);
    }
    if(link.getAttribute('href')!==href)link.setAttribute('href',href);
  };

  const ensureAssetLayer=()=>{
    ensureStylesheet('single-player-v2-assets','src/styles/singlePlayerV2Assets.css?v=clean-tiles-1');
    ensureStylesheet('single-player-v2-slot-match','src/styles/singlePlayerV2SlotMatch.css?v=1');
  };

  const refreshCompositionLayer=()=>{
    const link=[...doc.querySelectorAll('link[rel="stylesheet"]')]
      .find(node=>node.getAttribute('href')?.includes('singlePlayerV2Compat.css'));
    if(!link)return;
    const next='src/styles/singlePlayerV2Compat.css?v=composition-1';
    if(link.getAttribute('href')!==next)link.setAttribute('href',next);
  };

  const enable=()=>{
    doc.body?.classList.add('single-player-v2');
    doc.body?.classList.remove('reference-sheet-ready','reference-sheet-failed');
    refreshCompositionLayer();
    ensureAssetLayer();
    installGeneratedSheetAssets(target);
  };

  const wrapLabel=(pill,label)=>{
    if(!pill||pill.querySelector(':scope > .spv2-label'))return;
    const value=pill.querySelector(':scope > b');
    if(!value)return;
    [...pill.childNodes].forEach(node=>{
      if(node===value)return;
      if(node.nodeType===Node.TEXT_NODE)node.remove();
    });
    const span=doc.createElement('span');
    span.className='spv2-label';
    span.textContent=label;
    pill.insertBefore(span,value);
  };

  const ensureHudStructure=()=>{
    const stack=doc.querySelector('.score-stack');
    if(!stack)return false;

    wrapLabel(stack.querySelector('.reserve-pill'),'Reserve');
    wrapLabel(stack.querySelector('.score-pill'),'Score');
    wrapLabel(stack.querySelector('.threshold-pill'),'Threshold');
    wrapLabel(stack.querySelector('.discards-pill'),'Discards');

    const thresholdWrap=stack.querySelector('.th-pill-wrap');
    if(thresholdWrap&&!thresholdWrap.querySelector('.spv2-threshold-progress')){
      const progress=doc.createElement('div');
      progress.className='spv2-threshold-progress';
      progress.setAttribute('aria-hidden','true');
      progress.innerHTML='<span></span>';
      thresholdWrap.appendChild(progress);
    }
    return true;
  };

  const numberFrom=id=>{
    const raw=doc.getElementById(id)?.textContent??'0';
    const value=Number(String(raw).replace(/[^0-9.-]/g,''));
    return Number.isFinite(value)?value:0;
  };

  const updateProgress=()=>{
    const current=numberFrom('current');
    const threshold=numberFrom('threshold');
    const ratio=threshold>0?Math.max(0,Math.min(1,current/threshold)):0;
    const progress=doc.querySelector('.spv2-threshold-progress');
    if(!progress)return;
    progress.style.setProperty('--spv2-progress',String(ratio));
    progress.classList.toggle('is-complete',threshold>0&&current>=threshold);
    progress.setAttribute('aria-label',threshold>0?`${Math.round(ratio*100)}% of threshold`:'No threshold');
  };

  const observeValues=()=>{
    const ids=['pool','current','threshold','discards'];
    const observer=new MutationObserver(()=>{
      ensureHudStructure();
      updateProgress();
    });
    ids.forEach(id=>{
      const el=doc.getElementById(id);
      if(el)observer.observe(el,{subtree:true,childList:true,characterData:true});
    });
  };

  const boot=()=>{
    enable();
    if(!ensureHudStructure()){
      target.requestAnimationFrame(boot);
      return;
    }
    updateProgress();
    observeValues();
  };

  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})(window);
