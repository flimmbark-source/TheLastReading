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
/* Give the pull drawers enough visible room, while keeping Archives-style movement. */
.tlr-pull-wrap{--tlr-drawer-h:min(76dvh,560px);transform:translateY(calc(-1 * var(--tlr-drawer-h)))!important}
.tlr-pull-wrap.open{transform:translateY(0)!important}
.tlr-pull-desk{height:var(--tlr-drawer-h)!important;padding:14px 16px 18px!important;overflow:auto!important}
.tlr-pull-tab{top:var(--tlr-drawer-h)!important}
@media(max-width:640px){.tlr-pull-wrap{--tlr-drawer-h:min(72dvh,520px)}.tlr-pull-desk{padding:12px 8px 16px!important}}
#scoringPullDesk .scoring-sheet{display:block!important;width:fit-content!important;max-width:100%!important;margin:0 auto!important;padding:0!important}
#scoringPullDesk .scoring-sheet table{width:auto!important;max-width:100%!important;border-collapse:collapse!important}
#scoringPullDesk .scoring-sheet td{font-size:12px!important;line-height:1.24!important;padding:2px 5px!important;white-space:nowrap!important}
#scoringPullDesk .scoring-sheet .m{padding-left:8px!important;color:#6b4b20!important}
#scoringPullDesk .scoring-sheet .r .chips{width:48px!important}
#scoringPullDesk .scoring-sheet .r .mult{width:38px!important;margin-left:6px!important}
#abilitiesPullDesk .ref{max-width:min(94vw,720px)!important;padding:0!important}
#abilitiesPullDesk table{width:100%!important;border-collapse:collapse!important;font-size:12px!important;line-height:1.28!important}
#abilitiesPullDesk td{padding:4px 6px!important;vertical-align:top!important;white-space:normal!important}
#abilitiesPullDesk td:first-child{width:92px!important;font-weight:700!important;white-space:nowrap!important;color:#3a1a06!important}
#menuPullDesk #settingsPanel{max-width:min(92vw,300px)!important;gap:10px!important}
</style>`);
changed++;

html = html.replace('</script>', `
(function(){
  function fmtBonus(v){return '+'+Number(v).toFixed(2).replace(/\.?0+$/,'');}
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
      ['Three of a Kind','3 matching court ranks',`+${5+rankBonus}`,fmtBonus(rankMult-1)],
      ['Four of a Kind','4 matching court ranks',`+${7+rankBonus}`,fmtBonus(rankMult-1)],
      ['Full Court (3/4)','Consecutive ranks',`+${10+courtChips}`,fmtBonus(courtMult-1)],
      ['Royal Court (3/4)','Consecutive ranks, same suit',`+${10+courtChips}`,fmtBonus(courtMult-1)],
      ['arc','Major Arcana','',''],
      ['Sequence (3/4/5)','Consecutive major arcana',`+${10+seqBonus}`,fmtBonus(seqMult-1)],
      ['Path of the Magi','0·I·XXI in spread',`+${30+pathChips}`,fmtBonus(pathMult-1)]
    ];
    let html='<table><tbody>';
    html+='<tr><td></td><td></td><td class="score-head r"><span class="chips">Bonus</span><span class="mult">Mult</span></td></tr>';
    for(const r of rows){
      if(r[0]==='arc'){html+=`<tr class="arcana-row"><td colspan="3">${r[1]}</td></tr>`;continue;}
      html+=`<tr><td>${r[0]}</td><td class="m">${r[1]}</td><td class="r"><span class="chips">${r[2]}</span><span class="mult">${r[3]}</span></td></tr>`;
    }
    html+='</tbody></table>';
    el.className='ref scoring-sheet';
    el.innerHTML=html;
  }

  // Fill immediately and again whenever the Scoring drawer opens, so upgrades are reflected.
  renderDrawerScoringSheet();
  const oldToggle=window.toggleRef;
  window.toggleRef=function(e){
    renderDrawerScoringSheet();
    if(typeof oldToggle==='function')return oldToggle.apply(this,arguments);
  };

  const tab=document.getElementById('scoringPullTab');
  if(tab&&!tab.__scoreFillHooked){
    tab.__scoreFillHooked=true;
    tab.addEventListener('pointerup',()=>setTimeout(renderDrawerScoringSheet,0),true);
    tab.addEventListener('click',()=>setTimeout(renderDrawerScoringSheet,0),true);
  }
})();
</script>`);
changed++;

fs.writeFileSync(file, html);
console.log(`Done — ${changed} drawer content fit changes applied.`);
