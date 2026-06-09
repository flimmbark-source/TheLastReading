const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* tab spacing and desktop vertical drift patch */';
if (html.includes(marker)) {
  console.log('Tab spacing / vertical drift patch already present, skipping.');
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

console.log('Tab spacing / vertical drift patch:');

// Reverse vertical lift only for desktop pointer control. Mobile touch keeps its current feel.
rep(
  `const y=softClampLift(startLift+dy);`,
  `const _desktopYDir=window.matchMedia('(pointer:fine)').matches?-1:1;const y=softClampLift(startLift+dy*_desktopYDir);`,
  'Reverse desktop vertical hand lift direction'
);

html = html.replace('</style>', `
${marker}
#invTab,.tlr-pull-tab{will-change:left}
/* Restore the desktop space that Scoring/Abilities buttons used to occupy before becoming drawer tabs. */
@media(min-width:641px){#titleContent .actions{height:37px!important;min-height:37px!important;margin-bottom:10px!important}}
</style>`);
changed++;

html = html.replace('</script>', `
(function(){
  if(window.__tlrPullTabFanInstalled)return;
  window.__tlrPullTabFanInstalled=true;

  const tabs=[
    {id:'menuPullTab',key:'tlr_menu_pull_tab_x',w:86,label:'Menu'},
    {id:'scoringPullTab',key:'tlr_scoring_pull_tab_x',w:86,label:'Scoring'},
    {id:'abilitiesPullTab',key:'tlr_abilities_pull_tab_x',w:86,label:'Abilities'},
    {id:'invTab',key:'tlr_tab_x',w:80,label:'Archives'}
  ];

  function existing(){
    return tabs.map(t=>Object.assign({},t,{el:document.getElementById(t.id)})).filter(t=>t.el);
  }

  function discardsAnchorX(){
    const disc=document.querySelector('.discards-pill');
    if(disc){
      const r=disc.getBoundingClientRect();
      if(r.width)return Math.round(r.right+10);
    }
    return Math.round(window.innerWidth-98);
  }

  function seedDefaultPositions(){
    const gap=window.innerWidth<390?6:10;
    const found=existing();
    if(found.length<2)return;
    const byId={};found.forEach(t=>byId[t.id]=t);
    const isDesktop=window.matchMedia('(min-width:641px)').matches;

    if(isDesktop){
      let x=14;
      for(const id of ['menuPullTab','scoringPullTab','abilitiesPullTab']){
        const t=byId[id];if(!t)continue;
        const nx=Math.max(0,Math.min(window.innerWidth-t.w,x));
        t.el.style.left=nx+'px';
        try{localStorage.setItem(t.key,String(nx));}catch(e){}
        x=nx+t.w+gap;
      }
      const a=byId.invTab;
      if(a){
        const nx=Math.max(0,Math.min(window.innerWidth-a.w,discardsAnchorX()));
        a.el.style.left=nx+'px';
        try{localStorage.setItem(a.key,String(nx));}catch(e){}
      }
      return;
    }

    const total=found.reduce((s,t)=>s+t.w,0)+gap*(found.length-1);
    let x=Math.max(6,Math.round((window.innerWidth-total)/2));
    for(const t of found){
      const nx=Math.max(0,Math.min(window.innerWidth-t.w,x));
      t.el.style.left=nx+'px';
      try{localStorage.setItem(t.key,String(nx));}catch(e){}
      x+=t.w+gap;
    }
  }

  function fanTabs(){
    const found=existing().map(t=>{
      const r=t.el.getBoundingClientRect();
      const left=parseFloat(t.el.style.left);
      return Object.assign(t,{x:Number.isFinite(left)?left:r.left});
    });
    if(found.length<2)return;
    const gap=window.innerWidth<390?6:10;
    found.sort((a,b)=>a.x-b.x);

    for(let i=0;i<found.length;i++){
      const min=i?found[i-1].x+found[i-1].w+gap:6;
      found[i].x=Math.max(found[i].x,min);
    }

    const last=found[found.length-1];
    const overflow=(last.x+last.w+6)-window.innerWidth;
    if(overflow>0){
      for(let i=found.length-1;i>=0;i--)found[i].x-=overflow;
      for(let i=0;i<found.length;i++){
        const min=i?found[i-1].x+found[i-1].w+gap:6;
        found[i].x=Math.max(found[i].x,min);
      }
    }

    for(const t of found){
      const nx=Math.max(0,Math.min(window.innerWidth-t.w,Math.round(t.x)));
      t.el.style.left=nx+'px';
      try{localStorage.setItem(t.key,String(nx));}catch(e){}
    }
  }

  // Layout v2: reseed once because v1 centered every tab and could overlap with the new desktop layout request.
  try{
    if(localStorage.getItem('tlr_pull_tabs_fanned_v2')!=='1'){
      seedDefaultPositions();
      localStorage.setItem('tlr_pull_tabs_fanned_v2','1');
    }
  }catch(e){seedDefaultPositions();}
  requestAnimationFrame(fanTabs);

  // Re-fan after any tab drag release. This includes the existing Archives tab.
  document.addEventListener('pointerup',()=>setTimeout(fanTabs,0),true);
  window.addEventListener('resize',()=>setTimeout(()=>{seedDefaultPositions();fanTabs();},30));
})();
</script>`);
changed++;

fs.writeFileSync(file, html);
console.log(`Done — ${changed} tab spacing / vertical drift changes applied.`);
