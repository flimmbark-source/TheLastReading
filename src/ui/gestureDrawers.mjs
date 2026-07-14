// Pull-tab drawer gesture/controller module (Step 4).
// Owns tab drag persistence, drawer height fitting, scoring sheet refresh, and tab fan layout.

const LABELS={scoring:'Scoring',abilities:'Abilities',menu:'Menu'};
const CONTENT={scoring:'ref',abilities:'abilityRef',menu:'settingsPanel'};
const DEFAULT_X={scoring:target=>Math.max(0,target.innerWidth/2-142),abilities:target=>Math.max(0,target.innerWidth/2-40),menu:()=>14};
const DRAWER_HEIGHTS=[
  {id:'scoring',min:92,max:260},
  {id:'abilities',min:112,max:360},
  {id:'menu',min:150,max:440}
];
const FAN_TABS=[
  {id:'menuPullTab',key:'tlr_menu_pull_tab_x',w:86,label:'Menu'},
  {id:'scoringPullTab',key:'tlr_scoring_pull_tab_x',w:86,label:'Scoring'},
  {id:'abilitiesPullTab',key:'tlr_abilities_pull_tab_x',w:86,label:'Abilities'},
  {id:'invTab',key:'tlr_tab_x',w:80,label:'Archives'}
];

function fmtBonus(v){return '+'+Number(v).toFixed(2).replace(/\.?0+$/,'');}

export function installGestureDrawers(target = window){
  if(!target || target.__tlrGestureDrawersInstalled)return;
  target.__tlrGestureDrawersInstalled=true;

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
    if(opening){
      closeOthers(id);
      target.requestAnimationFrame?.(fitDrawerHeights);
    }
    if(id==='scoring'&&typeof target.tutSignal==='function'){
      target.tutSignal(opening?'scoringOpened':'scoringClosed');
    }
  }
  function moveContentIntoDesks(){
    for(const id of Object.keys(LABELS)){
      const desk=document.getElementById(id+'PullDesk');
      const tab=document.getElementById(id+'PullTab');
      const content=document.getElementById(CONTENT[id]);
      if(desk&&content&&!desk.contains(content))desk.appendChild(content);
      if(content)content.classList.remove('hidden');
      if(tab){
        const savedX=target.localStorage.getItem('tlr_'+id+'_pull_tab_x');
        tab.style.left=(savedX!==null?Math.max(0,Math.min(target.innerWidth-86,parseFloat(savedX))):DEFAULT_X[id](target))+'px';
      }
    }
  }

  function installTabDrag(){
    for(const id of Object.keys(LABELS)){
      const tab=document.getElementById(id+'PullTab');
      if(!tab||tab.__tlrGestureDrawerDragBound)continue;
      tab.__tlrGestureDrawerDragBound=true;
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
      const desiredMin=d.id==='menu'?Math.min(max,360):d.min;
      const targetHeight=Math.max(desiredMin,Math.min(max,measured));
      wrap.style.setProperty('--tlr-drawer-h',targetHeight+'px');
      desk.style.setProperty('overflow',measured>max?'auto':'visible','important');
      if(d.id==='menu'){
        // The settings panel can be taller than its measured drawer height on
        // narrow screens after mode transitions. Never allow the open menu
        // drawer to use visible overflow; keep the controls contained and let
        // the drawer scroll instead.
        desk.style.setProperty('overflow-x','hidden','important');
        desk.style.setProperty('overflow-y','auto','important');
      }
    }
  }

  function renderDrawerScoringSheet(){
    const el=document.getElementById('ref');
    if(!el)return;
    const persist=target.persist||{};
    const u=persist.up||{};
    const rankBonus=(u.rank||0)*5;
    const rankMult=+(1.25+(u.rank_mult||0)*0.25).toFixed(2);
    const fullCourtChips=(u.court_chips||0)*8;
    const fullCourtMult=+(1.25+(u.court_mult||0)*0.25).toFixed(2);
    const royalCourtChips=(u.royal_court_chips||0)*8;
    const royalCourtMult=+(1.5+(u.royal_court_mult||0)*0.25).toFixed(2);
    const seqBonus=(u.sequence||0)*5;
    const seqMult=+(1.25+(u.seq_mult||0)*0.5).toFixed(2);
    const pathChips=(u.path_chips||0)*15;
    const pathMult=+(2+(u.path_mult||0)*0.5).toFixed(2);
    const rows=[
      ['arc','Minor Arcana','',''],
      ['(3/4)) of a Kind','Matching ranks','+'+(5+rankBonus),fmtBonus(rankMult-1)],
      ['Full Court (3/4)','Consecutive ranks','+'+(10+fullCourtChips),fmtBonus(fullCourtMult-1)],
      ['Royal Court (3/4)','Consecutive ranks, same suit','+'+(10+royalCourtChips),fmtBonus(royalCourtMult-1)],
      ['arc','Major Arcana','',''],
      ['Sequence (3/4/5)','Consecutive major arcana','+'+(15+seqBonus),fmtBonus(seqMult-1)],
      ['Path of the Magi','0·I·XXI in spread','+'+(15+pathChips),fmtBonus(pathMult-1)]
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

  function existingFanTabs(){
    return FAN_TABS.map(t=>Object.assign({},t,{el:document.getElementById(t.id)})).filter(t=>t.el);
  }

  function discardsAnchorX(){
    const disc=document.querySelector('.discards-pill');
    if(disc){
      const r=disc.getBoundingClientRect();
      if(r.width)return Math.round(r.right+10);
    }
    return Math.round(target.innerWidth-98);
  }

  function seedDefaultPositions(){
    const gap=target.innerWidth<390?6:10;
    const found=existingFanTabs();
    if(found.length<2)return;
    const byId={};found.forEach(t=>byId[t.id]=t);
    const isDesktop=target.matchMedia('(min-width:641px)').matches;
    if(isDesktop){
      let x=14;
      for(const id of ['menuPullTab','scoringPullTab','abilitiesPullTab']){
        const t=byId[id];if(!t)continue;
        const nx=Math.max(0,Math.min(target.innerWidth-t.w,x));
        t.el.style.left=nx+'px';
        try{target.localStorage.setItem(t.key,String(nx));}catch(e){}
        x=nx+t.w+gap;
      }
      const a=byId.invTab;
      if(a){
        const nx=Math.max(0,Math.min(target.innerWidth-a.w,discardsAnchorX()));
        a.el.style.left=nx+'px';
        try{target.localStorage.setItem(a.key,String(nx));}catch(e){}
      }
      return;
    }
    const total=found.reduce((s,t)=>s+t.w,0)+gap*(found.length-1);
    let x=Math.max(6,Math.round((target.innerWidth-total)/2));
    for(const t of found){
      const nx=Math.max(0,Math.min(target.innerWidth-t.w,x));
      t.el.style.left=nx+'px';
      try{target.localStorage.setItem(t.key,String(nx));}catch(e){}
      x+=t.w+gap;
    }
  }

  function fanTabs(){
    const found=existingFanTabs().map(t=>{
      const r=t.el.getBoundingClientRect();
      const left=parseFloat(t.el.style.left);
      return Object.assign(t,{x:Number.isFinite(left)?left:r.left});
    });
    if(found.length<2)return;
    const gap=target.innerWidth<390?6:10;
    found.sort((a,b)=>a.x-b.x);
    for(let i=0;i<found.length;i++){
      const min=i?found[i-1].x+found[i-1].w+gap:6;
      found[i].x=Math.max(found[i].x,min);
    }
    const last=found[found.length-1];
    const overflow=(last.x+last.w+6)-target.innerWidth;
    if(overflow>0){
      for(let i=found.length-1;i>=0;i--)found[i].x-=overflow;
      for(let i=0;i<found.length;i++){
        const min=i?found[i-1].x+found[i-1].w+gap:6;
        found[i].x=Math.max(found[i].x,min);
      }
    }
    for(const t of found){
      const nx=Math.max(0,Math.min(target.innerWidth-t.w,Math.round(t.x)));
      t.el.style.left=nx+'px';
      try{target.localStorage.setItem(t.key,String(nx));}catch(e){}
    }
  }

  function installPullTabFan(){
    if(target.__tlrPullTabFanInstalled)return;
    target.__tlrPullTabFanInstalled=true;
    try{
      if(target.localStorage.getItem('tlr_pull_tabs_fanned_v2')!=='1'){
        seedDefaultPositions();
        target.localStorage.setItem('tlr_pull_tabs_fanned_v2','1');
      }
    }catch(e){seedDefaultPositions();}
    target.requestAnimationFrame(fanTabs);
    document.addEventListener('pointerup',()=>setTimeout(fanTabs,0),true);
    target.addEventListener('resize',()=>setTimeout(()=>{seedDefaultPositions();fanTabs();},30));
  }

  target.tlrTogglePullTab=togglePullTab;
  target.toggleRef=function(e){if(e)e.stopPropagation();renderDrawerScoringSheet();togglePullTab('scoring');};
  target.toggleAbilityRef=function(e){if(e)e.stopPropagation();togglePullTab('abilities');};
  target.toggleMenu=function(){togglePullTab('menu');};
  target.tlrFitDrawerHeights=fitDrawerHeights;
  target.tlrRenderDrawerScoringSheet=renderDrawerScoringSheet;
  target.tlrFanPullTabs=fanTabs;

  moveContentIntoDesks();
  installTabDrag();
  installPullTabFan();
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
  target.addEventListener('resize',()=>{clampTabPositions();setTimeout(fitDrawerHeights,40);});

  for(const id of ['scoring','abilities','menu']){
    const tab=document.getElementById(id+'PullTab');
    if(tab&&!tab.__drawerFitHooked){
      tab.__drawerFitHooked=true;
      tab.addEventListener('pointerup',()=>setTimeout(()=>{if(id==='scoring')renderDrawerScoringSheet();fitDrawerHeights();},0),true);
      tab.addEventListener('click',()=>setTimeout(()=>{if(id==='scoring')renderDrawerScoringSheet();fitDrawerHeights();},0),true);
    }
  }
}
