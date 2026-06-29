// Shared ghost-text renderer (Phase 15.8). Moved verbatim from index.html.
// Reads legacy globals (_slots, relicIconStyle) and writes the global
// effectsUntil timer that score sequencing waits on.
/* global _slots, relicIconStyle, effectsUntil */

function signed(v){const n=Number(v);return (n>=0?'+':'')+n.toFixed(2).replace(/\.?0+$/,'')}

export function meldStr(m){const chips=m[1],mult=m[2],additive=m[3]==='add';const fmt=v=>signed(v);const shown=additive?mult:mult-1;if(chips&&mult)return`${signed(chips)} ${fmt(shown)}`;if(chips)return signed(chips);if(mult)return`${fmt(shown)}`;return'';}

export function normMeldName(name){if(name.startsWith('Sequence'))return 'Sequence';if(name.startsWith('Royal Court'))return 'Royal Court';if(name.startsWith('Full Court'))return 'Full Court';if(name.startsWith('Three of a Kind'))return 'Three of a Kind';if(name.startsWith('Four of a Kind'))return 'Four of a Kind';return name}

export function holdEffects(ms){effectsUntil=Math.max(effectsUntil,Date.now()+ms)}

function reducedMotion(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches}

function spark(x,y,color,n=4,spread=26,size=3){if(reducedMotion())return;for(let k=0;k<n;k++){const p=document.createElement('span');const a=Math.random()*Math.PI*2,d=spread*(.5+Math.random()*.7),s=size*(.6+Math.random()*.8);p.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:50%;background:${color};pointer-events:none;z-index:99998`;document.body.appendChild(p);p.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:.75},{transform:`translate(calc(-50% + ${(Math.cos(a)*d).toFixed(1)}px),calc(-50% + ${(Math.sin(a)*d-10).toFixed(1)}px)) scale(.2)`,opacity:0}],{duration:400+Math.random()*250,easing:'cubic-bezier(.1,.7,.3,1)'}).onfinish=()=>p.remove()}}

export function ghost(i,t,big=false,relicKey=null){const s=_slots()[i];if(!s)return;holdEffects(1700);let g=document.createElement('div');g.className='ghost '+(big?'big':'');g.style.setProperty('--dx',(Math.random()*20-10).toFixed(1)+'px');g.style.setProperty('--rot',(Math.random()*8-4).toFixed(1)+'deg');if(relicKey){const ic=document.createElement('span');ic.style.cssText=`display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:3px;${relicIconStyle(relicKey,14)}`;g.appendChild(ic);g.appendChild(document.createTextNode(t));}else{g.textContent=t;}const r=s.getBoundingClientRect();g.style.position='fixed';g.style.left=(r.left+r.width/2)+'px';g.style.top=(r.top-10)+'px';g.style.zIndex='99999';document.body.appendChild(g);if(big)spark(r.left+r.width/2,r.top-10,'#ff9b52',4,26,3);const card=s.querySelector('.card');if(card&&card.animate&&!reducedMotion())card.animate([{filter:'brightness(1)'},{filter:'brightness(1.22)'},{filter:'brightness(1)'}],{duration:220,easing:'ease-out'});setTimeout(()=>g.remove(),1700)}

export function centerGhost(name,rare=false){const g=document.createElement('div');g.className='meld-announce'+(rare?' rare':'');g.textContent=name;document.body.appendChild(g);setTimeout(()=>g.remove(),1900)}

export function bump(i){const s=_slots()[i];if(!s)return;s.classList.remove('bump');requestAnimationFrame(()=>requestAnimationFrame(()=>s.classList.add('bump')));}

export function fireScoreGhost(){const pill=document.querySelector('.score-stack .score-pill');if(!pill)return;const r=pill.getBoundingClientRect();const g=document.createElement('span');g.className='score-ghost';g.textContent='+1';const centerX=r.left+r.width/2;const horizontalDrift=Math.min(28,r.width*.18);g.style.left=(centerX+(Math.random()-.5)*horizontalDrift)+'px';g.style.top=(r.top+r.height*.48)+'px';document.body.appendChild(g);setTimeout(()=>g.remove(),950)}

export function fireMultGhost(label){const pill=document.querySelector('.score-stack .score-pill');if(!pill)return;const r=pill.getBoundingClientRect();const g=document.createElement('span');g.className='score-ghost mult';g.textContent=label;g.style.left=(r.left+8+Math.random()*(r.width-16))+'px';g.style.top=(r.top+r.height*0.25)+'px';document.body.appendChild(g);if(pill.animate&&!reducedMotion())pill.animate([{filter:'brightness(1)'},{filter:'brightness(1.25)'},{filter:'brightness(1)'}],{duration:260,easing:'ease-out'});setTimeout(()=>g.remove(),950)}

export function fireThresholdBonusGhost(amount){const pill=document.querySelector('.th-pill-wrap .threshold-pill');if(!pill)return;const r=pill.getBoundingClientRect();const g=document.createElement('span');g.className='score-ghost';g.textContent='+'+(amount||10);g.style.cssText+='color:#ffd978;font-size:14px;text-shadow:0 0 8px rgba(255,217,120,.6),0 1px 3px rgba(0,0,0,.9);';g.style.left=(r.left+r.width/2)+'px';g.style.top=(r.top+r.height*0.25)+'px';document.body.appendChild(g);if(pill.animate&&!reducedMotion())pill.animate([{filter:'brightness(1)'},{filter:'brightness(1.4)'},{filter:'brightness(1)'}],{duration:340,easing:'ease-out'});setTimeout(()=>g.remove(),950)}