// Reference/scoring controls adapter.
// These functions mirror the remaining inline Scoring/Abilities reference logic
// and install only when the inline functions have been removed.
import { getAbility } from '../data/abilities.mjs';

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || {};}

function fmtBonus(value){return '+'+(value-1).toFixed(2).replace(/\.?0+$/,'');}
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

function scoreCardIcon(){
  return '<span aria-hidden="true" style="display:inline-block;width:13px;height:17px;margin-right:7px;vertical-align:-3px;border:1px solid rgba(243,207,118,.82);border-radius:3px;background:linear-gradient(160deg,#ead9b5,#b98243 54%,#352012);box-shadow:inset 0 0 0 2px rgba(45,22,8,.55),0 0 8px rgba(243,207,118,.28)"></span>';
}

function patternLabel(label){return scoreCardIcon()+'<b>'+label+'</b>';}

export function abilityReferenceRows(){
  return [
    ['Draw','[[draw]] the listed number of cards.'],
    ['Peek','[[reveal]] the listed number of cards. [[take]] 1. Put the rest on the bottom.'],
    ['Search',getAbility('SEARCH')?.prompt||''],
    ['Full Reset',getAbility('WORLD')?.prompt||''],
    ['Neighbor',getAbility('NEIGHBOR_2')?.prompt||''],
    ['Kin',getAbility('KIN_2')?.prompt||''],
    ['Mirror',getAbility('MIRROR_1')?.prompt||''],
    ['Between',getAbility('BETWEEN_2')?.prompt||''],
  ];
}

export function renderAbilitySheet(target = window){
  const ability=target.document?.getElementById('abilityRef');
  if(!ability)return;
  const rows=abilityReferenceRows();
  ability.innerHTML='<table><tr><td><b>Ability</b></td><td class="r"><b>What it does</b></td></tr>'
    +rows.map(([name,description])=>`<tr><td>${escapeHtml(name)}</td><td class="r">${escapeHtml(description)}</td></tr>`).join('')
    +'</table>';
  target.tlrApplyGameTerms?.(ability, { auto: true });
}

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
  const fullCourtChips=(u.court_chips||0)*8;
  const fullCourtMult=+(1.25+(u.court_mult||0)*0.25).toFixed(2);
  const royalCourtChips=(u.royal_court_chips||0)*8;
  const royalCourtMult=+(1.5+(u.royal_court_mult||0)*0.25).toFixed(2);
  const seqBonus=(u.sequence||0)*5;
  const seqMult=+(1.25+(u.seq_mult||0)*0.5).toFixed(2);
  const pathChips=(u.path_chips||0)*15;
  const pathMult=+(2+(u.path_mult||0)*0.5).toFixed(2);
  const rows=[
    ['(3/4) of a Kind','Matching ranks',`+${5+rankBonus}`,fmtBonus(rankMult)],
    ['Full Court (3/4)','Consecutive ranks',`+${10+fullCourtChips}`,fmtBonus(fullCourtMult)],
    ['Royal Court (3/4)','Consecutive ranks, same suit',`+${10+royalCourtChips}`,fmtBonus(royalCourtMult)],
    ['Sequence (3/4/5)','Consecutive major arcana',`+${15+seqBonus}`,fmtBonus(seqMult)],
    ['Path of the Magi','0·I·XXI in spread',`+${15+pathChips}`,fmtBonus(pathMult)],
  ];
  const upgrades=[];
  if(u.rank||u.rank_mult)upgrades.push(`Rank +${rankBonus}chips ${fmtBonus(rankMult)}mult`);
  if(u.court_chips||u.court_mult)upgrades.push(`Full Court +${fullCourtChips}chips ${fmtBonus(fullCourtMult)}mult`);
  if(u.royal_court_chips||u.royal_court_mult)upgrades.push(`Royal Court +${royalCourtChips}chips ${fmtBonus(royalCourtMult)}mult`);
  if(u.sequence||u.seq_mult)upgrades.push(`Seq +${seqBonus}chips ${fmtBonus(seqMult)}mult`);
  if(u.path_chips||u.path_mult)upgrades.push(`Path +${pathChips}chips ${fmtBonus(pathMult)}mult`);
  const minorRows=rows.slice(0,4);
  const majorRows=rows.slice(4);
  let html='<table class="ref-table"><thead><tr><th>Pattern</th><th>Condition</th><th>Chips</th><th>Mult</th></tr></thead><tbody>';
  html+='<tr class="ref-section-head"><td colspan="4">Minor Arcana</td></tr>';
  for(const row of minorRows)html+=`<tr><td>${patternLabel(row[0])}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]||'—'}</td></tr>`;
  html+='<tr class="ref-section-head"><td colspan="4">Major Arcana</td></tr>';
  for(const row of majorRows)html+=`<tr><td>${patternLabel(row[0])}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]||'—'}</td></tr>`;
  const getUnlocked=target.tlrResonations?.getUnlockedFragments || target.getUnlockedFragments;
  const unlocked=typeof getUnlocked==='function'?getUnlocked(target):[];
  const discovered=(target.RESONATIONS||[]).filter(r=>unlocked.includes(r.fragmentId));
  if(discovered.length){
    html+='<tr class="ref-section-head"><td colspan="4">Hidden Patterns</td></tr>';
    const majorNumeral=target.tlrHintRuntime?.majorNumeral || target.majorNumeral;
    for(const res of discovered){
      const condStr=res.conditions.map(c=>(c.anyOf||[c.cardId]).map(id=>typeof majorNumeral==='function'?majorNumeral(id):id).join('/')).join(' · ');
      html+=`<tr><td>${scoreCardIcon()}<b>⚷ ${res.name}</b></td><td>${condStr}</td><td>+${res.chips}</td><td>${fmtBonus(res.mult)}</td></tr>`;
    }
  }
  html+='</tbody></table>';
  if(upgrades.length)html+=`<div class="ref-upgrades"><b>Your upgrades:</b> ${upgrades.join(' · ')}</div>`;
  ref.innerHTML=html;
  target.tlrApplyGameTerms?.(ref, { auto: true });
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

export function toggleAbilityRef(event,target = window){
  if(event)event.stopPropagation();
  const ref=document.getElementById('ref');
  const ability=document.getElementById('abilityRef');
  if(!ref||!ability)return;
  const wasHidden=ability.classList.contains('hidden');
  closeRefs();
  if(wasHidden){renderAbilitySheet(target);positionRefsLayer(event&&event.currentTarget);ability.classList.remove('hidden');}
}

export function installReferenceControls(target = window){
  if(!target || target.__tlrReferenceControlsInstalled)return;
  target.__tlrReferenceControlsInstalled=true;
  renderAbilitySheet(target);
  target.tlrReferenceControls={closeRefs,renderScoringSheet,renderAbilitySheet,abilityReferenceRows,positionRefsLayer,toggleRef,toggleAbilityRef};
  if(typeof target.closeRefs!=='function')target.closeRefs=closeRefs;
  if(typeof target.renderScoringSheet!=='function')target.renderScoringSheet=()=>renderScoringSheet(target);
  if(typeof target.renderAbilitySheet!=='function')target.renderAbilitySheet=()=>renderAbilitySheet(target);
  if(typeof target._positionRefsLayer!=='function')target._positionRefsLayer=positionRefsLayer;
  if(typeof target.toggleRef!=='function')target.toggleRef=event=>toggleRef(event,target);
  if(typeof target.toggleAbilityRef!=='function')target.toggleAbilityRef=event=>toggleAbilityRef(event,target);
}
