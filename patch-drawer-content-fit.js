const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* drawer content fit patch */';
if (html.includes(marker)) {
  console.log('Drawer content fit patch already present, skipping.');
  process.exit(0);
}

let changed = 0;

console.log('Drawer content fit patch:');

html = html.replace('</style>', `
${marker}
/* Pull drawers now size themselves to the content instead of dropping a fixed tall panel. */
.tlr-pull-wrap{--tlr-drawer-h:220px;transform:translateY(calc(-1 * var(--tlr-drawer-h)))!important}
.tlr-pull-wrap.open{transform:translateY(0)!important}
.tlr-pull-desk{height:var(--tlr-drawer-h)!important;padding:10px 14px 12px!important;overflow:visible!important}
.tlr-pull-tab{top:var(--tlr-drawer-h)!important}
@media(max-width:640px){.tlr-pull-desk{padding:9px 7px 11px!important}}
#scoringPullDesk .scoring-sheet{display:block!important;width:fit-content!important;max-width:100%!important;margin:0 auto!important;padding:0!important}
#scoringPullDesk .scoring-sheet table{width:auto!important;max-width:100%!important;border-collapse:collapse!important}
#scoringPullDesk .scoring-sheet td{font-size:10.5px!important;line-height:1.08!important;padding:1px 4px!important;white-space:nowrap!important}
#scoringPullDesk .scoring-sheet .m{padding-left:6px!important;color:#6b4b20!important;font-size:9.6px!important}
#scoringPullDesk .scoring-sheet .score-head{font-size:8.5px!important;letter-spacing:.06em!important}
#scoringPullDesk .scoring-sheet .arcana-row td{font-size:9px!important;letter-spacing:.08em!important;padding-top:5px!important;padding-bottom:1px!important}
#scoringPullDesk .scoring-sheet .r .chips{width:42px!important}
#scoringPullDesk .scoring-sheet .r .mult{width:32px!important;margin-left:4px!important}
#abilitiesPullDesk .ref{max-width:min(94vw,720px)!important;padding:0!important}
#abilitiesPullDesk table{width:100%!important;border-collapse:collapse!important;font-size:11.5px!important;line-height:1.2!important}
#abilitiesPullDesk td{padding:3px 5px!important;vertical-align:top!important;white-space:normal!important}
#abilitiesPullDesk td:first-child{width:86px!important;font-weight:700!important;white-space:nowrap!important;color:#3a1a06!important}
#menuPullDesk #settingsPanel{max-width:min(92vw,300px)!important;gap:9px!important}
</style>`);
changed++;

html = html.replace('</script>', `
(function(){
  function fmtBonus(v){return '+'+Number(v).toFixed(2).replace(/\\.?0+$/,'');}
  function fitDrawerHeights(){
    const defs=[
      {id:'scoring',min:92,max:260},
      {id:'abilities',min:112,max:360},
      {id:'menu',min:150,max:380}
    ];
    for(const d of defs){
      const wrap=document.getElementById(d.id+'PullWrap');
      const desk=document.getElementById(d.id+'PullDesk');
      if(!wrap||!desk)continue;
      const viewportScale=window.innerWidth<641?0.72:0.62;
      const maxByViewport=Math.max(d.min,Math.floor(window.innerHeight*viewportScale));
      const max=Math.min(d.max,maxByViewport);
      const oldHeight=desk.style.getPropertyValue('height');
      const oldOverflow=desk.style.getPropertyValue('overflow');
      desk.style.setProperty('height','auto','important');
      desk.style.setProperty('overflow','visible','important');
      const measured=Math.ceil(desk.scrollHeight)+2;
      if(oldHeight)desk.style.setProperty('height',oldHeight);else desk.style.removeProperty('height');
      if(oldOverflow)desk.style.setProperty('overflow',oldOverflow);else desk.style.removeProperty('overflow');
      const target=Math.max(d.min,Math.min(max,measured));
      wrap.style.setProperty('--tlr-drawer-h',target+'px');
      desk.style.setProperty('overflow',measured>max?'auto':'visible','important');
    }
  }
  function renderDrawerScoringSheet(){
    const el=document.getElementById('ref');
    if(!el)return;
    const u=(window.persist&&persist.up)||{};
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
      ['Path of the Magi','0·I·XXI in spread','+'+(30+pathChips),fmtBonus(pathMult-1)]
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
    requestAnimationFrame(fitDrawerHeights);
  }

  // Fill immediately and again whenever the Scoring drawer opens, so upgrades are reflected.
  renderDrawerScoringSheet();
  requestAnimationFrame(fitDrawerHeights);
  window.addEventListener('resize',()=>setTimeout(fitDrawerHeights,40));
  const oldToggle=window.toggleRef;
  window.toggleRef=function(e){
    renderDrawerScoringSheet();
    if(typeof oldToggle==='function')return oldToggle.apply(this,arguments);
  };

  for(const id of ['scoring','abilities','menu']){
    const tab=document.getElementById(id+'PullTab');
    if(tab&&!tab.__drawerFitHooked){
      tab.__drawerFitHooked=true;
      tab.addEventListener('pointerup',()=>setTimeout(()=>{if(id==='scoring')renderDrawerScoringSheet();fitDrawerHeights();},0),true);
      tab.addEventListener('click',()=>setTimeout(()=>{if(id==='scoring')renderDrawerScoringSheet();fitDrawerHeights();},0),true);
    }
  }
})();
</script>`);
changed++;

fs.writeFileSync(file, html);
console.log(`Done — ${changed} drawer content fit changes applied.`);
