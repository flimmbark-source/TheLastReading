// Shared ghost-text renderer (Phase 15.8). Moved verbatim from index.html.
// Reads legacy globals (_slots, relicIconStyle) and writes the global
// effectsUntil timer that score sequencing waits on.
/* global _slots, relicIconStyle, effectsUntil, haptic */

function signed(v){const n=Number(v);return (n>=0?'+':'')+n.toFixed(2).replace(/\.?0+$/,'')}

export function meldStr(m){const chips=m[1],mult=m[2],additive=m[3]==='add';const fmt=v=>signed(v);const shown=additive?mult:mult-1;if(chips&&mult)return`${signed(chips)} ${fmt(shown)}`;if(chips)return signed(chips);if(mult)return`${fmt(shown)}`;return'';}

export function normMeldName(name){if(name.startsWith('Sequence'))return 'Sequence';if(name.startsWith('Royal Court'))return 'Royal Court';if(name.startsWith('Full Court'))return 'Full Court';if(name.startsWith('Three of a Kind'))return 'Three of a Kind';if(name.startsWith('Four of a Kind'))return 'Four of a Kind';return name}

export function holdEffects(ms){effectsUntil=Math.max(effectsUntil,Date.now()+ms)}

function reducedMotion(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches}

function spark(x,y,color,n=4,spread=26,size=3){if(reducedMotion())return;for(let k=0;k<n;k++){const p=document.createElement('span');const a=Math.random()*Math.PI*2,d=spread*(.5+Math.random()*.7),s=size*(.6+Math.random()*.8);p.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:50%;background:${color};pointer-events:none;z-index:99998`;document.body.appendChild(p);p.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:.75},{transform:`translate(calc(-50% + ${(Math.cos(a)*d).toFixed(1)}px),calc(-50% + ${(Math.sin(a)*d-10).toFixed(1)}px)) scale(.2)`,opacity:0}],{duration:400+Math.random()*250,easing:'cubic-bezier(.1,.7,.3,1)'}).onfinish=()=>p.remove()}}

export function ghost(i,t,big=false,relicKey=null){const s=_slots()[i];if(!s)return;holdEffects(1700);const g=document.createElement('div');g.className='ghost '+(big?'big':'');g.style.setProperty('--dx',(Math.random()*20-10).toFixed(1)+'px');g.style.setProperty('--rot',(Math.random()*8-4).toFixed(1)+'deg');if(relicKey){const ic=document.createElement('span');ic.style.cssText=`display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:3px;${relicIconStyle(relicKey,14)}`;g.appendChild(ic);g.appendChild(document.createTextNode(t));}else{g.textContent=t;}const r=s.getBoundingClientRect();g.style.position='fixed';g.style.left=(r.left+r.width/2)+'px';g.style.top=(r.top-10)+'px';g.style.zIndex='99999';document.body.appendChild(g);if(big)spark(r.left+r.width/2,r.top-10,'#ff9b52',4,26,3);const card=s.querySelector('.card');if(card&&card.animate&&!reducedMotion())card.animate([{filter:'brightness(1)'},{filter:'brightness(1.22)'},{filter:'brightness(1)'}],{duration:220,easing:'ease-out'});setTimeout(()=>g.remove(),1700)}

export function centerGhost(name,rare=false){const g=document.createElement('div');g.className='meld-announce'+(rare?' rare':'');g.textContent=name;document.body.appendChild(g);setTimeout(()=>g.remove(),1900)}

export function bump(i){const s=_slots()[i];if(!s)return;s.classList.remove('bump');requestAnimationFrame(()=>requestAnimationFrame(()=>s.classList.add('bump')));}

export function fireScoreGhost(){const pill=document.querySelector('.score-stack .score-pill');if(!pill)return;const r=pill.getBoundingClientRect();const g=document.createElement('span');g.className='score-ghost';g.textContent='+1';const centerX=r.left+r.width/2;const horizontalDrift=Math.min(28,r.width*.18);g.style.left=(centerX+(Math.random()-.5)*horizontalDrift)+'px';g.style.top=(r.top+r.height*.48)+'px';document.body.appendChild(g);setTimeout(()=>g.remove(),950)}

export function fireMultGhost(label){const pill=document.querySelector('.score-stack .score-pill');if(!pill)return;const r=pill.getBoundingClientRect();const g=document.createElement('span');g.className='score-ghost mult';g.textContent=label;g.style.left=(r.left+8+Math.random()*(r.width-16))+'px';g.style.top=(r.top+r.height*0.25)+'px';document.body.appendChild(g);if(pill.animate&&!reducedMotion())pill.animate([{filter:'brightness(1)'},{filter:'brightness(1.25)'},{filter:'brightness(1)'}],{duration:260,easing:'ease-out'});setTimeout(()=>g.remove(),950)}

export function fireThresholdBonusGhost(amount){const pill=document.querySelector('.th-pill-wrap .threshold-pill');if(!pill)return;const r=pill.getBoundingClientRect();const g=document.createElement('span');g.className='score-ghost';g.textContent='+'+(amount||10);g.style.cssText+='color:#ffd978;font-size:14px;text-shadow:0 0 8px rgba(255,217,120,.6),0 1px 3px rgba(0,0,0,.9);';g.style.left=(r.left+r.width/2)+'px';g.style.top=(r.top+r.height*0.25)+'px';document.body.appendChild(g);if(pill.animate&&!reducedMotion())pill.animate([{filter:'brightness(1)'},{filter:'brightness(1.4)'},{filter:'brightness(1)'}],{duration:340,easing:'ease-out'});setTimeout(()=>g.remove(),950)}

export function fireChipProjectile(i,chipValue){
  const s=_slots()[i];
  if(!s)return;

  // Flash the card on placement (same as ghost())
  const card=s.querySelector('.card');
  if(card&&card.animate&&!reducedMotion())
    card.animate([{filter:'brightness(1)'},{filter:'brightness(1.22)'},{filter:'brightness(1)'}],{duration:220,easing:'ease-out'});

  const pill=document.querySelector('.score-stack .score-pill');
  if(reducedMotion()||!pill){ghost(i,'+'+chipValue);return;}

  const sr=s.getBoundingClientRect();
  const pr=pill.getBoundingClientRect();
  const startX=sr.left+sr.width/2;
  const startY=sr.top-10;
  const targetX=pr.left+pr.width/2;
  const targetY=pr.top+pr.height/2;

  const g=document.createElement('div');
  g.className='chip-projectile';
  g.textContent='+'+chipValue;
  g.style.cssText=`position:fixed;left:${startX}px;top:${startY}px;z-index:99999;pointer-events:none;will-change:transform;`;
  document.body.appendChild(g);

  const popDur=260;
  const beatDelay=360;
  const flyDelay=popDur+beatDelay;
  const flyDur=460;
  holdEffects(flyDelay+flyDur+180);

  // Phase 1: pop in above the card, then linger for a readable beat.
  g.animate(
    [{transform:'translate(-50%,-50%) scale(0.2)',opacity:0},
     {transform:'translate(-50%,-50%) scale(1.28)',opacity:1,offset:.36},
     {transform:'translate(-50%,-50%) scale(1)',opacity:1}],
    {duration:popDur,easing:'ease-out',fill:'forwards'}
  );

  // Phase 2: randomized, viewport-safe arc to score pill — starts after the beat.
  setTimeout(()=>{
    if(!g.isConnected)return;
    const dx=targetX-startX;
    const dy=targetY-startY;
    const margin=34;
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const safeX=x=>clamp(x,margin,window.innerWidth-margin);
    const safeY=y=>clamp(y,margin,window.innerHeight-margin);
    const distance=Math.max(1,Math.hypot(dx,dy));
    const side=Math.random()<.5?-1:1;
    const normalX=(-dy/distance)*side;
    const normalY=(dx/distance)*side;
    const curve=Math.min(180,Math.max(84,distance*.28))*(.85+Math.random()*.45);
    const lift=Math.min(120,Math.max(54,distance*.18))*(.85+Math.random()*.35);
    const peakX=safeX((startX+targetX)/2+normalX*curve);
    const peakY=safeY((startY+targetY)/2+normalY*curve-lift);
    const rotMid=(-18-Math.random()*22)*side;
    const rotEnd=(24+Math.random()*24)*side;
    const keys=[];
    for(let step=0;step<=12;step++){
      const t=step/12;
      const inv=1-t;
      // Quadratic Bezier samples with a deliberately offset peak so the
      // number visibly travels along an arc instead of linearly to the pill.
      const x=safeX(inv*inv*startX+2*inv*t*peakX+t*t*targetX)-startX;
      const y=safeY(inv*inv*startY+2*inv*t*peakY+t*t*targetY)-startY;
      const scale=t<.72?1+.14*Math.sin(Math.PI*t):1-(t-.72)/.28*.75;
      const rot=rotMid*Math.sin(Math.PI*t)+rotEnd*t*t;
      keys.push({transform:`translate(calc(-50% + ${x.toFixed(0)}px),calc(-50% + ${y.toFixed(0)}px)) scale(${scale.toFixed(2)}) rotate(${rot.toFixed(0)}deg)`,opacity:t<1?1:.7,offset:t});
    }

    g.animate(keys,{duration:flyDur,easing:'linear',fill:'forwards'});

    setTimeout(()=>{
      g.remove();
      if(!pill.isConnected||!pill.animate)return;
      // Slam: squish wide-flat then bounce upright
      pill.animate(
        [{transform:'scale(1)',       filter:'brightness(1)'},
         {transform:'scale(1.32,.66)',filter:'brightness(1.6)', offset:.17},
         {transform:'scale(.91,1.10)',filter:'brightness(1.1)', offset:.40},
         {transform:'scale(1.03,.98)',filter:'brightness(1)',   offset:.62},
         {transform:'scale(1)',       filter:'brightness(1)'}],
        {duration:380,easing:'ease-out'}
      );
      spark(targetX,targetY,'#ff9b52',6,26,3.5);
      try{haptic([0,8,50]);}catch{}
    },flyDur);
  },flyDelay);
}
