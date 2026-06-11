// Pull-tab drawer controller (Phase 16.4). Owns the legacy drawer globals,
// tab dragging, drawer height fitting, and the scoring reference sheet render.

const LABELS={scoring:'Scoring',abilities:'Abilities',menu:'Menu'};
const CONTENT={scoring:'ref',abilities:'abilityRef',menu:'settingsPanel'};
const DEFAULT_X={scoring:target=>Math.max(0,target.innerWidth/2-142),abilities:target=>Math.max(0,target.innerWidth/2-40),menu:()=>14};
const DRAWER_HEIGHTS=[
  {id:'scoring',min:92,max:260},
  {id:'abilities',min:112,max:360},
  {id:'menu',min:150,max:380}
];

function fmtBonus(v){return '+'+Number(v).toFixed(2).replace(/\.?0+$/,'');}

export function installDrawers(target = window){
  if(!target || target.__tlrDrawersInstalled)return;

  // Temporary migration guard: while the legacy inline drawer IIFEs still run
  // before src/app/main.mjs, they define tlrTogglePullTab and bind their own
  // pointer listeners. Do not double-bind. Once the inline block is deleted,
  // this module becomes the active owner automatically.
  if(typeof target.tlrTogglePullTab === 'function' && !target.tlrTogglePullTab.__tlrDrawerModuleOwned){
    target.__tlrLegacyInlineDrawersDetected=true;
    return;
  }

  target.__tlrDrawersInstalled=true;

  function closeOthers(id){
    for(const k of Object.keys(LABELS)){
      if(k===id)continue;
      const w=document.getElementById(k+'PullWrap');
      const t=document.getElementById(k+'PullTab');
      if(w)w.classList.remove('open');
      if(t)t.innerHTML='&#9660; '+LABELS[k];
    }
  }

  function togglePullTab(id){
    const w=document.getElementById(id+'PullWrap');
    const t=document.getElementById(id+'PullTab');
    if(!w||!t)return;
    const opening=!w.classList.contains('open');
    w.classList.toggle('open',opening);
    t.innerHTML=(opening?'&#9650; ':'&#9660; ')+LABELS[id];
    if(opening)closeOthers(id);
  }
  togglePullTab.__tlrDrawerModuleOwned=true;

  function placeDrawerContent(){
    for(const id of Object.keys(LABELS)){
      const desk=document.getElementById(id+'PullDesk');
      const tab=document.getElementById(id+'PullTab');
      const content=document.getElementById(CONTENT[id]);
      if(desk&&content&&!desk.contains(content))desk.appendChild(content);
      if(content)content.classList.remove('hidden');
      if(tab){
        const savedX=target.localStorage.getItem('tlr_'+id+'_pull_tab_x');
        const fallback=DEFAULT_X[id](target);
        tab.style.left=(savedX!==null?Math.max(0,Math.min(target.innerWidth-86,parseFloat(savedX))):fallback)+'px';
      }
    }
  }

  function installTabDrag(){
    for(const id of Object.keys(LABELS)){
      const tab=document.getElementById(id+'PullTab');
      if(!tab||tab.__tlrDrawerDragBound)continue;
      tab.__tlrDrawerDragBound=true;
      let psx=0,startLeft=0,moved=false,active=false;
      tab.addEventListener('pointerdown',e=>{
        tab.setPointerCapture(e.pointerId);
        psx=e.clientX;startLeft=parseFloat(tab.style.left)||0;moved=false;active=true;
      },{passive:true});
      tab.addEventListener('pointermove',e=>{
        if(!active)return;
        const dx=e.clientX-psx;
        if(Math.abs(dx)>5){moved=true;tab.style.left=Math.max(0,Math.min(target.innerWidth-86,startLeft+dx))+'px';}
      },{passive:true});
      tab.addEventListener('pointerup',()=>{
        if(!active)return;active=false;
        if(moved)try{target.localStorage.setItem('tlr_'+id+'_pull_tab_x',parseFloat(tab.style.left)||0);}catch(e){}
      },{passive:true});
    }
  }

  function clampTabPositions(){
    for(const id of Object.keys(LABELS)){
      const tab=document.getElementById(id+'PullTab');
      if(!tab)continue;
      const cur=parseFloat(tab.style.left)||0;
      const c=Math.max(0,Math.min(target.innerWidth-86,cur));
      if(c!==cur)tab.style.left=c+'px';
    }
  }

  function fitDrawerHeights(){
    for(const d of DRAWER_HEIGHTS){
      const wrap=document.getElementById(d.id+'PullWrap');
      const desk=document.getElementById(d.id+'PullDesk');
      if(!wrap||!desk)continue;
      const viewportScale=target.innerWidth<641?0.72:0.62;
      const maxByViewport=Math.max(d.min,Math.floor(target.innerHeight*viewportScale));
      const max=Math.min(d.max,maxByViewport);
      const oldHeight=desk.style.getPropertyValue('height');
      const oldOverflow=desk.style.getPropertyValue('overflow');
      desk.style.setProperty('height','auto','important');
      desk.style.setProperty('overflow','visible','important');
      const measured=Math.ceil(desk.scrollHeight)+2;
      if(oldHeight)desk.style.setProperty('height',oldHeight);else desk.style.removeProperty('height');
      if(oldOverflow)desk.style.setProperty('overflow',oldOverflow);else desk.style.removeProperty('overflow');
      const targetHeight=Math.max(d.min,Math.min(max,measured));
      wrap.style.setProperty('--tlr-drawer-h',targetHeight+'px');
      desk.style.setProperty('overflow',measured>max?'auto':'visible','important');
    }
  }

  function renderDrawerScoringSheet(){
    const el=document.getElementById('ref');
    if(!el)return;
    const persist=target.persist||{};
    const u=persist.up||{};
    const rankBonus=(u.rank||0)*5;
    const rankMult=+(1.25+(u.rank_mult||0)*0.25).toFixed(2);
    const courtChips=(u.court_chips||0)*8;
    const courtMult=+(1.5+(u.court_mult||0)*0.25).toFixed(2);
    const seqBonus=(u.sequence||0)*5;
    const seqMult=+(1.25+(u.seq_mult||0)*0.5).toFixed(2);
    const pathChips=(u.path_chips||0)*15;
    const pathMult=+(2+(u.path_mult||0)*0.5).toFixed(2);
    const rows=[
      ['arc','Minor Arcana','',''],
      ['Three of a Kind','3 matching court ranks','+'+(5+rankBonus),fmtBonus(rankMult-1)],
      ['Four of a Kind','4 matching court ranks','+'+(7+rankBonus),fmtBonus(rankMult-1)],
      ['Full Court (3/4)','Consecutive ranks','+'+(10+courtChips),fmtBonus(courtMult-1)],
      ['Royal Court (3/4)','Consecutive ranks, same suit','+'+(10+courtChips),fmtBonus(courtMult-1)],
      ['arc','Major Arcana','',''],
      ['Sequence (3/4/5)','Consecutive major arcana','+'+(10+seqBonus),fmtBonus(seqMult-1)],
      ['Path of the Magi','0·I·XXI in spread','+'+(10+pathChips),fmtBonus(pathMult-1)]
    ];
    let out='<table><tbody>';
    out+='<tr><td></td><td></td><td class="score-head r"><span class="chips">Bonus</span><span class="mult">Mult</span></td></tr>';
    for(const r of rows){
      if(r[0]==='arc'){out+='<tr class="arcana-row"><td colspan="3">'+r[1]+'</td></tr>';continue;}
      out+='<tr><td>'+r[0]+'</td><td class="m">'+r[1]+'</td><td class="r"><span class="chips">'+r[2]+'</span><span class="mult">'+r[3]+'</span></td></tr>';
    }
    out+='</tbody></table>';
    el.className='ref scoring-sheet';
    el.innerHTML=out;
    target.requestAnimationFrame(fitDrawerHeights);
  }

  function installFitHooks(){
    for(const id of Object.keys(LABELS)){
      const tab=document.getElementById(id+'PullTab');
      if(tab&&!tab.__drawerFitHooked){
        tab.__drawerFitHooked=true;
        tab.addEventListener('pointerup',()=>setTimeout(()=>{if(id==='scoring')renderDrawerScoringSheet();fitDrawerHeights();},0),true);
        tab.addEventListener('click',()=>setTimeout(()=>{if(id==='scoring')renderDrawerScoringSheet();fitDrawerHeights();},0),true);
      }
    }
  }

  function initializeDrawers(){
    placeDrawerContent();
    installTabDrag();
    renderDrawerScoringSheet();
    target.requestAnimationFrame(()=>{
      fitDrawerHeights();
      target.requestAnimationFrame(()=>{
        Object.keys(LABELS).forEach(id=>{
          const w=document.getElementById(id+'PullWrap');
          if(w)w.style.transition='';
        });
      });
    });
    installFitHooks();
  }

  target.tlrTogglePullTab=togglePullTab;
  target.toggleRef=function(e){if(e)e.stopPropagation();renderDrawerScoringSheet();togglePullTab('scoring');};
  target.toggleAbilityRef=function(e){if(e)e.stopPropagation();togglePullTab('abilities');};
  target.toggleMenu=function(){togglePullTab('menu');};
  target.tlrFitDrawerHeights=fitDrawerHeights;
  target.tlrRenderDrawerScoringSheet=renderDrawerScoringSheet;

  initializeDrawers();
  target.addEventListener('resize',()=>{clampTabPositions();setTimeout(fitDrawerHeights,40);});
}
