const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* drawer tabs and desktop drift patch */';
if (html.includes(marker)) {
  console.log('Drawer tabs/desktop drift patch already present, skipping.');
  process.exit(0);
}

let changed = 0;
function rep(oldText, newText, label) {
  if (html.includes(oldText)) {
    html = html.replace(oldText, newText);
    console.log('  ✓', label);
    changed++;
  } else {
    console.warn('  WARN: not found —', label);
  }
}

console.log('Drawer tabs / desktop drift patch:');

html = html.replace('</style>', `
${marker}
/* Archives-style pull drawers for Scoring / Abilities / Menu */
#scoringBtn,#abilitiesBtn,#menuBtn{display:none!important}
.tlr-pull-wrap{position:fixed;top:0;left:0;right:0;z-index:150;transform:translateY(calc(-1 * var(--inv-h)));transition:transform .45s cubic-bezier(.34,1.28,.64,1);pointer-events:none}
.tlr-pull-wrap.open{transform:translateY(0);pointer-events:auto;z-index:400}
.tlr-pull-desk{height:var(--inv-h);border-bottom:2px solid #6a4c24;position:relative;overflow:auto;pointer-events:auto;padding:18px 18px 24px;box-shadow:0 16px 38px rgba(0,0,0,.45)}
.tlr-pull-desk::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 90% 70% at 50% 110%,rgba(90,45,5,.22),transparent 65%)}
.tlr-pull-desk>*{position:relative;z-index:1}
.tlr-pull-tab{position:absolute;top:var(--inv-h);left:calc(50% - 40px);width:86px;height:28px;background:linear-gradient(180deg,#2e1e0e,#1e1208);border:1px solid #6a4c24;border-top:none;border-radius:0 0 10px 10px;cursor:grab;color:#a07838;font-size:10px;font-weight:700;letter-spacing:.07em;text-align:center;line-height:28px;pointer-events:auto;transition:background .15s,color .15s,box-shadow .15s;padding:0;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,.5);touch-action:none;user-select:none;font-family:system-ui,Segoe UI,sans-serif}
.tlr-pull-tab:hover{background:linear-gradient(180deg,#3e2814,#281810);color:#ffd978;box-shadow:0 4px 14px rgba(0,0,0,.6)}
.tlr-pull-tab:active{cursor:grabbing}
.tlr-pull-wrap.parchment .tlr-pull-desk{background:linear-gradient(180deg,#eadbb7 0%,#cfb57d 55%,#ad8d52 100%);color:#2a160a;border-bottom-color:#8a6533}
.tlr-pull-wrap.parchment .tlr-pull-tab{background:linear-gradient(180deg,#e7d7ad,#b99a62);color:#2a1408;border-color:#8a6533;text-shadow:0 1px 0 rgba(255,240,190,.35)}
.tlr-pull-wrap.parchment .tlr-pull-tab:hover{background:linear-gradient(180deg,#f0dfb6,#c4a56a);color:#2a1408}
.tlr-pull-wrap.menu-brown .tlr-pull-desk{background:linear-gradient(180deg,#0e0704 0%,#1c1008 55%,#150d06 100%);color:#e4c189;border-bottom-color:#6a4c24}
.tlr-pull-wrap.menu-brown .tlr-pull-tab{background:linear-gradient(180deg,#2e1e0e,#1e1208);color:#a07838;border-color:#6a4c24}
.tlr-pull-wrap.menu-brown .tlr-pull-tab:hover{background:linear-gradient(180deg,#3e2814,#281810);color:#ffd978}
#scoringPullDesk .ref,#abilitiesPullDesk .ref{display:block!important;max-width:min(92vw,760px)!important;margin:0 auto!important;background:transparent!important;border:none!important;border-radius:0!important;box-shadow:none!important;padding:8px 6px 4px!important;color:#2a160a!important;font-family:Georgia,serif!important;pointer-events:auto!important}
#scoringPullDesk .ref.hidden,#abilitiesPullDesk .ref.hidden{display:block!important}
#scoringPullDesk .ref table,#scoringPullDesk .ref td,#scoringPullDesk .ref th,#abilitiesPullDesk .ref table,#abilitiesPullDesk .ref td,#abilitiesPullDesk .ref th{color:#2a160a!important;border-color:rgba(77,45,18,.22)!important}
#scoringPullDesk .ref .r,#scoringPullDesk .scoring-sheet .r,#scoringPullDesk .scoring-sheet .score-head,#scoringPullDesk .scoring-sheet .arcana-row td,#abilitiesPullDesk .ref .r{color:#5b3515!important}
#menuPullDesk #settingsPanel{display:flex!important;position:relative!important;top:auto!important;left:auto!important;min-width:min(260px,86vw)!important;margin:0 auto!important;background:transparent!important;border:none!important;border-radius:0!important;box-shadow:none!important;color:#e4c189!important;padding:0!important;z-index:auto!important}
#menuPullDesk #settingsPanel.hidden{display:flex!important}
#menuPullDesk #settingsPanel .settings-title{color:#f0d58a!important;border-bottom-color:rgba(228,193,137,.22)!important}
#menuPullDesk #settingsPanel .settings-action{background:rgba(180,140,90,.18)!important;border-color:rgba(180,140,90,.45)!important;color:#e6c89a!important}
.refs-layer{display:none!important}
/* Restore a subtle hand cycle without fighting the swipe transform. */
@keyframes handCardIdleCycle{0%,100%{translate:0 0;rotate:0deg;filter:brightness(1)}50%{translate:0 -2px;rotate:.35deg;filter:brightness(1.035)}}
.hand:not(.hand-scroll-dragging):not(.has-selected-card) .card:not(.sel):not(.ability-picked):not(.purge-picked):not(.hand-card-dragging){animation:handCardIdleCycle 4.8s ease-in-out infinite}
.hand:not(.hand-scroll-dragging) .card:nth-child(2){animation-delay:-.8s}.hand:not(.hand-scroll-dragging) .card:nth-child(3){animation-delay:-1.6s}.hand:not(.hand-scroll-dragging) .card:nth-child(4){animation-delay:-2.4s}.hand:not(.hand-scroll-dragging) .card:nth-child(5){animation-delay:-3.2s}.hand:not(.hand-scroll-dragging) .card:nth-child(6){animation-delay:-4s}.hand:not(.hand-scroll-dragging) .card:nth-child(7){animation-delay:-4.8s}.hand:not(.hand-scroll-dragging) .card:nth-child(8){animation-delay:-5.6s}
@media(prefers-reduced-motion:reduce){.hand .card{animation:none!important}}
</style>`);
changed++;

// Reverse desktop horizontal drag/swipe direction only. Mobile touch keeps the current direction.
rep(
  `const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);`,
  `const _desktopDir=window.matchMedia('(pointer:fine)').matches?-1:1;const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE*_desktopDir);`,
  'Reverse desktop pointer drift direction'
);

// Reverse desktop horizontal wheel/trackpad drift direction.
rep(
  `applyOffset(softClamp(offset+dx*DEG_PER_SIDE_SCROLL));`,
  `applyOffset(softClamp(offset-dx*DEG_PER_SIDE_SCROLL));`,
  'Reverse desktop horizontal wheel drift direction'
);

html = html.replace('</script>', `
(function(){
  if(window.__tlrArchivesStylePullTabsInstalled)return;
  window.__tlrArchivesStylePullTabsInstalled=true;

  const defs=[
    {id:'scoring',label:'Scoring',content:'ref',kind:'parchment',x:()=>Math.max(0,window.innerWidth/2-142)},
    {id:'abilities',label:'Abilities',content:'abilityRef',kind:'parchment',x:()=>Math.max(0,window.innerWidth/2-40)},
    {id:'menu',label:'Menu',content:'settingsPanel',kind:'menu-brown',x:()=>14}
  ];

  const closeOtherPullTabs=id=>{
    for(const d of defs){
      if(d.id===id)continue;
      const w=document.getElementById(d.id+'PullWrap');
      const t=document.getElementById(d.id+'PullTab');
      if(w)w.classList.remove('open');
      if(t)t.innerHTML='&#9660; '+d.label;
    }
  };

  function makePullTab(def){
    const content=document.getElementById(def.content);
    if(!content)return;
    let wrap=document.getElementById(def.id+'PullWrap');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id=def.id+'PullWrap';
      wrap.className='tlr-pull-wrap '+def.kind;
      const desk=document.createElement('div');
      desk.id=def.id+'PullDesk';
      desk.className='tlr-pull-desk';
      const tab=document.createElement('button');
      tab.id=def.id+'PullTab';
      tab.type='button';
      tab.className='tlr-pull-tab';
      tab.innerHTML='&#9660; '+def.label;
      wrap.appendChild(desk);
      wrap.appendChild(tab);
      wrap.style.transition='none';
      document.body.insertBefore(wrap,document.getElementById('invWrap')||document.body.firstChild);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{wrap.style.transition='';}));
    }
    const desk=document.getElementById(def.id+'PullDesk');
    const tab=document.getElementById(def.id+'PullTab');
    if(desk&&!desk.contains(content))desk.appendChild(content);
    content.classList.remove('hidden');
    if(def.id==='menu')content.classList.remove('hidden');

    function setOpen(open){
      wrap.classList.toggle('open',open);
      tab.innerHTML=(open?'&#9650; ':'&#9660; ')+def.label;
      if(open)closeOtherPullTabs(def.id);
    }

    const savedX=localStorage.getItem('tlr_'+def.id+'_pull_tab_x');
    if(savedX!==null){
      tab.style.left=Math.max(0,Math.min(window.innerWidth-86,parseFloat(savedX)))+'px';
    }else{
      requestAnimationFrame(()=>{tab.style.left=Math.max(0,Math.min(window.innerWidth-86,def.x()))+'px';});
    }

    let psx=0,tabStartX=0,moved=false,active=false;
    tab.addEventListener('pointerdown',e=>{
      e.stopPropagation();
      tab.setPointerCapture(e.pointerId);
      psx=e.clientX;
      tabStartX=parseFloat(tab.style.left)||tab.getBoundingClientRect().left;
      moved=false;active=true;
    });
    tab.addEventListener('pointermove',e=>{
      if(!active)return;
      const dx=e.clientX-psx;
      if(Math.abs(dx)>5)moved=true;
      if(!moved)return;
      const nx=Math.max(0,Math.min(window.innerWidth-86,tabStartX+dx));
      tab.style.left=nx+'px';
    });
    tab.addEventListener('pointerup',e=>{
      if(!active)return;
      active=false;
      if(moved){
        const nx=parseFloat(tab.style.left)||0;
        try{localStorage.setItem('tlr_'+def.id+'_pull_tab_x',nx)}catch(e){}
      }else{
        setOpen(!wrap.classList.contains('open'));
      }
      moved=false;
    });
    window.addEventListener('resize',()=>{
      const cur=parseFloat(tab.style.left)||0;
      const clamped=Math.max(0,Math.min(window.innerWidth-86,cur));
      if(clamped!==cur)tab.style.left=clamped+'px';
    });
  }

  defs.forEach(makePullTab);

  // Keep old button APIs useful for tutorial/legacy calls, but route them into the drawers.
  window.toggleRef=function(e){if(e)e.stopPropagation();const w=document.getElementById('scoringPullWrap');const t=document.getElementById('scoringPullTab');if(!w||!t)return;const open=!w.classList.contains('open');w.classList.toggle('open',open);t.innerHTML=(open?'&#9650; ':'&#9660; ')+'Scoring';if(open)closeOtherPullTabs('scoring');};
  window.toggleAbilityRef=function(e){if(e)e.stopPropagation();const w=document.getElementById('abilitiesPullWrap');const t=document.getElementById('abilitiesPullTab');if(!w||!t)return;const open=!w.classList.contains('open');w.classList.toggle('open',open);t.innerHTML=(open?'&#9650; ':'&#9660; ')+'Abilities';if(open)closeOtherPullTabs('abilities');};
  window.toggleMenu=function(){const w=document.getElementById('menuPullWrap');const t=document.getElementById('menuPullTab');if(!w||!t)return;const open=!w.classList.contains('open');w.classList.toggle('open',open);t.innerHTML=(open?'&#9650; ':'&#9660; ')+'Menu';if(open)closeOtherPullTabs('menu');};
})();
</script>`);
changed++;

fs.writeFileSync(file, html);
console.log(`Done — ${changed} drawer tab / desktop drift changes applied.`);
