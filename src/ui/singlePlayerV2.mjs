import { installGeneratedSheetAssets } from './generatedSheetAssets.mjs?v=clean-tiles-1';

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
    ensureStylesheet('single-player-v2-slot-match','src/styles/singlePlayerV2SlotMatch.css?v=2');
    ensureStylesheet('single-player-v2-visual-fix','src/styles/singlePlayerV2VisualFix.css?v=7');
  };

  const refreshCompositionLayer=()=>{
    const link=[...doc.querySelectorAll('link[rel="stylesheet"]')]
      .find(node=>node.getAttribute('href')?.includes('singlePlayerV2Compat.css'));
    if(!link)return;
    const next='src/styles/singlePlayerV2Compat.css?v=composition-1';
    if(link.getAttribute('href')!==next)link.setAttribute('href',next);
  };

  const closePullDrawer=(id,label)=>{
    doc.getElementById(`${id}PullWrap`)?.classList.remove('open');
    const tab=doc.getElementById(`${id}PullTab`);
    if(tab)tab.innerHTML=`&#9660; ${label}`;
  };

  const closeSettings=()=>closePullDrawer('menu','Menu');
  const closeReference=()=>closePullDrawer('scoring','Scoring');
  const closeAbility=()=>closePullDrawer('abilities','Abilities');
  const closeArchive=()=>doc.getElementById('invWrap')?.classList.remove('open');

  const closeAllMenus=except=>{
    if(except!=='settings')closeSettings();
    if(except!=='reference')closeReference();
    if(except!=='ability')closeAbility();
    if(except!=='archive')closeArchive();
  };

  const closeByKind=kind=>{
    if(kind==='settings')closeSettings();
    if(kind==='reference')closeReference();
    if(kind==='ability')closeAbility();
    if(kind==='archive')closeArchive();
  };

  const drawerWrapFor=kind=>{
    if(kind==='settings')return doc.getElementById('menuPullWrap');
    if(kind==='reference')return doc.getElementById('scoringPullWrap');
    if(kind==='ability')return doc.getElementById('abilitiesPullWrap');
    if(kind==='archive')return doc.getElementById('invWrap');
    return null;
  };

  const createCloseTab=(kind,id)=>{
    const parent=drawerWrapFor(kind);
    if(!parent||parent.querySelector(`#${id}`))return;
    const button=doc.createElement('button');
    button.id=id;
    button.className='spv2-menu-close-tab';
    button.type='button';
    button.dataset.closeMenu=kind;
    button.setAttribute('aria-label','Close');
    button.textContent='×';
    parent.appendChild(button);
  };

  const ensureMenuCloseTabs=()=>{
    createCloseTab('settings','spv2SettingsClose');
    createCloseTab('reference','spv2RefClose');
    createCloseTab('ability','spv2AbilityClose');
    createCloseTab('archive','spv2ArchiveClose');
  };

  const toggleArchive=()=>{
    const wrap=doc.getElementById('invWrap');
    if(!wrap)return;
    const opening=!wrap.classList.contains('open');
    closeAllMenus(opening?'archive':null);
    wrap.classList.toggle('open',opening);
  };

  const ensureUtilityControls=()=>{
    let archiveButton=doc.getElementById('spv2ArchiveBtn');
    if(!archiveButton){
      archiveButton=doc.createElement('button');
      archiveButton.id='spv2ArchiveBtn';
      archiveButton.type='button';
      archiveButton.setAttribute('aria-label','Archives');
      doc.body.appendChild(archiveButton);
    }
    if(!archiveButton.__spv2Bound){
      archiveButton.__spv2Bound=true;
      archiveButton.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        toggleArchive();
      });
    }
    ensureMenuCloseTabs();
  };

  const installMenuObservers=()=>{
    if(target.__tlrSinglePlayerMenuObserverInstalled)return;
    target.__tlrSinglePlayerMenuObserverInstalled=true;
    const observer=new MutationObserver(()=>ensureMenuCloseTabs());
    ['menuPullWrap','scoringPullWrap','abilitiesPullWrap','invWrap'].forEach(id=>{
      const node=doc.getElementById(id);
      if(node)observer.observe(node,{childList:true,subtree:false});
    });
  };

  const installOutsideClose=()=>{
    if(target.__tlrSinglePlayerOutsideCloseInstalled)return;
    target.__tlrSinglePlayerOutsideCloseInstalled=true;

    doc.addEventListener('pointerdown',event=>{
      const element=event.target instanceof Element?event.target:null;
      if(!element)return;

      const closeTab=element.closest('.spv2-menu-close-tab');
      if(closeTab){
        event.preventDefault();
        event.stopImmediatePropagation();
        closeByKind(closeTab.dataset.closeMenu);
        return;
      }

      const menuWrap=doc.getElementById('menuPullWrap');
      if(menuWrap?.classList.contains('open')&&!menuWrap.contains(element)&&!element.closest('#menuBtn'))closeSettings();

      const scoringWrap=doc.getElementById('scoringPullWrap');
      if(scoringWrap?.classList.contains('open')&&!scoringWrap.contains(element)&&!element.closest('#scoringBtn'))closeReference();

      const abilitiesWrap=doc.getElementById('abilitiesPullWrap');
      if(abilitiesWrap?.classList.contains('open')&&!abilitiesWrap.contains(element)&&!element.closest('#abilitiesBtn'))closeAbility();

      const archiveWrap=doc.getElementById('invWrap');
      const archiveDesk=doc.getElementById('invDesk');
      if(archiveWrap?.classList.contains('open')&&archiveDesk&&!archiveDesk.contains(element)&&!element.closest('#spv2ArchiveBtn'))closeArchive();
    },true);
  };

  const enable=()=>{
    doc.body?.classList.add('single-player-v2');
    doc.body?.classList.remove('reference-sheet-ready','reference-sheet-failed');
    refreshCompositionLayer();
    ensureAssetLayer();
    ensureUtilityControls();
    installMenuObservers();
    installOutsideClose();
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
