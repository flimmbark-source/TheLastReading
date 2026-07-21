// Attic visit flow controller (Step 3e, Phase 16.4). Owns attic visit
// state, prop rummage/pickup flow, attic tutorial copy, archive-close wiring,
// and the mobile pan helpers. DOM construction stays in src/ui/renderAttic.mjs.
/* global invOpen, renderInventory, resetSession, tlrArchitectureSync */
import { ALL_CARD_DEFINITIONS } from '../data/cards.mjs';

export function installAtticFlow(target = window){
  if(!target || target.__tlrAtticFlowInstalled)return;
  target.__tlrAtticFlowInstalled=true;

  let inAttic=false;
  let resetOnLeave=false;
  let candleCount=0;
  let maxCandles=0;
  let searched={};
  let awaitingPickup=false;
  let pendingArchivesTutorial=false;

  const objects={
    newspaper_stack_01:{id:'newspaper_stack_01',label:'Stack of Newspapers',verb:'Move aside',motion:'move',cost:1,before:'props/newspaper_stack_closed.png',after:'props/newspaper_stack_moved.png',left:'25%',top:'73%',width:'22%',height:'17%',itemId:'clipping_01',itemTitle:'Strange Obituary',thumb:'assets/strange_obituary.webp'},
    covered_frame_01:{id:'covered_frame_01',label:'Covered Frame',verb:'Lift cloth',motion:'lift',cost:1,before:'props/covered_frame_closed.png',after:'props/covered_frame_uncovered.png',left:'68%',top:'15%',width:'25%',height:'42%',itemId:'photo_01',itemTitle:'The Reading Room',thumb:'assets/Reading_room.webp'},
    coat_01:{id:'coat_01',label:'Old Coat',verb:'Check pocket',motion:'search',cost:1,before:'props/old_coat_closed.png',after:'props/old_coat_searched.png',left:'2%',top:'13%',width:'18%',height:'54%',itemId:'letter_01',itemTitle:'Unsigned Letter',thumb:'assets/handwritten_note.webp'}
  };

  // The sticky note on the table is collected like the props above, but has
  // CSS-drawn art (no before/after prop images), so it renders through
  // renderAtticNote instead of renderAtticObjects.
  const note={id:'sticky_note_01',itemId:'note_01',itemTitle:'Note on the Table',emoji:'🗒️'};

  function vaultedItemIds(){try{const v=JSON.parse(target.localStorage.getItem('tlr_resonation_vault')||'{}');return Object.keys(v).reduce(function(a,k){return a.concat(Array.isArray(v[k])?v[k]:[])},[])}catch(e){return []}}
  // Vaulted items count as found: completing a resonation moves them out of
  // the drawer, but the attic props they came from must stay searched.
  function foundItems(){try{const v=JSON.parse(target.localStorage.getItem('tlr_attic_found_items')||'[]');return (Array.isArray(v)?v:[]).concat(vaultedItemIds())}catch(e){return vaultedItemIds()}}
  function candlesFromScore(score){if(score>=1000)return 7;if(score>=700)return 6;if(score>=450)return 5;if(score>=250)return 4;if(score>=100)return 3;if(score>=50)return 2;return 1;}
  function renderCandles(){if(target.renderAtticObals)target.renderAtticObals(candleCount);}
  function whisper(text,duration){const w=document.getElementById('atticWhisper');if(!w)return;w.textContent=text;w.classList.add('show');clearTimeout(whisper.t);whisper.t=setTimeout(function(){w.classList.remove('show')},duration||2600);}
  function renderObjects(){if(target.renderAtticObjects)target.renderAtticObjects({objects:objects,searchedMap:searched,foundItemIds:foundItems(),onRummage:rummage});}
  let deckBrowseCards=null;
  function openDeckBrowser(){
    if(typeof target.browseCards!=='function')return;
    // Also reachable from the archives drawer at the table; only treat it
    // as attic-tutorial interaction while actually in the attic.
    if(inAttic)dismissAtticTutorial();
    if(!deckBrowseCards){
      const sort=typeof target.sortCards==='function'?target.sortCards:function(c){return c;};
      // Definitions carry no uid; cardHTML caches per uid, so give each a stable one.
      deckBrowseCards=sort(ALL_CARD_DEFINITIONS).map(function(c){return {...c,uid:'attic_deck_'+c.id};});
    }
    target.browseCards('The Deck','Look through every card in the deck. Select a card to read it.',deckBrowseCards);
  }
  function renderDeck(){if(target.renderAtticDeck)target.renderAtticDeck({onOpen:openDeckBrowser});}
  function renderNote(){if(target.renderAtticNote)target.renderAtticNote({note:note,found:foundItems().includes(note.itemId),onCollect:collectNote});}
  function collectNote(){if(awaitingPickup)return;if(foundItems().includes(note.itemId))return;dismissAtticTutorial();showPickup(note);}
  function saveFound(itemId){
    try{
      const key='tlr_attic_found_items';
      // A corrupt stored value must not eat the pickup: rebuild the list
      // instead of throwing past the write below.
      let arr;
      try{arr=JSON.parse(target.localStorage.getItem(key)||'[]')}catch(e){arr=null}
      if(!Array.isArray(arr))arr=[];
      const isNew=!arr.includes(itemId);
      const isFirst=isNew&&arr.length===0;
      if(isNew){
        arr.push(itemId);
        target.localStorage.setItem(key,JSON.stringify(arr));
        if(isFirst&&!target.localStorage.getItem('tlr_tut_archives_found'))pendingArchivesTutorial=true;
      }
    }catch(e){}
    if(target.tlrStore&&target.tlrActions)target.tlrStore.dispatch({type:target.tlrActions.DISCOVER_ARCHIVE_ITEM,itemId:itemId});}
  function tagNear(el,text){const scene=document.getElementById('atticScene');if(!scene||!el)return;const r=el.getBoundingClientRect();const sr=scene.getBoundingClientRect();const t=document.createElement('div');t.className='attic-action-tag';t.textContent=text;t.style.left=(r.left-sr.left+r.width/2)+'px';t.style.top=(r.top-sr.top+Math.max(18,r.height*.22))+'px';scene.appendChild(t);setTimeout(function(){t.remove()},920);}
  function dustNear(el){return;}
  function showPickup(o){
    awaitingPickup=true;document.querySelectorAll('#atticPickup').forEach(function(p){p.remove();});
    // Props carry a thumb image; the sticky note is CSS art with no image, so
    // fall back to its emoji for the pickup preview.
    const media=o.thumb?'<img src="'+o.thumb+'" alt="">':'<span class="attic-pickup-emoji">'+(o.emoji||'')+'</span>';
    const p=document.createElement('div');p.id='atticPickup';p.innerHTML=media+'<b>'+o.itemTitle+'</b><span>Take</span>';p.addEventListener('click',function(e){e.stopPropagation();takePickup(o);});document.getElementById('atticScene').appendChild(p);
  }
  function takePickup(o){document.querySelectorAll('#atticPickup').forEach(function(p){p.remove();});awaitingPickup=false;saveFound(o.itemId);renderObjects();renderNote();if(typeof target.renderInventory==='function')target.renderInventory();else if(typeof renderInventory==='function')renderInventory();}
  function rummage(id,el){
    const o=objects[id];if(!o||awaitingPickup)return;
    if(searched[id]){whisper('You already searched there.');return;}
    dismissAtticTutorial();searched[id]=true;renderCandles();tagNear(el,o.verb);dustNear(el);if(el){el.classList.add('spend');setTimeout(function(){el.classList.remove('spend')},560);}setTimeout(function(){renderObjects();showPickup(o);},430);
  }
  // ── 3D attic (react-three-fiber) ─────────────────────────────────────
  // The walkable attic IS the attic now: on by default, with ?attic3d=0 (or
  // localStorage tlr_attic_3d='0' via tlrSetAttic3d(false)) as the
  // kill-switch back to the classic 2D scene. The lazy chunk (React + three
  // + the scene) still only loads when actually needed, and every game
  // behavior — rummage rules, pickups, obals, archive unlocks, the
  // return-to-table transition — still runs through this module via the
  // adapter below. On any failure (no WebGL, chunk failed to load) the
  // classic 2D attic continues untouched.
  function attic3dEnabled(){
    try{
      const q=new URLSearchParams(target.location.search||'');
      if(q.get('attic3d')==='0')return false;
      if(q.get('attic3d')==='1')return true;
      return target.localStorage.getItem('tlr_attic_3d')!=='0';
    }catch(e){return true}
  }
  function attic3dAdapter(){
    return {
      objects:objects,
      note:note,
      isSearched:function(id){return !!searched[id]},
      foundItemIds:foundItems,
      obalCount:function(){return candleCount},
      rummage:function(id){rummage(id,null)},
      collectNote:collectNote,
      browseDeck:openDeckBrowser,
      openArchives:function(){
        const wrap=document.getElementById('invWrap');
        if(wrap&&!wrap.classList.contains('open')&&typeof target.toggleInventory==='function')target.toggleInventory();
      },
      leave:leave,
    };
  }
  let attic3d=null;
  function maybeMountAttic3d(){
    // A hard exit (main menu, Adventure boot) unmounts the 3D layer behind
    // our back; drop the dead handle so the next visit can mount again.
    if(attic3d&&attic3d.mounted===false)attic3d=null;
    // A successful continuous return transfers the same handle to table
    // ownership. It is still mounted, but it must no longer block the next
    // attic promotion merely because this closure kept the old reference.
    if(attic3d&&target.__tlrTableSeat===attic3d&&target.__tlrAttic3d!==attic3d)attic3d=null;
    if(!attic3dEnabled()||attic3d)return;

    const adapter=attic3dAdapter();
    // The seated reading already owns the correct room and WebGL context.
    // Promote that live root before mode-to-attic is applied, otherwise its
    // normal body-class observer would unmount it and recreate the black gap.
    const seat=target.__tlrTableSeat;
    if(seat&&seat.mounted!==false&&typeof seat.promoteToAttic==='function'){
      const promoted=seat.promoteToAttic(adapter);
      if(promoted){attic3d=promoted;return;}
    }

    // Fallback for classic-table starts, WebGL recovery, or older seated
    // handles: mount the attic as a fresh canvas exactly as before.
    document.body.classList.add('attic3d-pending');
    attic3d={pending:true};
    import('../three/atticEntry.mjs').then(function(mod){
      if(!attic3d||!inAttic){attic3d=null;document.body.classList.remove('attic3d-pending');return}
      attic3d=mod.mountAttic3D(adapter)||null;
      if(!attic3d)document.body.classList.remove('attic3d-pending');
    }).catch(function(err){
      attic3d=null;
      document.body.classList.remove('attic3d-pending');
      console.warn('The Last Reading 3D attic failed to load; using the classic attic.',err);
    });
  }
  function unmountAttic3d(){
    const inst=attic3d;attic3d=null;
    if(inst&&typeof inst.unmount==='function')inst.unmount();
  }

  // Leaving the reading for the attic must not drag the table's card-detail
  // surfaces along: close any open detail dialog, drop the info medallion
  // (even a dragged-out one, which otherwise persists with no card selected),
  // and clear any lingering text selection from the menu button press so the
  // "Go to Attic" label doesn't ride into the attic highlighted.
  function clearTableDetailSurfaces(){
    try{if(typeof target.closeCardDetail==='function')target.closeCardDetail();}catch(e){}
    document.querySelectorAll('.card-detail-backdrop,.card-detail-trigger').forEach(function(el){el.remove();});
    try{if(typeof target.tlrResetInfoButton==='function')target.tlrResetInfoButton();}catch(e){}
    try{const sel=target.getSelection&&target.getSelection();if(sel&&sel.removeAllRanges)sel.removeAllRanges();}catch(e){}
  }

  function enter(candles,shouldReset){
    if(target.tlrCloseArchives)target.tlrCloseArchives();
    clearTableDetailSurfaces();
    inAttic=true;resetOnLeave=!!shouldReset;maxCandles=Math.max(1,Number(candles)||1);candleCount=maxCandles;searched={};awaitingPickup=false;renderCandles();renderObjects();renderDeck();renderNote();
    if(target.tlrStore&&target.tlrActions)target.tlrStore.dispatch({type:target.tlrActions.ENTER_ATTIC,obals:maxCandles});
    const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','false');
    // Promotion must disconnect the seated canvas observer before the mode
    // class changes. Fresh-mount fallback still behaves exactly as before.
    maybeMountAttic3d();
    document.body.classList.remove('mode-reading','mode-to-table','mode-table-return');document.body.classList.add('mode-to-attic');
    setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic');if(typeof tlrArchitectureSync==='function')tlrArchitectureSync();},900);
    // The 3D attic shows its own movement-controls hint; the 2D tutorial's
    // swipe/tap copy would be wrong there.
    setTimeout(function(){if(!attic3d)showAtticTutorial();},1400);
  }
  function leave(){
    if(target.tlrCloseArchives)target.tlrCloseArchives();
    if(!inAttic)return;inAttic=false;document.querySelectorAll('#atticPickup,.attic-action-tag,.attic-dust').forEach(function(p){p.remove();});
    const deckModal=document.getElementById('modal');if(deckModal&&deckModal.classList.contains('card-browse'))deckModal.classList.remove('show','collapsed','card-browse');
    const showArchivesAfterReturn=pendingArchivesTutorial;
    pendingArchivesTutorial=false;
    if(target.tlrStore&&target.tlrActions)target.tlrStore.dispatch({type:target.tlrActions.LEAVE_ATTIC});

    // Continuous single-canvas return — the mirror of enter()'s promoteToAttic.
    // The live attic canvas (its camera already lowered into the seat by
    // PlayerRig's sit) becomes the seated table in place while the 2D reading
    // chrome fades back in. No reveal veil, no attic unmount + seat remount, and
    // none of the intermediate mode-to-table screens that used to flash the old
    // 2D table UI through on the way back.
    const live3d=window.__tlrAttic3d;
    if(attic3dEnabled()&&document.body.classList.contains('single-player-v2')&&live3d&&live3d.mounted!==false&&typeof live3d.convertToSeat==='function'){
      let converted=null;try{converted=live3d.convertToSeat();}catch(e){converted=null;}
      if(converted){
        // The handle is now owned by __tlrTableSeat. Release the closure's attic
        // ownership immediately so a second visit can promote it back again.
        if(attic3d===live3d)attic3d=null;
        const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');
        // Leave mode-attic (and any stale transition classes) before dealing a
        // fresh reading: atticReturnPolish's resetSession wrapper only forces the
        // hard-hide blackout while mode-attic/mode-to-table/mode-return-hard-hide
        // is set, and mode-table-return is none of those. convertToSeat's
        // RETURNING class holds the chrome hidden through the swap regardless.
        document.body.classList.remove('mode-attic','mode-to-attic','mode-to-table','mode-table-return','mode-return-hard-hide');
        document.body.classList.add('mode-table-return');
        if(resetOnLeave&&typeof target.resetSession==='function'){resetOnLeave=false;target.resetSession();}else if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}
        // RETURNING keeps the chrome at opacity 0 until the seat's anchors have
        // settled; when convertToSeat drops RETURNING on tlr:table3d-ready the
        // mode-table-return transition carries the chrome up to full, then we
        // settle onto the plain reading state.
        let settled=false;
        const settle=function(){
          // A fresh attic visit may have started before this fired (enter()
          // clears mode-table-return); never stamp mode-reading over a visit
          // that has already moved on.
          if(inAttic||!document.body.classList.contains('mode-table-return'))return;
          document.body.classList.remove('mode-table-return');
          document.body.classList.add('mode-reading');
          if(typeof tlrArchitectureSync==='function')tlrArchitectureSync();
          if(showArchivesAfterReturn&&typeof target.maybeShowArchivesTutorial==='function')target.maybeShowArchivesTutorial();
        };
        const settleOnce=function(){if(settled)return;settled=true;target.removeEventListener('tlr:table3d-ready',onReady);target.clearTimeout(fallback);setTimeout(settle,850);};
        const onReady=function(){settleOnce();};
        target.addEventListener('tlr:table3d-ready',onReady);
        const fallback=setTimeout(settleOnce,2200);
        return;
      }
      // convertToSeat bailed (rare); fall through to the classic veiled return.
    }

    document.body.classList.add('mode-return-hard-hide');
    // Cover the whole attic->table swap — the attic canvas unmounting to
    // nothing, the intermediate SPv2 mode states, and the seated canvas
    // mounting — with the reveal veil so those old 2D table screens never
    // flash through before the seated table settles into view.
    let returnVeil=null;
    if(attic3dEnabled()&&document.body.classList.contains('single-player-v2')){
      returnVeil=document.createElement('div');
      returnVeil.className='table3d-reveal-veil';
      document.body.appendChild(returnVeil);
    }
    if(resetOnLeave&&typeof target.resetSession==='function'){resetOnLeave=false;target.resetSession();}else if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}
    setTimeout(function(){document.body.classList.remove('mode-attic','mode-to-attic','mode-reading');document.body.classList.add('mode-to-table');const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');},60);
    setTimeout(function(){
      // Unmount only after the attic has fully faded so the seated 3D view
      // stays on screen underneath the attic->table cross-fade.
      unmountAttic3d();
      document.body.classList.remove('mode-to-table','mode-table-return','mode-return-hard-hide');document.body.classList.add('mode-reading');if(typeof tlrArchitectureSync==='function')tlrArchitectureSync();
      // Back at the table with the flag on: swap in the hybrid seated
      // backdrop (same chunk, already cached from the attic mount). Keep the
      // painted SPv2 background suppressed (attic3d-pending) across the gap
      // between the attic unmount above and the seat mount so the old 2D art
      // never flashes through; mountSeatedTable clears it on success, the
      // paths below clear it on any bail-out or failure.
      if(attic3dEnabled()&&document.body.classList.contains('single-player-v2')){
        document.body.classList.add('attic3d-pending');
        import('../three/atticEntry.mjs').then(function(mod){
          let seat=null;
          if(!inAttic&&document.body.classList.contains('single-player-v2'))seat=mod.mountSeatedTable&&mod.mountSeatedTable();
          if(!seat){document.body.classList.remove('attic3d-pending');if(returnVeil){returnVeil.remove();returnVeil=null;}}
          // Seat is up: let it render and settle under the veil for a beat,
          // then fade the veil to reveal the finished table.
          else if(returnVeil){setTimeout(function(){if(returnVeil)returnVeil.classList.add('out');},650);setTimeout(function(){if(returnVeil){returnVeil.remove();returnVeil=null;}},1300);}
        }).catch(function(){document.body.classList.remove('attic3d-pending');if(returnVeil){returnVeil.remove();returnVeil=null;}});
      }else if(returnVeil){returnVeil.remove();returnVeil=null;}
      if(showArchivesAfterReturn&&typeof target.maybeShowArchivesTutorial==='function')target.maybeShowArchivesTutorial();
    },1080);
  }

  function showAtticTutorial(){
    try{if(target.localStorage.getItem('tlr_attic_tutored_obals'))return;}catch(e){}
    const t=document.getElementById('atticTutorial');if(!t)return;
    const isDesktop=false; // mobile touch-style hint text is used even for a real mouse
    const searchLine=isDesktop
      ?'<em>Click</em> glowing objects to search them.'
      :'<em>Tap</em> glowing objects to search them.';
    const lookLine=isDesktop
      ?'<p>Use the attic view to look around for anything that can be searched.</p>'
      :'<p>Swipe the attic view to look around for anything that can be searched.</p>';
    t.innerHTML='<div class="attic-tut-card"><h4>The Attic</h4><p>'+searchLine+' Actions here do not spend Obals.</p>'+lookLine+'</div>'
      +'<div class="attic-tut-card"><h4>Return to the Table</h4><p>When you are done, press the <em>Return to Table</em> tabletop button at the bottom of the screen.</p></div>'
      +'<button id="atticTutDismiss">I understand</button>';
    const btn=t.querySelector('#atticTutDismiss');
    if(btn)btn.addEventListener('click',function(e){e.stopPropagation();dismissAtticTutorial();});
    function _tutBlock(e){e.stopPropagation();e.preventDefault();dismissAtticTutorial();}
    t.addEventListener('click',_tutBlock);
    t.addEventListener('touchstart',_tutBlock,{passive:false});
    t.classList.add('show');
  }
  function dismissAtticTutorial(){
    const t=document.getElementById('atticTutorial');if(t){t.classList.remove('show');}
    try{target.localStorage.setItem('tlr_attic_tutored_obals','1');target.localStorage.setItem('tlr_attic_tutored','1');}catch(e){}
  }

  function closeArchives(){
    try{ if(typeof invOpen !== 'undefined') invOpen = false; }catch(e){}
    // Leaving the drawer behind (attic, new reading, menu) drops any
    // resonation-memory view so it reopens on the present-day drawer.
    if(typeof target.tlrResetDrawerView==='function')target.tlrResetDrawerView();
    const wrap = document.getElementById('invWrap');
    if(wrap) wrap.classList.remove('open');
    const tab = document.getElementById('invTab');
    if(tab) tab.innerHTML = '&#9660; Archives';
    document.querySelectorAll('.inv-detail,.invDetail,#invDetail').forEach(function(el){ el.remove(); });
  }

  function wrapWindowFunction(name){
    const fn = target[name];
    if(typeof fn !== 'function' || fn.__tlrArchivesCloseWrapped) return;
    const wrapped = function(){
      closeArchives();
      return fn.apply(this, arguments);
    };
    wrapped.__tlrArchivesCloseWrapped = true;
    target[name] = wrapped;
  }

  function positionAtticView(){const pan=document.getElementById('atticPan');if(!pan)return;requestAnimationFrame(function(){const maxX=Math.max(0,pan.scrollWidth-pan.clientWidth);pan.scrollLeft=Math.round(maxX*.34);pan.scrollTop=0;});}
  function showPanHint(){if(target.innerWidth>980)return;
    // The 3D attic shows its own controls hint; the 2D pan copy would be
    // wrong there (and must not burn the once-only flag while 3D is on).
    if(document.body.classList.contains('attic3d-live')||document.body.classList.contains('attic3d-pending'))return;
    try{if(target.localStorage.getItem('tlr_attic_pan_hint'))return;target.localStorage.setItem('tlr_attic_pan_hint','1');}catch(e){}const scene=document.getElementById('atticScene');if(!scene)return;const hint=document.createElement('div');hint.className='attic-pan-hint';hint.textContent='Swipe to look around';scene.appendChild(hint);setTimeout(function(){hint.remove();},3600);}
  function installDragPan(){const pan=document.getElementById('atticPan');if(!pan||pan.__tlrDragPan)return;pan.__tlrDragPan=true;let active=false,startX=0,startLeft=0;pan.addEventListener('pointerdown',function(e){if(e.target&&e.target.closest&&e.target.closest('.attic-prop,.attic-note,#atticPickup'))return;active=true;startX=e.clientX;startLeft=pan.scrollLeft;pan.classList.add('dragging');});pan.addEventListener('pointermove',function(e){if(!active)return;pan.scrollLeft=startLeft-(e.clientX-startX);});function end(){active=false;pan.classList.remove('dragging');}pan.addEventListener('pointerup',end);pan.addEventListener('pointercancel',end);}

  target.tlrCloseArchives=closeArchives;
  target.tlrBrowseDeck=openDeckBrowser;
  target.tlrSetAttic3d=function(on){try{target.localStorage.setItem('tlr_attic_3d',on?'1':'0')}catch(e){};return attic3dEnabled();};
  target.tlrScoreToObals=candlesFromScore;
  target.tlrDebugEnterAttic=enter;
  target.tlrDebugLeaveAttic=leave;
  target.tlrEnterAtticAfterReading=function(score){enter(candlesFromScore(Number(score)||0),true);};
  target.tlrPositionAtticView=positionAtticView;
  target.tlrInstallAtticPan=installDragPan;
  target.tlrResetAtticFoundItems=function(){try{target.localStorage.removeItem('tlr_attic_found_items')}catch(e){};if(typeof target.renderInventory==='function')target.renderInventory();else if(typeof renderInventory==='function')renderInventory();};

  if(typeof target.startReading === 'function' && !target.startReading.__tlrArchivesCloseWrapped){
    const originalStartReading = target.startReading;
    const wrappedStartReading = function(){
      closeArchives();
      return originalStartReading.apply(this, arguments);
    };
    wrappedStartReading.__tlrArchivesCloseWrapped = true;
    target.startReading = wrappedStartReading;
  }

  wrapWindowFunction('tlrDebugEnterAttic');
  wrapWindowFunction('tlrEnterAtticAfterReading');
  wrapWindowFunction('tlrDebugLeaveAttic');

  const oldEnter=target.tlrDebugEnterAttic;
  if(typeof oldEnter==='function'&&!oldEnter.__tlrMobilePanWrapped){
    const wrapped=function(){const r=oldEnter.apply(this,arguments);installDragPan();setTimeout(positionAtticView,60);setTimeout(positionAtticView,260);setTimeout(function(){positionAtticView();showPanHint();},960);return r;};
    wrapped.__tlrMobilePanWrapped=true;
    target.tlrDebugEnterAttic=wrapped;
  }

  document.addEventListener('keydown',function(e){
    if(e.shiftKey&&e.key==='A'){
      e.preventDefault();
      e.stopImmediatePropagation();
      inAttic?leave():enter(3,false);
    }
  },true);
  function bindReturnButton(){const btn=document.getElementById('atticTableReturn');if(btn&&!btn.__tlrAtticReturnBound){btn.__tlrAtticReturnBound=true;btn.addEventListener('click',function(e){e.stopPropagation();leave();});}}
  target.addEventListener('DOMContentLoaded',bindReturnButton);
  bindReturnButton();
  target.addEventListener('DOMContentLoaded',installDragPan);
  installDragPan();
  target.addEventListener('resize',function(){if(document.body.classList.contains('mode-attic')||document.body.classList.contains('mode-to-attic'))positionAtticView();});
}
