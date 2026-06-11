// Reference/scoring controls adapter.
// These functions mirror the remaining inline Scoring/Abilities reference logic
// and install only when the inline functions have been removed.

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || {};}

function fmtBonus(value){return '+'+(value-1).toFixed(2).replace(/\.?0+$/,'');}

export function closeRefs(){
  const ref=document.getElementById('ref');
  const ability=document.getElementById('abilityRef');
  if(ref)ref.classList.add('hidden');
  if(ability)ability.classList.add('hidden');
}

export function renderScoringSheet(target = window){
  const ref=document.getElementById('ref');
  if(!ref)return;
  const u=persistOf(target).up || {};
  const rankBonus=(u.rank||0)*5;
  const rankMult=+(1.25+(u.rank_mult||0)*0.25).toFixed(2);
  const courtChips=(u.court_chips||0)*8;
  const courtMult=+(1.5+(u.court_mult||0)*0.25).toFixed(2);
  const seqBonus=(u.sequence||0)*5;
  const seqMult=+(1.25+(u.seq_mult||0)*0.5).toFixed(2);
  const pathChips=(u.path_chips||0)*15;
  const pathMult=+(2+(u.path_mult||0)*0.5).toFixed(2);
  const rows=[
    ['Three of a Kind','3 matching court ranks',`+${5+rankBonus}`,fmtBonus(rankMult)],
    ['Four of a Kind','4 matching court ranks',`+${7+rankBonus}`,fmtBonus(rankMult)],
    ['Full Court (3/4)','Consecutive ranks',`+${10+courtChips}`,fmtBonus(courtMult)],
    ['Royal Court (3/4)','Consecutive ranks, same suit',`+${10+courtChips}`,fmtBonus(courtMult)],
    ['Sequence (3/4/5)','Consecutive major arcana',`+${10+seqBonus}`,fmtBonus(seqMult)],
    ['Path of the Magi','0·I·XXI in spread',`+${10+pathChips}`,fmtBonus(pathMult)],
  ];
  const upgrades=[];
  if(u.rank)upgrades.push(`Rank +${rankBonus}chips ${fmtBonus(rankMult)}mult`);
  if(u.court_chips)upgrades.push(`Court +${courtChips}chips ${fmtBonus(courtMult)}mult`);
  if(u.sequence)upgrades.push(`Seq +${seqBonus}chips ${fmtBonus(seqMult)}mult`);
  if(u.path_chips)upgrades.push(`Path +${pathChips}chips ${fmtBonus(pathMult)}mult`);
  const minorRows=rows.slice(0,4);
  const majorRows=rows.slice(4);
  let html='<table class="ref-table"><thead><tr><th>Pattern</th><th>Condition</th><th>Chips</th><th>Mult</th></tr></thead><tbody>';
  html+='<tr class="ref-section-head"><td colspan="4">Minor Arcana</td></tr>';
  for(const row of minorRows)html+=`<tr><td><b>${row[0]}</b></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]||'—'}</td></tr>`;
  html+='<tr class="ref-section-head"><td colspan="4">Major Arcana</td></tr>';
  for(const row of majorRows)html+=`<tr><td><b>${row[0]}</b></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]||'—'}</td></tr>`;
  const getUnlocked=target.tlrResonations?.getUnlockedFragments || target.getUnlockedFragments;
  const unlocked=typeof getUnlocked==='function'?getUnlocked(target):[];
  const discovered=(target.RESONATIONS||[]).filter(r=>unlocked.includes(r.fragmentId));
  if(discovered.length){
    html+='<tr class="ref-section-head"><td colspan="4">Hidden Patterns</td></tr>';
    const majorNumeral=target.tlrHintRuntime?.majorNumeral || target.majorNumeral;
    for(const res of discovered){
      const condStr=res.conditions.map(c=>(c.anyOf||[c.cardId]).map(id=>typeof majorNumeral==='function'?majorNumeral(id):id).join('/')).join(' · ');
      html+=`<tr><td><b>⚷ ${res.name}</b></td><td>${condStr}</td><td>+${res.chips}</td><td>${fmtBonus(res.mult)}</td></tr>`;
    }
  }
  html+='</tbody></table>';
  if(upgrades.length)html+=`<div class="ref-upgrades"><b>Your upgrades:</b> ${upgrades.join(' · ')}</div>`;
  ref.innerHTML=html;
}

export function positionRefsLayer(button){
  const layer=document.querySelector('.refs-layer');
  if(!layer)return;
  if(button){const r=button.getBoundingClientRect();layer.style.top=(r.bottom+4)+'px';}
  else layer.style.top='';
}

export function toggleRef(event,target = window){
  if(event)event.stopPropagation();
  const ref=document.getElementById('ref');
  const ability=document.getElementById('abilityRef');
  if(!ref||!ability)return;
  const wasHidden=ref.classList.contains('hidden');
  closeRefs();
  if(wasHidden){renderScoringSheet(target);positionRefsLayer(event&&event.currentTarget);ref.classList.remove('hidden');}
}

export function toggleAbilityRef(event){
  if(event)event.stopPropagation();
  const ref=document.getElementById('ref');
  const ability=document.getElementById('abilityRef');
  if(!ref||!ability)return;
  const wasHidden=ability.classList.contains('hidden');
  closeRefs();
  if(wasHidden){positionRefsLayer(event&&event.currentTarget);ability.classList.remove('hidden');}
}

export function installReferenceControls(target = window){
  if(!target || target.__tlrReferenceControlsInstalled)return;
  target.__tlrReferenceControlsInstalled=true;
  target.tlrReferenceControls={closeRefs,renderScoringSheet,positionRefsLayer,toggleRef,toggleAbilityRef};
  if(typeof target.closeRefs!=='function')target.closeRefs=closeRefs;
  if(typeof target.renderScoringSheet!=='function')target.renderScoringSheet=()=>renderScoringSheet(target);
  if(typeof target._positionRefsLayer!=='function')target._positionRefsLayer=positionRefsLayer;
  if(typeof target.toggleRef!=='function')target.toggleRef=event=>toggleRef(event,target);
  if(typeof target.toggleAbilityRef!=='function')target.toggleAbilityRef=toggleAbilityRef;
}
