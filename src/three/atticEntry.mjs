// Bridge between the legacy attic flow and the shared react-three-fiber room.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AtticExperience } from './AtticExperience.jsx';
import { clearTableAnchors } from './tableAnchors.mjs';
import { ATTIC_OBJECTS } from '../data/atticObjects.mjs';

const ATTIC_ID='attic3dRoot',APPROACH_ID='table3dApproach',SEAT_ID='table3dSeat';
const LIVE='attic3d-live',PENDING='attic3d-pending',SEATED='table3d-live',RETURNING='table3d-continuous-return';
const HINT_ID='attic3dHint',HINT_KEY='tlr_attic3d_hint_seen',STYLE_ID='table3d-continuous-transition-style';
const STAND_CEILING=4500,RETURN_CEILING=1900;

function clearSceneStyle(scene){if(!scene)return;['opacity','pointer-events','transition'].forEach(name=>scene.style.removeProperty(name))}
function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
body.table3d-live.attic3d-pending .spread-actions,body.mode-to-attic .spread-actions,body.mode-attic .spread-actions,body.table3d-live.attic3d-pending #discardBtn,body.table3d-live.attic3d-pending #purgeBtn,body.table3d-live.attic3d-pending #spv2DiscardBadge,body.mode-to-attic #discardBtn,body.mode-to-attic #purgeBtn,body.mode-to-attic #spv2DiscardBadge{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}
body.table3d-live.attic3d-pending .spread-actions::before,body.mode-to-attic .spread-actions::before,body.mode-attic .spread-actions::before{content:none!important;display:none!important;opacity:0!important;visibility:hidden!important}
/* Standing up: drop the whole 2D reading — spread, hand fan, its gesture zone
   and the discard pips — instantly. The reading hands off to the real 3D cards
   on the cloth (src/three/TableSpread.jsx), which stay physically on the table
   as the camera rises, so the flat DOM layer must be gone the moment the
   getting-up move starts rather than re-seating to its native spot and fading. */
body.table3d-live.attic3d-pending .spread-wrap,body.table3d-live.attic3d-pending .handDock,body.table3d-live.attic3d-pending #handSwipeZone,body.table3d-live.attic3d-pending #table3dDiscardPips{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}
body.${RETURNING} .table3d-reveal-veil{opacity:0!important;background:transparent!important;transition:none!important}
body.${RETURNING}.mode-to-table #atticScene,body.${RETURNING}.mode-table-return #atticScene,body.${RETURNING}.mode-return-hard-hide #atticScene{opacity:1!important;filter:none!important;transform:none!important}
body.${RETURNING} .spread-wrap,body.${RETURNING} .handDock,body.${RETURNING} #relicRack,body.${RETURNING} .refs-layer,body.${RETURNING} #titleWrap,body.${RETURNING} .score-stack,body.${RETURNING} .spread-actions{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:none!important}`;
  document.head.append(style);
}
function webglAvailable(){try{const canvas=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(canvas.getContext('webgl2')||canvas.getContext('webgl')))}catch{return false}}
function hintHtml(){return window.matchMedia?.('(pointer: coarse)')?.matches?'<b>You stand up from the table.</b><span>Tap a glowing object to use it. Drag to look around; flick to turn fast. The book on the table contains Scoring, Abilities, and Settings.</span>':'<b>You stand up from the table.</b><span>Click a glowing object or use WASD and drag to look. Press E to use what you face. The book on the table contains Scoring, Abilities, and Settings.</span>'}
let hintShown=false;
function showHint(scene){
  if(!scene||hintShown)return null;
  hintShown=true;
  try{if(localStorage.getItem(HINT_KEY)){localStorage.removeItem(HINT_KEY);return null}}catch{}
  const el=document.createElement('div');el.id=HINT_ID;el.innerHTML=hintHtml();scene.append(el);let removed=false;
  const dismiss=()=>{if(removed)return;removed=true;clearTimeout(timer);el.classList.add('fade');setTimeout(()=>el.remove(),650)};
  const timer=setTimeout(dismiss,9000);
  return{el,dismiss};
}
function stubAdapter(){
  const foundItemIds=()=>{try{const raw=JSON.parse(localStorage.getItem('tlr_attic_found_items')||'[]');return Array.isArray(raw)?raw:[]}catch{return[]}};
  return{objects:ATTIC_OBJECTS,note:{itemId:'note_01'},isSearched:()=>false,foundItemIds,obalCount:()=>0,rummage(){},collectNote(){},browseDeck(){},leave(){}};
}
function makeRoomHandle(container,root,adapter,mode,scene=null){
  ensureStyles();
  let destroyed=false,currentAdapter=adapter,currentMode=mode,activeScene=scene,observer=null,hint=null,timer=0,returnTimer=0,transferringToSeat=false;

  const handle={
    mounted:true,
    api:null,
    render(nextMode=currentMode,extra={}){
      currentMode=nextMode;
      root.render(createElement(AtticExperience,{
        adapter:currentAdapter,
        mode:nextMode,
        onFirstMove:()=>hint?.dismiss(),
        registerApi:api=>{handle.api=api},
        ...extra,
      }));
    },
    destroy(){
      if(destroyed)return;
      destroyed=true;
      handle.mounted=false;
      clearTimeout(timer);
      clearTimeout(returnTimer);
      observer?.disconnect();
      hint?.el?.remove();
      clearSceneStyle(activeScene);
      document.body.classList.remove(SEATED,LIVE,PENDING,RETURNING);
      clearTableAnchors();
      document.querySelectorAll('.table3d-reveal-veil').forEach(el=>el.remove());
      try{root.unmount()}catch(error){console.warn('The Last Reading: 3D room unmount failed.',error)}
      container.remove();
      if(window.__tlrTableSeat===handle)delete window.__tlrTableSeat;
      if(window.__tlrAttic3d===handle)delete window.__tlrAttic3d;
    },
    // Destruction is now unambiguous. A stale atticFlow reference may still call
    // unmount after this root has already transferred to the seated-table owner;
    // in that case it no longer owns an attic canvas and must not destroy it.
    unmount(){
      const transferred=currentMode==='table'&&window.__tlrTableSeat===handle;
      if(transferred)return;
      handle.destroy();
    },
    observeSeat(){
      observer?.disconnect();
      observer=new MutationObserver(()=>{
        const classes=document.body.classList;
        if(classes.contains('main-menu-active')||classes.contains('mode-attic')||classes.contains('mode-to-attic')||classes.contains('mode-adventure')||classes.contains('mp-game-active')||!classes.contains('single-player-v2'))handle.destroy();
      });
      observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    },
    observeAttic(){
      observer?.disconnect();
      observer=new MutationObserver(()=>{
        if(destroyed)return;
        const classes=document.body.classList;
        const returning=classes.contains('mode-return-hard-hide')||classes.contains('mode-to-table')||classes.contains('mode-table-return');

        // PlayerRig has already completed the chair animation before atticFlow
        // applies these classes. Transfer ownership now, outside the R3F frame
        // callback, instead of waiting for the old destructive unmount beat.
        if(returning&&(currentMode==='attic'||currentMode==='rising')){
          classes.add(RETURNING);
          handle.convertToSeat();
          return;
        }

        const valid=classes.contains('mode-attic')||classes.contains('mode-to-attic')||returning||classes.contains(RETURNING);
        if(!valid)handle.destroy();
      });
      observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    },
    activateAttic(){
      document.body.classList.add(LIVE);
      document.body.classList.remove(SEATED,PENDING,RETURNING);
      hint=showHint(activeScene||document.getElementById('atticScene'));
      handle.observeAttic();
      window.__tlrAttic3d=handle;
      return handle;
    },
    promoteToAttic(nextAdapter){
      if(destroyed||currentMode!=='table'||!nextAdapter)return null;
      const nextScene=document.getElementById('atticScene');
      if(!nextScene)return null;
      currentAdapter=nextAdapter;
      activeScene=nextScene;
      observer?.disconnect();
      document.body.classList.remove(RETURNING);
      document.body.classList.add(PENDING);
      nextScene.style.setProperty('opacity','0','important');
      nextScene.style.setProperty('pointer-events','none','important');
      nextScene.style.setProperty('transition','none','important');
      try{handle.render('rising')}catch(error){
        currentMode='table';
        console.warn('The Last Reading: table-to-attic promotion failed; remounting the attic.',error);
        document.body.classList.remove(PENDING);
        clearSceneStyle(nextScene);
        handle.observeSeat();
        return null;
      }
      if(window.__tlrTableSeat===handle)delete window.__tlrTableSeat;
      window.__tlrAttic3d=handle;
      let finished=false;
      const started=performance.now();
      const finish=()=>{
        if(destroyed||finished)return;
        finished=true;
        clearTimeout(timer);
        nextScene.style.setProperty('opacity','1','important');
        nextScene.style.setProperty('pointer-events','auto','important');
        nextScene.style.setProperty('transition','none','important');
        container.id=ATTIC_ID;
        nextScene.insertBefore(container,nextScene.querySelector('#obalsHud'));
        document.body.classList.add(LIVE);
        document.body.classList.remove(SEATED,PENDING);
        clearTableAnchors();
        try{handle.render('attic')}catch(error){console.warn('The Last Reading: promoted attic failed to become interactive.',error);handle.destroy();return}
        hint=showHint(nextScene);
        handle.observeAttic();
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!destroyed)clearSceneStyle(nextScene)}));
      };
      const wait=()=>{
        if(destroyed||finished)return;
        const phase=handle.api?.getState?.().phase;
        if(phase==='free'||performance.now()-started>=STAND_CEILING)finish();
        else timer=setTimeout(wait,50);
      };
      timer=setTimeout(wait,0);
      return handle;
    },
    beginTableReturn(){
      if(destroyed||(currentMode!=='attic'&&currentMode!=='rising'))return false;
      document.body.classList.add(RETURNING);
      hint?.dismiss?.();
      return true;
    },
    convertToSeat(){
      if(destroyed||transferringToSeat)return currentMode==='table'?handle:null;
      if(currentMode==='table')return window.__tlrTableSeat===handle?handle:null;
      if((currentMode!=='attic'&&currentMode!=='rising')||!document.body.classList.contains('single-player-v2'))return null;

      transferringToSeat=true;
      observer?.disconnect();
      clearTimeout(timer);
      hint?.el?.remove();
      hint=null;
      document.body.classList.add(RETURNING);
      container.id=SEAT_ID;
      container.classList.remove('fade');
      document.body.append(container);
      let done=false;
      const finish=()=>{
        if(destroyed||done)return;
        done=true;
        clearTimeout(returnTimer);
        document.body.classList.remove(RETURNING);
        document.querySelectorAll('.table3d-reveal-veil').forEach(el=>el.remove());
      };

      try{handle.render('table',{onTableReady:finish})}catch(error){
        transferringToSeat=false;
        currentMode='attic';
        console.warn('The Last Reading: continuous attic return failed.',error);
        container.id=ATTIC_ID;
        activeScene?.insertBefore(container,activeScene.querySelector('#obalsHud'));
        handle.observeAttic();
        return null;
      }

      document.body.classList.add(SEATED);
      document.body.classList.remove(LIVE,PENDING);
      clearSceneStyle(activeScene);
      if(window.__tlrAttic3d===handle)delete window.__tlrAttic3d;
      window.__tlrTableSeat=handle;
      transferringToSeat=false;
      handle.observeSeat();
      returnTimer=setTimeout(finish,RETURN_CEILING);
      return handle;
    },
    // Compatibility alias for older callers; the operation is a transfer, not
    // an unmount, and unmount itself remains destructive for the active owner.
    returnToTable(){return handle.convertToSeat()},
  };
  return handle;
}

export function mountAttic3D(adapter){
  const scene=document.getElementById('atticScene');
  if(!scene||document.getElementById(ATTIC_ID))return null;
  if(!webglAvailable()){console.warn('The Last Reading: WebGL unavailable, keeping the classic attic.');return null}
  const container=document.createElement('div');
  container.id=ATTIC_ID;
  scene.insertBefore(container,scene.querySelector('#obalsHud'));
  const root=createRoot(container),handle=makeRoomHandle(container,root,adapter,'attic',scene);
  try{handle.render('attic')}catch(error){console.warn('The Last Reading: 3D attic failed to start, keeping the classic attic.',error);handle.destroy();return null}
  return handle.activateAttic();
}

export function mountTableApproach({onDone}={}){
  if(document.getElementById(APPROACH_ID)||document.getElementById(SEAT_ID)||!webglAvailable())return null;
  const container=document.createElement('div');container.id=APPROACH_ID;document.body.append(container);
  const root=createRoot(container),adapter=stubAdapter();
  let disposed=false,converted=false,sequenceDone=false,gate=null,safety=0,observer=null;
  const dispose=()=>{if(disposed||converted)return;disposed=true;handle.mounted=false;clearTimeout(safety);observer?.disconnect();try{root.unmount()}catch(error){console.warn('The Last Reading: approach overlay unmount failed.',error)}container.remove();if(window.__tlrTable3d===handle)delete window.__tlrTable3d;onDone?.()};
  const convert=()=>{
    if(disposed||converted)return;
    converted=true;clearTimeout(safety);observer?.disconnect();
    const veil=document.createElement('div');veil.className='table3d-reveal-veil';document.body.append(veil);setTimeout(()=>veil.classList.add('out'),650);setTimeout(()=>veil.remove(),1300);
    container.id=SEAT_ID;container.classList.remove('fade');
    const seat=makeRoomHandle(container,root,adapter,'table');
    try{seat.render('table')}catch(error){console.warn('The Last Reading: approach could not become the seated table.',error);seat.destroy();onDone?.();return}
    document.body.classList.add(SEATED);document.body.classList.remove(PENDING);seat.observeSeat();window.__tlrTableSeat=seat;handle.mounted=false;if(window.__tlrTable3d===handle)delete window.__tlrTable3d;onDone?.();
  };
  const maybe=()=>{if(!sequenceDone)return;gate?gate.finally(convert):convert()};
  const handle={mounted:true,api:null,completeWith(promise){gate=Promise.resolve(promise).catch(()=>{});maybe()},abort:dispose,skip(){handle.api?.skip?.()}};
  try{root.render(createElement(AtticExperience,{adapter,mode:'approach',onSequenceComplete:()=>{sequenceDone=true;maybe()},registerApi:api=>{handle.api=api}}))}catch(error){console.warn('The Last Reading: approach overlay failed to start.',error);dispose();return null}
  observer=new MutationObserver(()=>{if(document.body.classList.contains('main-menu-active'))dispose()});observer.observe(document.body,{attributes:true,attributeFilter:['class']});safety=setTimeout(convert,14000);window.__tlrTable3d=handle;return handle;
}

export function mountSeatedTable(){
  if(document.getElementById(SEAT_ID))return window.__tlrTableSeat?.mounted!==false?window.__tlrTableSeat:null;
  if(!webglAvailable()||!document.body.classList.contains('single-player-v2'))return null;
  const container=document.createElement('div');container.id=SEAT_ID;document.body.append(container);
  const root=createRoot(container),handle=makeRoomHandle(container,root,stubAdapter(),'table');
  try{handle.render('table')}catch(error){console.warn('The Last Reading: seated table failed to start.',error);handle.destroy();return null}
  document.body.classList.add(SEATED);document.body.classList.remove(PENDING);handle.observeSeat();window.__tlrTableSeat=handle;return handle;
}
