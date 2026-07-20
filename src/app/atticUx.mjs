// Cross-surface attic UX: transition cleanup, preferences, and the tabletop book.
import { POSES } from '../three/atticLayout.mjs';

const INVERT_KEY='tlr_attic_invert_drag';
const STYLE_ID='tlr-attic-ux-style';
const BOOK_ID='atticBookOverlay';
const MENU_ID='atticInvertLookSetting';

// Free movement begins on the table side of the chair, leaving the chair behind.
if(Array.isArray(POSES?.standing?.eye))POSES.standing.eye[2]=1.42;

function readInvert(target){try{return target.localStorage.getItem(INVERT_KEY)==='1'}catch{return false}}
function stripInteractive(root){
  root.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  root.querySelectorAll('[onclick],[onpointerdown],[onchange],[oninput]').forEach(el=>{
    ['onclick','onpointerdown','onchange','oninput'].forEach(name=>el.removeAttribute(name));
  });
  root.querySelectorAll('button,input,select,textarea').forEach(el=>el.remove());
}
function clonePage(doc,selectors,fallback){
  for(const selector of selectors){
    const source=doc.querySelector(selector);
    if(!source?.innerHTML.trim())continue;
    const copy=doc.createElement('div');copy.className='attic-book-copy';copy.innerHTML=source.innerHTML;stripInteractive(copy);return copy;
  }
  const empty=doc.createElement('p');empty.className='attic-book-empty';empty.textContent=fallback;return empty;
}
function checkRow(doc,label,checked,onChange,invert=false){
  const row=doc.createElement('label');row.className='attic-book-setting';
  const input=doc.createElement('input');input.type='checkbox';input.checked=!!checked;if(invert)input.dataset.tlrInvertLook='1';
  input.addEventListener('change',()=>onChange(input.checked));row.append(input,doc.createTextNode(label));return row;
}
function rangeRow(doc,label,value,onInput){
  const row=doc.createElement('label');row.className='attic-book-setting attic-book-range';
  const input=doc.createElement('input');input.type='range';input.min='0';input.max='1';input.step='.05';input.value=String(value);
  input.addEventListener('input',()=>onInput(Number(input.value)));row.append(doc.createTextNode(label),input);return row;
}
function settingsPage(target,setInvert){
  const doc=target.document,page=doc.createElement('div');page.className='attic-book-settings';
  const music=doc.getElementById('musicVol'),effects=doc.getElementById('sfxVol'),candle=doc.getElementById('candlelightLighting'),relic=doc.getElementById('hintRelics');
  page.append(
    rangeRow(doc,'Music',Number(music?.value??.3),value=>{if(music)music.value=String(value);target.setMusicVol?.(value)}),
    rangeRow(doc,'Effects',Number(effects?.value??1),value=>{if(effects)effects.value=String(value);target.setSfxVol?.(value)}),
    checkRow(doc,'Candlelight lighting',candle?.checked??true,on=>{if(candle)candle.checked=on;target.tlrSetCandlelightLighting?.(on)}),
    checkRow(doc,'Invert drag look',readInvert(target),setInvert,true),
    checkRow(doc,'Relic hints',relic?.checked,on=>{if(relic)relic.checked=on;target.toggleHintSetting?.('relics',on)}),
  );
  const hints=doc.createElement('div');hints.className='attic-book-setting attic-book-hints';hints.append('Scoring hints');
  const segments=doc.createElement('div');segments.className='attic-book-segments';
  const active=Number(doc.querySelector('#hintLevelBar .hint-level-seg.active')?.dataset.level||0);
  ['None','Glow','Text'].forEach((label,index)=>{const button=doc.createElement('button');button.type='button';button.textContent=label;button.classList.toggle('active',index===active);button.addEventListener('click',()=>{target.setHintLevel?.(index);segments.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===index))});segments.append(button)});
  hints.append(segments);page.append(hints);return page;
}
function installBook(target,setInvert){
  const doc=target.document;
  const close=()=>{doc.getElementById(BOOK_ID)?.remove();doc.removeEventListener('keydown',escape,true)};
  const escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close()}};
  const open=(initial='scoring')=>{
    close();target.tlrCloseArchives?.();target.dispatchEvent(new Event('blur'));
    const root=doc.createElement('div');root.id=BOOK_ID;root.dataset.gameTerms='off';
    root.innerHTML='<div class="attic-book-shell" tabindex="-1" role="dialog" aria-modal="true" aria-label="Reading book"><button class="attic-book-close" type="button" aria-label="Close">×</button><nav class="attic-book-tabs"><button data-page="scoring">Scoring</button><button data-page="abilities">Abilities</button><button data-page="settings">Settings</button></nav><section class="attic-book-page"></section></div>';
    const page=root.querySelector('.attic-book-page'),tabs=[...root.querySelectorAll('[data-page]')];
    const show=name=>{page.replaceChildren();tabs.forEach(button=>button.classList.toggle('active',button.dataset.page===name));page.append(name==='settings'?settingsPage(target,setInvert):name==='abilities'?clonePage(doc,['#abilitiesPullDesk','#abilityRef'],'Ability descriptions are not available yet.'):clonePage(doc,['#scoringPullDesk','#ref'],'Scoring patterns are not available yet.'));page.scrollTop=0};
    tabs.forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();show(button.dataset.page)}));
    root.querySelector('.attic-book-close').addEventListener('click',close);root.addEventListener('pointerdown',event=>event.stopPropagation());root.addEventListener('click',event=>{if(event.target===root)close()});
    (doc.getElementById('atticScene')||doc.body).append(root);doc.addEventListener('keydown',escape,true);show(['scoring','abilities','settings'].includes(initial)?initial:'scoring');root.querySelector('.attic-book-shell')?.focus();return root;
  };
  target.tlrOpenAtticBook=open;target.tlrCloseAtticBook=close;
  new MutationObserver(()=>{if(!doc.body.classList.contains('mode-attic')&&!doc.body.classList.contains('mode-to-attic'))close()}).observe(doc.body,{attributes:true,attributeFilter:['class']});
}
function installInvertBridge(target){
  if(target.__tlrInvertedPointerBridgeInstalled)return;target.__tlrInvertedPointerBridgeInstalled=true;
  const starts=new Map(),synthetic=new WeakSet(),doc=target.document;
  const eligible=event=>event.target instanceof Element&&!!event.target.closest('#attic3dRoot canvas')&&doc.body.classList.contains('mode-attic');
  doc.addEventListener('pointerdown',event=>{if(eligible(event))starts.set(event.pointerId,{x:event.clientX,y:event.clientY})},true);
  doc.addEventListener('pointermove',event=>{
    if(synthetic.has(event)||!target.__tlrInvertAtticDrag||!eligible(event))return;const start=starts.get(event.pointerId);if(!start)return;
    let mirrored;try{mirrored=new PointerEvent('pointermove',{bubbles:true,cancelable:true,composed:true,pointerId:event.pointerId,pointerType:event.pointerType,isPrimary:event.isPrimary,clientX:start.x-(event.clientX-start.x),clientY:start.y-(event.clientY-start.y),button:event.button,buttons:event.buttons,pressure:event.pressure,width:event.width,height:event.height,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey})}catch{return}
    synthetic.add(mirrored);event.stopImmediatePropagation();event.preventDefault();event.target.dispatchEvent(mirrored);
  },true);
  const end=event=>starts.delete(event.pointerId);doc.addEventListener('pointerup',end,true);doc.addEventListener('pointercancel',end,true);
}
function installSurfaceGuard(target){
  const doc=target.document,blocked=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE']);
  doc.addEventListener('keydown',event=>{const open=doc.getElementById(BOOK_ID)||doc.getElementById('invWrap')?.classList.contains('open');if(open&&blocked.has(event.code)){event.preventDefault();event.stopImmediatePropagation()}},true);
  const archive=doc.getElementById('invWrap');if(archive)new MutationObserver(()=>{if(archive.classList.contains('open')&&doc.body.classList.contains('mode-attic'))target.dispatchEvent(new Event('blur'))}).observe(archive,{attributes:true,attributeFilter:['class']});
}
function ensureMenuToggle(target,setInvert){
  const doc=target.document,panel=doc.getElementById('settingsPanel');if(!panel||doc.getElementById(MENU_ID))return;
  const row=doc.createElement('label');row.id=MENU_ID;row.className='settings-check';row.innerHTML='<input type="checkbox" data-tlr-invert-look="1"> Invert drag look';const input=row.querySelector('input');input.checked=readInvert(target);input.addEventListener('change',()=>setInvert(input.checked));
  const candle=doc.getElementById('candlelightLighting')?.closest('label');candle?.parentElement===panel?candle.insertAdjacentElement('afterend',row):panel.append(row);
}
function installStyles(doc){
  if(doc.getElementById(STYLE_ID))return;const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
body.mode-to-attic .spread-actions,body.attic3d-pending .spread-actions,body.mode-attic .spread-actions,body.mode-to-attic #discardBtn,body.mode-to-attic #purgeBtn,body.mode-to-attic #spv2DiscardBadge,body.attic3d-pending #discardBtn,body.attic3d-pending #purgeBtn,body.attic3d-pending #spv2DiscardBadge,body.mode-attic #discardBtn,body.mode-attic #purgeBtn,body.mode-attic #spv2DiscardBadge{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}
body.mode-to-attic .spread-actions::before,body.attic3d-pending .spread-actions::before,body.mode-attic .spread-actions::before{content:none!important;display:none!important;opacity:0!important;visibility:hidden!important}
body.mode-attic.attic3d-live #invWrap.open{transform:translateY(0)!important;pointer-events:auto!important;z-index:10095!important}
#summary .result-panel .game-term{color:inherit!important;background:none!important;border:0!important;box-shadow:none!important;padding:0!important;text-decoration:none!important;font:inherit!important;cursor:inherit!important}#summary .result-panel .game-term::before,#summary .result-panel .game-term::after{content:none!important;display:none!important}
#${BOOK_ID}{position:absolute;inset:0;z-index:10160;display:grid;place-items:center;padding:18px;background:rgba(4,2,1,.74);pointer-events:auto}.attic-book-shell{position:relative;width:min(920px,94vw);height:min(690px,88dvh);padding:58px 38px 30px;overflow:hidden;border:2px solid #6f4d25;border-radius:20px;background:linear-gradient(90deg,#d7c28f,#ead9ad 47%,#c5aa70 50%,#ead9ad 53%,#d7c28f);box-shadow:0 34px 90px #000c,inset 0 0 34px #4e2c1040;color:#2a1a10;font-family:Georgia,serif}.attic-book-close{position:absolute;right:12px;top:8px;border:0;background:transparent;color:#4d2f18;font:700 30px/1 Georgia;cursor:pointer}.attic-book-tabs{position:absolute;left:28px;right:50px;top:13px;display:flex;gap:7px}.attic-book-tabs button{padding:8px 15px;border:1px solid #5b38187a;border-bottom:0;border-radius:9px 9px 2px 2px;background:#b89559;color:#3a2414;font:700 12px Georgia;cursor:pointer}.attic-book-tabs button.active{background:#ead9ad;box-shadow:0 -3px 9px #ffeeb96b}.attic-book-page{height:100%;overflow:auto;padding:12px 18px}.attic-book-copy{font-size:14px;line-height:1.5}.attic-book-copy table{width:100%;border-collapse:collapse}.attic-book-copy td,.attic-book-copy th{padding:8px;border-bottom:1px solid #52331842;text-align:left;vertical-align:top}.attic-book-empty{text-align:center;margin-top:15%;font-style:italic;color:#6b5134}.attic-book-settings{width:min(480px,100%);margin:auto;display:grid;gap:10px}.attic-book-setting{display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #53341940;font-weight:700}.attic-book-range{justify-content:space-between}.attic-book-range input{width:min(230px,48%)}.attic-book-setting input[type=checkbox]{width:20px;height:20px;accent-color:#735329}.attic-book-hints{align-items:flex-start;flex-direction:column}.attic-book-segments{display:flex;width:100%;gap:6px}.attic-book-segments button{flex:1;padding:9px;border:1px solid #886536;background:#6f4c201f;color:#3f2918;font:700 12px Georgia}.attic-book-segments button.active{background:#735329;color:#f2dfaf}@media(max-width:640px){.attic-book-shell{height:min(760px,91dvh);padding:58px 15px 22px;border-radius:14px}.attic-book-tabs{left:10px;right:42px;gap:4px}.attic-book-tabs button{flex:1;padding:8px 4px;font-size:10px}.attic-book-page{padding:8px 2px}}
`;doc.head.append(style);
}
export function installAtticUx(target=window){
  if(!target||target.__tlrAtticUxInstalled)return;target.__tlrAtticUxInstalled=true;const doc=target.document;
  target.__tlrInvertAtticDrag=readInvert(target);const setInvert=on=>{const value=!!on;target.__tlrInvertAtticDrag=value;try{target.localStorage.setItem(INVERT_KEY,value?'1':'0')}catch{}doc.querySelectorAll('[data-tlr-invert-look]').forEach(input=>input.checked=value);return value};
  target.tlrSetInvertAtticLook=setInvert;target.tlrGetInvertAtticLook=()=>!!target.__tlrInvertAtticDrag;
  installStyles(doc);installInvertBridge(target);installBook(target,setInvert);installSurfaceGuard(target);ensureMenuToggle(target,setInvert);
  new MutationObserver(()=>ensureMenuToggle(target,setInvert)).observe(doc.body,{childList:true,subtree:true});
}
