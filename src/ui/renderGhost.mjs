// Shared ghost-text renderer (Phase 15.8). Moved verbatim from index.html.
// Reads legacy globals (_slots, relicIconStyle) and writes the global
// effectsUntil timer that score sequencing waits on.
/* global _slots, relicIconStyle, effectsUntil */

export function meldStr(m){const chips=m[1],mult=m[2],additive=m[3]==='add';const fmt=v=>('+'+Number(v).toFixed(2)).replace(/\.?0+$/,'');const shown=additive?mult:mult-1;if(chips&&mult)return`+${chips} ${fmt(shown)}`;if(chips)return`+${chips}`;if(mult)return`${fmt(shown)}`;return'';}

export function normMeldName(name){if(name.startsWith('Sequence'))return 'Sequence';if(name.startsWith('Royal Court'))return 'Royal Court';if(name.startsWith('Full Court'))return 'Full Court';if(name.startsWith('Three of a Kind'))return 'Three of a Kind';if(name.startsWith('Four of a Kind'))return 'Four of a Kind';return name}

export function holdEffects(ms){effectsUntil=Math.max(effectsUntil,Date.now()+ms)}

export function ghost(i,t,big=false,relicKey=null){const s=_slots()[i];if(!s)return;holdEffects(1700);let g=document.createElement('div');g.className='ghost '+(big?'big':'');if(relicKey){const ic=document.createElement('span');ic.style.cssText=`display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:3px;${relicIconStyle(relicKey,14)}`;g.appendChild(ic);g.appendChild(document.createTextNode(t));}else{g.textContent=t;}const r=s.getBoundingClientRect();g.style.position='fixed';g.style.left=(r.left+r.width/2)+'px';g.style.top=(r.top-10)+'px';g.style.zIndex='99999';document.body.appendChild(g);setTimeout(()=>g.remove(),1700)}

export function centerGhost(name,rare=false){const g=document.createElement('div');g.className='meld-announce'+(rare?' rare':'');g.textContent=name;document.body.appendChild(g);setTimeout(()=>g.remove(),1900)}

export function bump(i){const s=_slots()[i];if(!s)return;s.classList.remove('bump');void s.offsetWidth;s.classList.add('bump')}

export function fireScoreGhost(){const pill=document.querySelector('.score-stack .score-pill');if(!pill)return;const r=pill.getBoundingClientRect();const g=document.createElement('span');g.className='score-ghost';g.textContent='+1';g.style.left=(r.left+8+Math.random()*(r.width-16))+'px';g.style.top=(r.top+r.height*0.25)+'px';document.body.appendChild(g);setTimeout(()=>g.remove(),950)}

export function fireMultGhost(label){const pill=document.querySelector('.score-stack .score-pill');if(!pill)return;const r=pill.getBoundingClientRect();const g=document.createElement('span');g.className='score-ghost mult';g.textContent=label;g.style.left=(r.left+8+Math.random()*(r.width-16))+'px';g.style.top=(r.top+r.height*0.25)+'px';document.body.appendChild(g);setTimeout(()=>g.remove(),950)}
