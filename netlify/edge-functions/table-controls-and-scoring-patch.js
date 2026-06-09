export default async function handler(request, context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  html = patchHandControls(html);
  html = patchTieredScoring(html);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function replaceOnce(html, needle, replacement, label) {
  if (!html.includes(needle)) {
    console.warn('[tlr patch] missing snippet:', label);
    return html;
  }
  return html.replace(needle, replacement);
}

function patchHandControls(html) {
  html = replaceOnce(
    html,
    '.hand{position:relative;display:block;max-width:none;width:100%;height:235px;--track-offset:0deg;--track-spacing:5deg;--track-radius:780px}',
    '.hand{position:relative;display:block;max-width:none;width:100%;height:235px;--track-offset:0deg;--track-spacing:5deg;--track-radius:780px;--hand-lift-y:0px;transform:translateY(var(--hand-lift-y));transition:transform .22s cubic-bezier(.2,.85,.25,1)}',
    'hand base css'
  );
  html = replaceOnce(
    html,
    '.hand.hand-scroll-dragging .card{transition:none}',
    '.hand.hand-scroll-dragging{transition:none}.hand.hand-scroll-dragging .card{transition:none}',
    'hand dragging transition css'
  );
  html = replaceOnce(
    html,
    '/* Stop the old swipe handler from also nudging the whole hand sideways. */',
    '.hand.hand-raised{--hand-lift-y:-34px}@media(max-width:640px){.hand.hand-raised{--hand-lift-y:-28px}}\n/* Stop the old swipe handler from also nudging the whole hand sideways. */',
    'hand raised css'
  );

  html = replaceOnce(
    html,
    'let offset=0,startOffset=0,startX=0;               // track offset (degrees)',
    'let offset=0,startOffset=0,startX=0,startY=0;      // track offset (degrees), plus gesture origin',
    'hand start vars'
  );
  html = replaceOnce(
    html,
    'const DEG_PER_PX_PINCH=0.013;                      // pinch pixels -> degrees of spacing',
    'const DEG_PER_PX_PINCH=0.013;                      // pinch pixels -> degrees of spacing\n  const HAND_LIFT_PX=34;\n  const HAND_LIFT_PX_MOBILE=28;\n  const VERTICAL_SWIPE_PX=28;\n  const DEG_PER_SIDE_SCROLL=0.08;',
    'hand gesture constants'
  );
  html = replaceOnce(
    html,
    "const applySpacing=d=>{const h=handEl();if(!h)return;h.style.setProperty('--track-spacing',d.toFixed(3)+'deg');};",
    "const applySpacing=d=>{const h=handEl();if(!h)return;h.style.setProperty('--track-spacing',d.toFixed(3)+'deg');};\n  let handLifted=false;\n  const applyHandLift=lifted=>{const h=handEl();if(!h)return;handLifted=!!lifted;h.classList.toggle('hand-raised',handLifted);h.style.setProperty('--hand-lift-y',handLifted?'-'+(window.innerWidth<640?HAND_LIFT_PX_MOBILE:HAND_LIFT_PX)+'px':'0px');};",
    'apply hand lift helper'
  );
  html = replaceOnce(
    html,
    'startX=ev.clientX;startOffset=offset;',
    'startX=ev.clientX;startY=ev.clientY||0;startOffset=offset;',
    'slide start y'
  );
  html = replaceOnce(
    html,
    `const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);
    applyOffset(target);
    pushSample(performance.now(),target);
  };`,
    `const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const dy=(ev.clientY||startY)-startY;
    if(Math.abs(dy)>=VERTICAL_SWIPE_PX&&Math.abs(dy)>Math.abs(dx)*1.15){
      applyHandLift(dy<0);
      pushSample(performance.now(),offset);
      return;
    }
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);
    applyOffset(target);
    pushSample(performance.now(),target);
  };`,
    'vertical hand swipe'
  );
  html = replaceOnce(
    html,
    `const isMouse=ev.pointerType==='mouse';
    const mouseInHand=isMouse&&ev.target instanceof Element&&ev.target.closest('.handDock,#handSwipeZone')&&!ev.target.closest('.card[data-uid]');
    if((inSwipeZone(ev.target)||mouseInHand)&&mode==null){
      try{(isMouse?ev.target.closest('.handDock,#handSwipeZone'):zoneEl())?.setPointerCapture(ev.pointerId);}catch(e){}
      startSlideMode(ev);
    }`,
    `const isMouse=ev.pointerType==='mouse';
    const isMiddleMouse=isMouse&&ev.button===1;
    const mouseInHand=isMiddleMouse&&ev.target instanceof Element&&ev.target.closest('.handDock,#handSwipeZone')&&!ev.target.closest('.card[data-uid]');
    if(((inSwipeZone(ev.target)&&!isMouse)||mouseInHand)&&mode==null){
      if(isMiddleMouse)ev.preventDefault();
      try{(isMouse?ev.target.closest('.handDock,#handSwipeZone'):zoneEl())?.setPointerCapture(ev.pointerId);}catch(e){}
      startSlideMode(ev);
    }`,
    'middle mouse hand slide'
  );
  html = replaceOnce(
    html,
    `// Scroll to adjust spacing — desktop only
    const DEG_PER_SCROLL=0.012;  // degrees of spacing per pixel of scroll delta
    let scrollRaf=null;
    let pendingDelta=0;
    const applyScroll=()=>{
      scrollRaf=null;
      if(!pendingDelta)return;
      const delta=pendingDelta;pendingDelta=0;
      // deltaY > 0 = scroll down = constrict (reduce spacing)
      const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
      let next=s - delta*DEG_PER_SCROLL;
      next=Math.max(SPACING_MIN,Math.min(SPACING_MAX,next));
      if(next===manualSpacing)return;
      manualSpacing=next;
      cachedCap=null;
      applySpacing(next);
      applyOffset(clampOffset(offset));
    };
    const onWheel=ev=>{
      if(!isDesktop())return;
      const z=zoneEl();if(!z)return;
      // Only activate when hovering the swipe zone or the hand area
      if(!ev.target.closest('#handSwipeZone,.handDock'))return;
      ev.preventDefault();
      // Normalise delta across different wheel modes
      let dy=ev.deltaY;
      if(ev.deltaMode===1)dy*=20;   // line mode
      if(ev.deltaMode===2)dy*=400;  // page mode
      pendingDelta+=dy;
      if(scrollRaf==null)scrollRaf=requestAnimationFrame(applyScroll);
    };
    window.addEventListener('wheel',onWheel,{passive:false});`,
    `// Scroll to adjust spacing; horizontal scroll drifts the hand side-to-side.
    const DEG_PER_SCROLL=0.012;  // degrees of spacing per pixel of vertical scroll delta
    let scrollRaf=null;
    let pendingSpacingDelta=0;
    let pendingSideDelta=0;
    const markHandScrolled=()=>{
      if(window.__handHasBeenSwiped)return;
      window.__handHasBeenSwiped=true;
      try{localStorage.setItem('tlr_hand_swiped','1');}catch(e){}
      const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}
    };
    const applyScroll=()=>{
      scrollRaf=null;
      if(pendingSideDelta){
        const dx=pendingSideDelta;pendingSideDelta=0;
        markHandScrolled();
        applyOffset(softClamp(offset+dx*DEG_PER_SIDE_SCROLL));
      }
      if(pendingSpacingDelta){
        const delta=pendingSpacingDelta;pendingSpacingDelta=0;
        // deltaY > 0 = scroll down = constrict (reduce spacing)
        const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
        let next=s - delta*DEG_PER_SCROLL;
        next=Math.max(SPACING_MIN,Math.min(SPACING_MAX,next));
        if(next!==manualSpacing){
          manualSpacing=next;
          cachedCap=null;
          applySpacing(next);
          applyOffset(clampOffset(offset));
        }
      }
    };
    const onWheel=ev=>{
      if(!isDesktop())return;
      const z=zoneEl();if(!z)return;
      // Only activate when hovering the swipe zone or the hand area
      if(!ev.target.closest('#handSwipeZone,.handDock'))return;
      ev.preventDefault();
      // Normalise delta across different wheel modes
      let dx=ev.deltaX,dy=ev.deltaY;
      if(ev.deltaMode===1){dx*=20;dy*=20;}   // line mode
      if(ev.deltaMode===2){dx*=400;dy*=400;} // page mode
      if(Math.abs(dx)>Math.abs(dy))pendingSideDelta+=dx;
      else pendingSpacingDelta+=dy;
      if(scrollRaf==null)scrollRaf=requestAnimationFrame(applyScroll);
    };
    window.addEventListener('wheel',onWheel,{passive:false});`,
    'desktop wheel hand controls'
  );

  return html;
}

function patchTieredScoring(html) {
  const computeScorePattern = /function computeScore\(cards,spreadArr=null,skipRelics=false,skipFlatBonuses=skipRelics\)\{[\s\S]*?\n\}\nfunction meldStr/;
  const computeScoreReplacement = `function computeScore(cards,spreadArr=null,skipRelics=false,skipFlatBonuses=skipRelics){
  const omenBonus=(persist.up.omen||0);
  const resonanceBonus=(persist.up.resonance||0)*3;
  const omenTotal=omenBonus*cards.length;
  const resonanceTotal=resonanceBonus*cards.filter(c=>c.type==='major').length;
  let chips=cards.reduce((s,c)=>s+c.points,0),base=chips,mult=1,m=[];
  const push=(name,ch=0,mu=0,mode)=>{m.push([name,ch,mu,mode]);chips+=ch||0;if(mu){if(mode==='add')mult+=mu;else mult*=mu;}};
  if(omenTotal&&!skipFlatBonuses)push('Omen',omenTotal,0);
  if(resonanceTotal&&!skipFlatBonuses)push('Resonance',resonanceTotal,0);
  let rankBonus=(persist.up.rank||0)*5;
  let rankMult=1.25+(persist.up.rank_mult||0)*0.25;
  for(const rank of ['Page','Knight','Queen','King']){
    let a=cards.filter(c=>c.type==='court'&&c.rank===rank);
    if(a.length>=3)push('Three of a Kind ('+rank+'s)',5+rankBonus,rankMult);
    if(a.length>=4)push('Four of a Kind ('+rank+'s)',7+rankBonus,rankMult);
  }
  const courtElig=cards.filter(c=>c.type==='court');
  let ranks=new Set(courtElig.map(c=>c.rank));
  let fullCount=ranks.size;
  let same=null,sameCount=0;
  if(fullCount>=3)for(const suit of SUITS){let rs=new Set(courtElig.filter(c=>c.suit===suit).map(c=>c.rank));if(rs.size>=3&&rs.size>sameCount){same=suit;sameCount=rs.size;}}
  let courtChips=(persist.up.court_chips||0)*8;
  let courtMult=1.5+(persist.up.court_mult||0)*0.25;
  if(same){for(let tier=3;tier<=Math.min(4,sameCount);tier++)push('Royal Court ('+tier+', '+same+')',10+courtChips,courtMult);}
  else if(fullCount>=3){for(let tier=3;tier<=Math.min(4,fullCount);tier++)push('Full Court ('+tier+')',10+courtChips,courtMult);}
  let nums=[...new Set(cards.filter(c=>c.type==='major').map(c=>c.num))].sort((a,b)=>a-b),best=1,cur=1;
  for(let i=1;i<nums.length;i++){if(nums[i]===nums[i-1]+1){cur++;best=Math.max(best,cur)}else cur=1}
  let seqBonus=(persist.up.sequence||0)*5;
  let seqMult=1.25+(persist.up.seq_mult||0)*0.5;
  if(best>=3){for(let tier=3;tier<=best;tier++)push('Sequence of '+tier,10+seqBonus,seqMult);}
  let pathChips=(persist.up.path_chips||0)*15;
  let pathMult=2+(persist.up.path_mult||0)*0.5;
  if(['major_0','major_1','major_21'].every(id=>cards.some(c=>c.id===id)))push('Path of the Magi',30+pathChips,pathMult);
  // ── Relic effects ──
  if(!skipRelics){
  const rel=persist.relics;
  if(rel.includes('gilded_fool')&&cards.length)push('The Gilded Fool',10,0);

  if(rel.includes('hermit_lantern')){const n=cards.filter(c=>c.type==='major').length;if(n)push("Hermit's Lantern",0,n*0.25,'add');}
  if(rel.includes('mirror_shard')){const rc={};cards.forEach(c=>{const r=c.rank||String(c.num);rc[r]=(rc[r]||0)+1;});const pairs=Object.values(rc).filter(v=>v>=2).reduce((s,v)=>s+Math.floor(v/2),0);if(pairs)push('Mirror Shard',0,pairs,'add');}
  if(rel.includes('court_favor')){const n=cards.filter(c=>['Page','Knight','Queen','King'].includes(c.rank)).length;if(n)push('Court Favor',0,n,'add');}
  if(rel.includes('arcana_codex')){const scoringKeys=['rank','rank_mult','sequence','seq_mult','court_chips','court_mult','path_chips','path_mult','omen','resonance'];const n=scoringKeys.filter(k=>(persist.up[k]||0)>0).length;if(n)push('Arcana Codex',0,+(n*0.1).toFixed(2),'add');}
  if(rel.includes('hanged_coin')&&state.discardedCards&&state.discardedCards.length){const bonus=Math.floor(state.discardedCards.reduce((s,c)=>s+c.points,0)/2);if(bonus)push("Hanged Man's Coin",bonus,0);}
  const COURT_RANKS=['Page','Knight','Queen','King'];
  if(rel.includes('still_pool')&&!state.discardedCards?.length)push('The Still Pool',0,1,'add');
  if(rel.includes('loaded_die')){const bonus=cards.filter(c=>COURT_RANKS.includes(c.rank)).reduce((s,c)=>s+c.points,0);if(bonus)push('Loaded Die',bonus,0);}
  if(rel.includes('lovers_knot')){const rc={};cards.forEach(c=>{const r=c.rank||String(c.num);rc[r]=(rc[r]||0)+1;});const groups=Object.values(rc).filter(v=>v>=2).length;if(groups)push("The Lovers' Knot",0,+(groups*1.5).toFixed(1),'add');}
  if(rel.includes('temperance_flask')&&state.discardedCards?.length===1)push('Temperance Flask',0,1.5,'add');
  if(rel.includes('strengths_grip')){const n=cards.filter(c=>COURT_RANKS.includes(c.rank)).length;if(n>=3)push('Strength',0,3,'add');}
  if(rel.includes('fool_reversed')){const bonus=cards.length*3;if(bonus)push('The Fool Reversed',bonus,0);}
  if(rel.includes('the_world')&&state.worldCarry)push('The World',state.worldCarry,0);
  } // end !forHints
  // Resonation bonuses — accumulated in state.resonationBonus as they trigger during play
  if(state.resonationBonus&&(state.resonationBonus.chips||state.resonationBonus.mult)){const rb=state.resonationBonus;push('⚷ '+(rb.name||'Resonation'),rb.chips,rb.mult,'add');}
  return{baseChips:base,chips,mult,melds:m,finalScore:Math.floor(chips*mult)}
}
function meldStr`;
  if (!computeScorePattern.test(html)) console.warn('[tlr patch] missing snippet: computeScore');
  else html = html.replace(computeScorePattern, computeScoreReplacement);

  const slotsPattern = /function slotsForMeld\(name\)\{[^\n]*?return\[\]\}/;
  const slotsReplacement = `function slotsForMeld(name){let filled=state.spread.map((c,i)=>c?{c,i}:null).filter(Boolean);const tierFrom=()=>{let m=name.match(/\\((\\d+)/)||name.match(/of (\\d+)/);return m?parseInt(m[1]):0};if(name.startsWith('Three of a Kind')||name.startsWith('Four of a Kind')){let rank=['Page','Knight','Queen','King'].find(r=>name.includes(r+'s'));let lim=name.startsWith('Three')?3:4;return rank?filled.filter(x=>x.c.type==='court'&&x.c.rank===rank).slice(0,lim).map(x=>x.i):[]}if(name.startsWith('Full Court')){const ELIG=['Page','Knight','Queen','King'];let seen=new Set(),out=[],lim=tierFrom()||4;for(const x of filled){if(out.length>=lim)break;if(x.c.type==='court'&&!seen.has(x.c.rank)&&ELIG.includes(x.c.rank)){seen.add(x.c.rank);out.push(x.i)}}return out}if(name.startsWith('Royal Court')||name.startsWith('Flush')){let suit=SUITS.find(s=>name.includes(s));let lim=tierFrom()||4;return suit?filled.filter(x=>x.c.suit===suit).slice(0,lim).map(x=>x.i):[]}if(name.startsWith('Sequence')){let tr=filled.filter(x=>x.c.type==='major').sort((a,b)=>a.c.num-b.c.num);let bs=0,bl=1,cs=0,cl=1;for(let j=1;j<tr.length;j++){if(tr[j].c.num===tr[j-1].c.num+1){cl++;if(cl>bl){bl=cl;bs=cs}}else{cs=j;cl=1}}let want=tierFrom()||bl;return tr.slice(bs,bs+Math.min(want,bl)).map(x=>x.i)}if(name==='Path of the Magi')return filled.filter(x=>['major_0','major_1','major_21'].includes(x.c.id)).map(x=>x.i);return[]}`;
  if (!slotsPattern.test(html)) console.warn('[tlr patch] missing snippet: slotsForMeld');
  else html = html.replace(slotsPattern, slotsReplacement);

  html = html.replace("['Full Court (3+)','Consecutive ranks'", "['Full Court (3/4)','Consecutive ranks'");
  html = html.replace("['Royal Court (3+)','Consecutive ranks, same suit'", "['Royal Court (3/4)','Consecutive ranks, same suit'");
  html = html.replace("['Sequence (3+)','Consecutive major arcana'", "['Sequence (3/4/5)','Consecutive major arcana'");
  return html;
}
