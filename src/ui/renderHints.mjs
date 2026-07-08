// Shared hint renderer (Phase 15.9). Moved verbatim from index.html.
// Card hint detection delegates to src/systems/hints.mjs; this module owns
// the color mapping, multi-shadow builder, and DOM application so the hand
// glow and ability-modal glow share one renderer.
/* global cardHints */
import { ABILITY_LABELS, SUIT_GLYPHS } from '../data/cards.mjs';

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

function hintLabels(hints){
  const seen=new Set();
  const labels=[];
  for(const hint of hints||[]){
    if(seen.has(hint.label))continue;
    seen.add(hint.label);
    labels.push(hint.label);
  }
  return labels;
}

function hintRuntime(target=window){return target.tlrRuntime||{};}
function hintPersist(target=window){return hintRuntime(target).persist||target.persist||{};}
function hintSettings(target=window){return hintRuntime(target).hintSettings||{patterns:false,relics:false,patternText:false};}

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

// ── Contextual hint panel payload ──
// applyHint stays the single source of truth for hint data: it already dedupes
// the card's hints for the glow, so it also serializes the small structured
// payload the contextual panel (renderCardHintPanel.mjs) renders. The panel is
// a decision lens, not a rules sheet — placement value, a few pattern rows, the
// discard ability, and symbolic modifier icons.

function abilityDiscardLabel(card){
  const key=card&&card.ability;
  if(!key)return null;
  const label=ABILITY_LABELS[key];
  // Some abilities (e.g. NEIGHBOR_2) intentionally have no player-facing label.
  return label?label:null;
}

function cardBasePoints(card){
  const n=Number(card&&card.points);
  return Number.isFinite(n)?n:0;
}

function cardModifiers(card,target=window){
  if(!card)return[];
  const persist=hintPersist(target);
  const mods=[];
  const stamped=new Set(persist.stampedMajors||[]);
  const stampedFive=new Set(persist.stampedFive||[]);
  // A stamped major counts toward its suits' court patterns: surface those
  // suits as symbolic glyph chips, no explanatory text.
  if(stamped.has(card.id)&&Array.isArray(card.suits)){
    for(const suit of card.suits){
      const glyph=SUIT_GLYPHS[suit];
      if(glyph)mods.push({key:`stamp:${suit}`,icon:glyph});
    }
  }
  if(stampedFive.has(card.id))mods.push({key:'five',icon:'✶'});
  return mods;
}

// One row per distinct pattern label, complete preferred over near, capped at a
// few rows. Progress "(have/need)" only rides along for near hints where the
// detection already computed a sane, still-incomplete count.
function panelPatternRows(hints,limit=3){
  const byLabel=new Map();
  for(const h of hints){
    const prev=byLabel.get(h.label);
    if(!prev||(h.level==='complete'&&prev.level!=='complete'))byLabel.set(h.label,h);
  }
  const rows=[];
  for(const h of byLabel.values()){
    const row={label:h.label,level:h.level};
    const p=h.progress;
    if(h.level!=='complete'&&p&&Number.isFinite(p.have)&&Number.isFinite(p.need)&&p.have>0&&p.have<p.need){
      row.have=p.have;
      row.need=p.need;
    }
    rows.push(row);
  }
  rows.sort((a,b)=>(b.level==='complete'?1:0)-(a.level==='complete'?1:0));
  return rows.slice(0,limit);
}

function buildHintPanelPayload(card,hints,target=window){
  return {
    base:cardBasePoints(card),
    discard:abilityDiscardLabel(card),
    patterns:panelPatternRows(hints),
    modifiers:cardModifiers(card,target),
  };
}

export function applyHint(el,card,poolCards=null,hintState=null){
  if(typeof window!=='undefined'&&window.__tlrAdventureActive){
    if(typeof window.__tlrAdventureApplyHint==='function')window.__tlrAdventureApplyHint(el,card);
    return;
  }
  let hints=[];
  try{
    hints=dedupeHints(hintsForCard(card,poolCards,hintState));
  }catch(err){
    console.warn('Card hint render failed; continuing without hint.',err,card);
    hints=[];
  }
  // Glow is untouched by the panel work: same classes/vars, same conditions.
  if(hints.length){
    const hasComplete=hints.some(h=>h.level==='complete');
    const primary=hints.find(h=>h.level==='complete')||hints[0];
    el.classList.add(hasComplete?'hint-complete':'hint-card',primary.group||hintGroup(primary.label));
    el.style.setProperty('--hint-rgb',hintColor(primary));
    if(hints.length>1){
      el.classList.add('hint-multi');
      el.style.setProperty('--hint-shadow',multiHintShadow(hints,hasComplete?'complete':'near'));
    }
  }
  // Pattern Hint Text (settings panel) gates only the visible text, never the
  // glow above. When it is off, clear any stale data so a reused card element
  // can't re-show the panel; when on, emit the panel payload even for a card
  // with no patterns (it still shows placement value and discard ability).
  if(hintSettings().patternText===false){
    delete el.dataset.hint;
    delete el.dataset.hintLines;
    delete el.dataset.hintPanel;
    return;
  }
  const labels=hintLabels(hints);
  // data-hint still feeds the classic above-card pill in the non-single-player
  // surfaces (multiplayer, ability-choice modal) that the panel does not cover.
  if(labels.length)el.dataset.hint=labels.join(' + ');
  else delete el.dataset.hint;
  delete el.dataset.hintLines;
  try{
    el.dataset.hintPanel=JSON.stringify(buildHintPanelPayload(card,hints,window));
  }catch(err){
    console.warn('Hint panel payload failed; continuing without panel.',err,card);
    delete el.dataset.hintPanel;
  }
}
