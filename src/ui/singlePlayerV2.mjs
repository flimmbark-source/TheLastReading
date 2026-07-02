import { installGeneratedSheetAssets } from './generatedSheetAssets.mjs?v=option-discs-1';

export function installSinglePlayerV2(target = window) {
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
    ensureStylesheet('single-player-v2-index','src/styles/singlePlayerV2/index.css?v=1');
    ensureStylesheet('single-player-v2-utility-buttons','src/styles/singlePlayerV2/components/utilityButtons.css?v=1');
  };

  const refreshCompositionLayer=()=>{};

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

  const ensureActionRail=()=>{
    const rail=doc.querySelector('.spread-actions');
    if(rail&&rail.parentElement!==doc.body)doc.body.appendChild(rail);
  };

  const restoreHandTutorial=()=>{
    doc.getElementById('spv2HandDragLabel')?.remove();
    const zone=doc.getElementById('handSwipeZone');
    if(!zone)return;

    zone.removeAttribute('aria-label');
    ['left','right','bottom','width','height','transform','z-index'].forEach(property=>{
      zone.style.removeProperty(property);
    });

    if(!zone.querySelector('.hand-swipe-hint')){
      zone.innerHTML='<div class="hand-swipe-zone-lower" aria-hidden="true"></div><div class="hand-swipe-hint"><div class="swipe-hint-line swipe-hint-line-1"><span></span>&#x2724; swipe to drift &#x2724;<span></span></div><div class="swipe-hint-line swipe-hint-line-2" id="handHintLine2"><span></span>&#x2724; pinch to constrict &#x2724;<span></span></div><div class="swipe-hint-line swipe-hint-line-3" id="handHintLine3"><span></span>&#x2724; pull open to expand &#x2724;<span></span></div></div>';
    }
  };

  const ensureUtilityControls=()=>{
    ensureActionRail();
    restoreHandTutorial();

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
    target.__tlrSinglePlayerMenuObserver?.disconnect?.();
    const observer=new MutationObserver(()=>ensureMenuCloseTabs());
    ['menuPullWrap','scoringPullWrap','abilitiesPullWrap','invWrap'].forEach(id=>{
      const node=doc.getElementById(id);
      if(node)observer.observe(node,{childList:true,subtree:false});
    });
    target.__tlrSinglePlayerMenuObserver=observer;
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

  const HAND_HINT_KEY='tlr_spv2_hand_hint_seen';

  const dismissHandHint=(persist)=>{
    doc.body?.classList.add('spv2-hand-hint-dismissed');
    if(persist){try{target.localStorage.setItem(HAND_HINT_KEY,'1');}catch{}}
  };

  const installHandHintDismiss=()=>{
    // The swipe/pinch/pull gesture hint is onboarding chrome. Fade it out on
    // the player's first play interaction and remember it, so the gesture copy
    // stops competing with the composition after the first session.
    if(target.__tlrHandHintInstalled)return;
    target.__tlrHandHintInstalled=true;
    let seen=false;
    try{seen=!!target.localStorage.getItem(HAND_HINT_KEY);}catch{}
    if(seen){dismissHandHint(false);return;}
    const onFirst=event=>{
      const el=event.target instanceof Element?event.target:null;
      if(!el)return;
      if(el.closest('#hand')||el.closest('.handDock')||el.closest('#handSwipeZone')||el.closest('#spread')){
        doc.removeEventListener('pointerdown',onFirst,true);
        dismissHandHint(true);
      }
    };
    doc.addEventListener('pointerdown',onFirst,true);
  };

  const enable=()=>{
    doc.body?.classList.add('single-player-v2');
    doc.body?.classList.remove('reference-sheet-ready','reference-sheet-failed');
    refreshCompositionLayer();
    ensureAssetLayer();
    ensureUtilityControls();
    installMenuObservers();
    installOutsideClose();
    installHandHintDismiss();
    target.__tlrSinglePlayerV2Ready = installGeneratedSheetAssets(target);
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

  const ensureDiscardBadge=()=>{
    const button=doc.getElementById('discardBtn');
    if(!button)return null;
    let badge=doc.getElementById('spv2DiscardBadge');
    if(!badge){
      badge=doc.createElement('span');
      badge.id='spv2DiscardBadge';
      badge.setAttribute('aria-hidden','true');
    }
    if(badge.parentElement!==button)button.appendChild(badge);
    return badge;
  };

  const updateDiscardBadge=()=>{
    const badge=ensureDiscardBadge();
    if(!badge)return;
    const raw=doc.getElementById('discards')?.textContent??'';
    const value=String(raw).replace(/[^0-9]/g,'');
    badge.textContent=value;
    badge.style.display=value===''?'none':'';
  };

  const formatMult=m=>{
    const v=Math.round(m*100)/100;
    return Number.isInteger(v)?String(v):String(v).replace(/0+$/,'').replace(/\.$/,'');
  };

  // The multiplier of the cards currently placed in the reading, via the same
  // legacy scoring used to drive the score counter (so the badge stays
  // consistent with the displayed score). Defaults to 1 when nothing is placed.
  const currentSpreadMult=()=>{
    const state=target.tlrRuntime?.state||target.state;
    const cards=(state?.spread||[]).filter(Boolean);
    if(!cards.length||typeof target._scoreLegacy!=='function')return 1;
    try{const res=target._scoreLegacy(cards);return res&&typeof res.mult==='number'?res.mult:1;}catch{return 1;}
  };

  const ensureScoreMultBadge=()=>{
    const pill=doc.querySelector('.score-pill');
    if(!pill)return null;
    let badge=doc.getElementById('spv2ScoreMult');
    if(!badge){
      badge=doc.createElement('span');
      badge.id='spv2ScoreMult';
      badge.setAttribute('aria-hidden','true');
    }
    if(badge.parentElement!==pill)pill.appendChild(badge);
    return badge;
  };

  // Show the current reading multiplier in red at the score number's corner,
  // but only when it is actually above 1 so it reads as a reward signal.
  const updateScoreMult=()=>{
    const badge=ensureScoreMultBadge();
    if(!badge)return;
    const mult=currentSpreadMult();
    if(mult>1){
      badge.textContent='×'+formatMult(mult);
      badge.classList.add('show');
    }else{
      badge.classList.remove('show');
    }
  };

  const observeValues=()=>{
    if(target.__tlrSinglePlayerValueObserver)return;
    const ids=['pool','current','threshold','discards'];
    const observer=new MutationObserver(()=>{
      ensureHudStructure();
      updateProgress();
      updateDiscardBadge();
      updateScoreMult();
    });
    ids.forEach(id=>{
      const el=doc.getElementById(id);
      if(el)observer.observe(el,{subtree:true,childList:true,characterData:true});
    });
    target.__tlrSinglePlayerValueObserver=observer;
  };

  const boot=()=>{
    enable();
    if(!ensureHudStructure()){
      target.requestAnimationFrame(boot);
      return;
    }
    updateProgress();
    updateDiscardBadge();
    updateScoreMult();
    observeValues();
  };

  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
}
