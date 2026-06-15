// Shared hint renderer (Phase 15.9). Moved verbatim from index.html.
// Card hint detection delegates to src/systems/hints.mjs; this module owns
// the color mapping, multi-shadow builder, and DOM application so the hand
// glow and ability-modal glow share one renderer.
/* global cardHints */

function dedupeHints(hints){
  const seen=new Set();
  const out=[];
  for(const hint of hints||[]){
    const key=`${hint.level}:${hint.label}:${hint.colorKey||''}`;
    if(seen.has(key))continue;
    seen.add(key);
    out.push(hint);
  }
  return out;
}

function hintText(hints){
  const seen=new Set();
  const labels=[];
  for(const hint of hints||[]){
    if(seen.has(hint.label))continue;
    seen.add(hint.label);
    labels.push(hint.label);
  }
  return labels.join(' + ');
}

function hintRuntime(target=window){return target.tlrRuntime||{};}
function hintPersist(target=window){return hintRuntime(target).persist||target.persist||{};}
function hintSettings(target=window){return hintRuntime(target).hintSettings||{patterns:true,relics:false};}

function hintsForCard(card,poolCards=null,hintState=null,target=window){
  if(!card)return[];
  if(hintState&&target.tlrHints&&typeof target.tlrHints.getCardHints==='function'){
    const settings=hintSettings(target);
    const persist=hintPersist(target);
    return target.tlrHints.getCardHints(card,{spread:hintState.spread||[],hand:hintState.hand||[]},{
      poolCards:poolCards||undefined,
      patterns:settings.patterns,
      relics:persist.relics,
      includeRelics:settings.relics,
      upgrades:persist.up,
    });
  }
  return cardHints(card,poolCards);
}

export function multiHintShadow(hints, level){
  const ring=level==='complete'?'1px':'0.75px';
  const parts=[];
  const colors=hints.slice(0,4).map(hintColor);
  if(colors.length)parts.push(`0 0 0 ${ring} rgba(${colors[0]},.98)`);
  colors.forEach((rgb,i)=>{
    const blur=26+i*16;
    const alpha=Math.max(.36,.82-i*.12);
    parts.push(`0 0 ${blur}px rgba(${rgb},${alpha})`);
  });
  parts.push('0 5px 14px rgba(0,0,0,.45)');
  return parts.join(',');
}

export function hintGroup(label){if(label==='Sequence'||label==='Path of the Magi')return 'hint-major';if(label==='Royal Court')return 'hint-suit';if(label==='Three of a Kind'||label==='Four of a Kind')return 'hint-rank';if(label==='Full Court')return 'hint-court';return 'hint-gold'}

export function hintRGB(group){
  const map={
    'hint-major':'142,112,255',
    'hint-suit':'94,214,136',
    'hint-rank':'255,121,78',
    'hint-court':'245,218,164',
    'hint-gold':'255,217,120'
  };
  return map[group]||map['hint-gold'];
}

export function colorKeyRGB(key){
  if(!key)return null;
  const SUIT={Cups:'80,220,180',Wands:'255,155,70',Swords:'100,185,255',Pentacles:'185,240,90'};
  const RANK={Page:'255,121,78',Knight:'220,90,220',Queen:'255,190,70',King:'80,215,215'};
  const SEQ=['142,112,255','200,90,255','100,150,255','220,130,255'];
  if(key==='path:magi')return '142,112,255';
  if(key.startsWith('flush:'))return SUIT[key.slice(6)]||'94,214,136';
  if(key.startsWith('rank:'))return RANK[key.slice(5)]||'255,121,78';
  if(key.startsWith('seq:')){const s=parseInt(key.slice(4));return SEQ[s%SEQ.length]}
  return null;
}

export function hintColor(h){return colorKeyRGB(h.colorKey)||hintRGB(h.group||hintGroup(h.label))}

export function applyHint(el,card,poolCards=null,hintState=null){
  let hints=[];
  try{
    hints=dedupeHints(hintsForCard(card,poolCards,hintState));
  }catch(err){
    console.warn('Card hint render failed; continuing without hint.',err,card);
    return;
  }
  if(!hints.length)return;
  const hasComplete=hints.some(h=>h.level==='complete');
  const primary=hints.find(h=>h.level==='complete')||hints[0];
  el.classList.add(hasComplete?'hint-complete':'hint-card',primary.group||hintGroup(primary.label));
  el.style.setProperty('--hint-rgb',hintColor(primary));
  if(hints.length>1){
    el.classList.add('hint-multi');
    el.style.setProperty('--hint-shadow',multiHintShadow(hints,hasComplete?'complete':'near'));
  }
  el.dataset.hint=hintText(hints);
}
