// Shared hint renderer (Phase 15.9). Moved verbatim from index.html.
// Card hint detection (cardHints) and the multi-hint shadow builder stay
// legacy for now; this module owns the color mapping and DOM application,
// so the hand glow and the ability-modal glow share one renderer.
/* global cardHints, multiHintShadow */

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
  if(key.startsWith('flush:'))return SUIT[key.slice(6)]||'94,214,136';
  if(key.startsWith('rank:'))return RANK[key.slice(5)]||'255,121,78';
  if(key.startsWith('seq:')){const s=parseInt(key.slice(4));return SEQ[s%SEQ.length]}
  return null;
}

export function hintColor(h){return colorKeyRGB(h.colorKey)||hintRGB(h.group||hintGroup(h.label))}

export function applyHint(el,card,poolCards=null){
  let hints=cardHints(card,poolCards);
  if(!hints.length)return;
  const hasComplete=hints.some(h=>h.level==='complete');
  const primary=hints.find(h=>h.level==='complete')||hints[0];
  el.classList.add(hasComplete?'hint-complete':'hint-card',primary.group||hintGroup(primary.label));
  el.style.setProperty('--hint-rgb',hintColor(primary));
  if(hints.length>1){
    el.classList.add('hint-multi');
    el.style.setProperty('--hint-shadow',multiHintShadow(hints,hasComplete?'complete':'near'));
  }
  el.dataset.hint=hints.map(h=>h.label).join(' + ');
}
