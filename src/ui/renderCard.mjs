// Shared card renderer (Phase 15.7). Moved verbatim from index.html.
// These read the legacy global card tables (ROMAN, GLYPH, MEAN, COURT_MEAN,
// SUIT_MEAN, MAJOR_G, TXT, RANKS) through the global scope; the classic
// script defines them before this module is evaluated.
/* global ROMAN, GLYPH, MEAN, COURT_MEAN, SUIT_MEAN, MAJOR_G, TXT, RANKS */

const cardHTMLCache = new Map();
let detailStyleInstalled = false;

function isInteraction(c){return c?.type==='interaction'}
function interactionSymbol(c){return c?.abilityType==='mp_banish'?'⚔':'🔇'}
function interactionLabel(c){return c?.abilityType==='mp_banish'?'Last Card':'Silence'}
function interactionMeaning(c){return c?.abilityType==='mp_banish'
  ? ['Remove the opponent\'s last played card from their spread.','']
  : ['Silence a card in the opponent\'s spread.',''];}

function majorNumber(c){
  const direct=c?.num??c?.number;
  if(Number.isInteger(direct))return direct;
  const parsed=String(c?.id||'').match(/^major_(\d+)$/);
  return parsed?Number(parsed[1]):null;
}

function majorName(c){
  const raw=String(c?.name||'').trim();
  return raw.replace(/^(?:[IVXLCDM]+|\d+)\s*(?:[·\-–—:]\s*)?/i,'').trim()||raw;
}

export function title(c){
  if(isInteraction(c))return c.name;
  if(c?.type==='major'){
    const num=majorNumber(c);
    const numeral=num!==null?ROMAN[num]:'';
    const name=majorName(c);
    return numeral?`${numeral} · ${name}`:name;
  }
  if(c?.type==='court')return c.rank+' of '+c.suit;
  return c?.name||'';
}
export function meanings(c){if(isInteraction(c))return interactionMeaning(c);if(c.type==='major')return MEAN[c.id]||['',''];if(c.type==='court')return COURT_MEAN[c.rank]||['',''];return SUIT_MEAN[c.suit]||['','']}
export function symbol(c){if(isInteraction(c))return interactionSymbol(c);if(c.type==='major'){const num=majorNumber(c);return(num!==null?MAJOR_G[num]:null)||'✦'}return GLYPH[c.suit]}

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

// Table cards render at ~100-130px, so they use the offline-downscaled
// table-res sheets (sheetNN.small.webp, 300x450 per tile) which are sharper
// under the hand's rotate transforms and far lighter than the full sheets.
// The card-detail modal renders large, so it passes {full:true} to get the
// original 512x768 tiles. background-size:200% 200% is sheet-size agnostic.
export function applyCardPhoto(el,card,{full=false}={}){
  const s=CARD_SHEET[card.id];
  if(!s)return;
  const[sheet,pos]=s;
  const col=pos%2,row=Math.floor(pos/2);
  const num=String(sheet).padStart(2,'0');
  el.classList.add('photo');
  el.style.backgroundImage=full?`url(assets/sheets/sheet${num}.webp)`:`url(assets/sheets/sheet${num}.small.webp)`;
  el.style.backgroundPosition=`${col*100}% ${row*100}%`;
}

export function cardHTML(c){
  if(cardHTMLCache.has(c.uid))return cardHTMLCache.get(c.uid);
  const plaque=isInteraction(c)?interactionLabel(c):(TXT[c.ability]||'');
  const html=`<div class="title">${title(c)}</div><div class="art"><div class="sym">${symbol(c)}</div><div class="plaque">${plaque}</div><div class="seal tr">${c.points}</div></div>`;
  cardHTMLCache.set(c.uid,html);
  return html;
}

export function sortCards(cards){return [...cards].sort((a,b)=>{let o={major:0,court:1,interaction:2};if(o[a.type]!==o[b.type])return o[a.type]-o[b.type];if(a.type==='major')return(majorNumber(a)??0)-(majorNumber(b)??0);if(a.type==='interaction')return String(a.name).localeCompare(String(b.name));return(a.suit||'').localeCompare(b.suit)||RANKS.indexOf(a.rank)-RANKS.indexOf(b.rank)})}

export function cleanName(c){return c?.type==='major'?majorName(c):(c?.name||'')}

export function cardDisplayName(c){
  if(c?.type!=='major')return cleanName(c);
  const num=majorNumber(c);
  const numeral=num!==null?ROMAN[num]:'';
  const name=cleanName(c);
  return numeral?`${numeral} - ${name}`:name;
}

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function ensureCardDetailStyles(target=window){
  const doc=target.document;
  if(!doc||detailStyleInstalled)return;
  detailStyleInstalled=true;
  const style=doc.createElement('style');
  style.id='card-detail-style';
  style.textContent=`
    .card-detail-backdrop{position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;padding:18px;animation:cardDetailFade .14s ease-out both}
    .card-detail-panel{position:relative;width:min(92cqw,420px);max-height:min(88vh,720px);overflow:auto;border:1px solid rgba(228,188,111,.52);border-radius:16px;background:linear-gradient(180deg,rgba(38,28,21,.97),rgba(15,12,11,.98));box-shadow:0 24px 64px rgba(0,0,0,.72),inset 0 0 24px rgba(224,176,89,.08);color:#eadbb9;font-family:Georgia,serif;padding:16px;text-align:center}
    .card-detail-card{width:min(58cqw,190px);aspect-ratio:2.5/3.5;margin:0 auto 12px;border-radius:12px;overflow:hidden;box-shadow:0 12px 28px rgba(0,0,0,.56)}
    .card-detail-card .card{width:100%;height:100%;transform:none!important;position:relative!important;left:auto!important;top:auto!important;pointer-events:none}
    .card-detail-title{font-size:23px;line-height:1.08;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#f2dfb8;text-shadow:0 2px 3px #000;margin:8px 0 6px}
    .card-detail-meta{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;font:800 11px system-ui,Segoe UI,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#d19c51}
    .card-detail-meaning{display:grid;gap:8px;text-align:left;margin-top:10px}
    .card-detail-meaning div{border:1px solid rgba(210,161,94,.22);border-radius:10px;background:rgba(255,255,255,.035);padding:10px;color:#dfcfb0;font:600 13px/1.35 system-ui,Segoe UI,sans-serif}
    .card-detail-close{position:absolute;right:10px;top:8px;border:0;background:transparent;color:#e7c07c;font-size:22px;line-height:1;cursor:pointer}
    .card-detail-stamps{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}
    .card-detail-stamp{display:flex;align-items:center;gap:8px;border-radius:8px;padding:7px 10px;font:700 12px/1.2 system-ui,Segoe UI,sans-serif;text-align:left}
    .card-detail-stamp.suit-stamp{background:rgba(60,107,191,.18);border:1px solid rgba(100,148,255,.3);color:#a8c4ff}
    .card-detail-stamp.five-stamp{background:rgba(212,160,23,.15);border:1px solid rgba(212,160,23,.35);color:#f0c84a}
    @keyframes cardDetailFade{from{opacity:0}to{opacity:1}}
  `;
  doc.head.appendChild(style);
}

export function closeCardDetail(target=window){
  target.document?.querySelector('.card-detail-backdrop')?.remove();
  target.__tlrCardDetailOpen=false;
}

export function expandCard(card,target=window){
  if(!card||!target.document)return false;
  ensureCardDetailStyles(target);
  closeCardDetail(target);
  const [upright,reversed]=meanings(card);
  const backdrop=target.document.createElement('div');
  backdrop.className='card-detail-backdrop';
  const cardClass='card '+(card.type==='major'?'major ':'')+(CARD_SHEET[card.id]?'photo ':'')+(isInteraction(card)?'mp-interaction ':'');
  const ability=isInteraction(card)?interactionLabel(card):(TXT[card.ability]||card.ability||'—');
  const persist=target.persist||{};
  const stampedMajors=new Set(persist.stampedMajors||[]);
  const stampedFive=new Set(persist.stampedFive||[]);
  const stampParts=[];
  if(card.type==='major'&&stampedMajors.has(card.id)&&Array.isArray(card.suits)&&card.suits.length){
    stampParts.push(`<span class="card-detail-stamp suit-stamp">♡ Suit Stamp — counts as ${escapeHtml(card.suits.join(', '))} toward Royal Court</span>`);
  }
  if(stampedFive.has(card.id)){
    stampParts.push(`<span class="card-detail-stamp five-stamp">5★ Five Star Stamp — slots into Sequences as a multiple of 5 (5, 10, 15, 20)</span>`);
  }
  const stampsHtml=stampParts.length?`<div class="card-detail-stamps">${stampParts.join('')}</div>`:'';
  backdrop.innerHTML=`<div class="card-detail-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(title(card))}">
    <button class="card-detail-close" type="button" aria-label="Close">×</button>
    <div class="card-detail-card"><div class="${cardClass}" data-uid="${card.uid}">${cardHTML(card)}</div></div>
    <div class="card-detail-title">${escapeHtml(title(card))}</div>
    <div class="card-detail-meta"><span>${escapeHtml(String(card.points))} Chips</span><span>${escapeHtml(ability)}</span></div>
    ${stampsHtml}<div class="card-detail-meaning"><div>${escapeHtml(upright||'')}</div><div>${escapeHtml(reversed||'')}</div></div>
  </div>`;
  target.document.body.appendChild(backdrop);
  target.__tlrCardDetailOpen=true;
  const rendered=backdrop.querySelector('.card-detail-card .card');
  if(rendered)applyCardPhoto(rendered,card,{full:true});
  backdrop.addEventListener('click',ev=>{if(ev.target===backdrop)closeCardDetail(target);});
  backdrop.querySelector('.card-detail-close')?.addEventListener('click',()=>closeCardDetail(target));
  const onKey=ev=>{if(ev.key==='Escape'){closeCardDetail(target);target.document.removeEventListener('keydown',onKey,true);}};
  target.document.addEventListener('keydown',onKey,true);
  return true;
}
