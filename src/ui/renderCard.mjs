// Shared card renderer (Phase 15.7). Moved verbatim from index.html.
// These read the legacy global card tables (ROMAN, GLYPH, MEAN, COURT_MEAN,
// SUIT_MEAN, MAJOR_G, TXT, RANKS) through the global scope; the classic
// script defines them before this module is evaluated.
/* global ROMAN, GLYPH, MEAN, COURT_MEAN, SUIT_MEAN, MAJOR_G, TXT, RANKS */

const cardHTMLCache = new Map();

export function title(c){if(c.type==='major')return ROMAN[c.num]+' · '+c.name.replace(/^[IVXLCDM\d]+\s+/,'');if(c.type==='court')return c.rank+' of '+GLYPH[c.suit];return c.name}
export function meanings(c){if(c.type==='major')return MEAN[c.id]||['',''];if(c.type==='court')return COURT_MEAN[c.rank]||['',''];return SUIT_MEAN[c.suit]||['','']}
export function symbol(c){return c.type==='major'?(MAJOR_G[c.num]||'✦'):GLYPH[c.suit]}

export const CARD_SHEET={
  major_0:[1,0],major_1:[1,1],major_2:[1,2],major_3:[1,3],
  major_4:[2,0],major_5:[2,1],major_6:[2,2],major_7:[2,3],
  major_8:[3,0],major_9:[3,1],major_10:[3,2],major_11:[3,3],
  major_12:[4,0],major_13:[4,1],major_14:[4,2],major_15:[4,3],
  major_16:[5,0],major_17:[5,1],major_18:[5,2],major_19:[5,3],
  major_20:[6,0],major_21:[6,1],
  court_Wands_Page:[7,0],court_Cups_Page:[7,1],court_Swords_Page:[7,2],court_Pentacles_Page:[7,3],
  court_Wands_Knight:[8,0],court_Cups_Knight:[8,1],court_Swords_Knight:[8,2],court_Pentacles_Knight:[8,3],
  court_Wands_Queen:[9,0],court_Cups_Queen:[9,1],court_Swords_Queen:[9,2],court_Pentacles_Queen:[9,3],
  court_Wands_King:[10,0],court_Cups_King:[10,1],court_Swords_King:[10,2],court_Pentacles_King:[10,3],
};

export function applyCardPhoto(el,card){
  const s=CARD_SHEET[card.id];
  if(!s)return;
  const[sheet,pos]=s;
  const col=pos%2,row=Math.floor(pos/2);
  el.classList.add('photo');
  el.style.backgroundImage=`url(sheet${String(sheet).padStart(2,'0')}.png)`;
  el.style.backgroundPosition=`${col*100}% ${row*100}%`;
}

export function cardHTML(c){
  if(cardHTMLCache.has(c.uid))return cardHTMLCache.get(c.uid);
  const html=`<div class="title">${title(c)}</div><div class="art"><div class="sym">${symbol(c)}</div><div class="plaque">${TXT[c.ability]}</div><div class="seal tr">${c.points}</div></div>`;
  cardHTMLCache.set(c.uid,html);
  return html;
}

export function sortCards(cards){return [...cards].sort((a,b)=>{let o={major:0,court:1};if(o[a.type]!==o[b.type])return o[a.type]-o[b.type];if(a.type==='major')return a.num-b.num;return(a.suit||'').localeCompare(b.suit||'')||RANKS.indexOf(a.rank)-RANKS.indexOf(b.rank)})}

export function cleanName(c){return c.type==='major'?c.name.split(' ').slice(1).join(' '):c.name}

export function cardDisplayName(c){return c.type==='major'?ROMAN[c.num]+' - '+cleanName(c):cleanName(c)}
