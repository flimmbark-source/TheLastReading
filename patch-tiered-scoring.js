const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* tiered scoring patch */';
if (html.includes(marker)) {
  console.log('Tiered scoring patch already present, skipping.');
  process.exit(0);
}

let changed = 0;
function rep(oldText, newText, label) {
  if (html.includes(oldText)) {
    html = html.replace(oldText, newText);
    console.log('  ✓', label);
    changed++;
  } else {
    console.warn('  WARN: not found —', label);
  }
}

console.log('Tiered scoring patch:');

// Three of a Kind and Four of a Kind should both score when the 4th matching rank appears.
rep(
  `if(a.length===4){let x=7+rankBonus;m.push(['Four of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult*=rankMult}
    else if(a.length===3){let x=5+rankBonus;m.push(['Three of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult*=rankMult}`,
  `if(a.length>=3){let x=5+rankBonus;m.push(['Three of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult*=rankMult}
    if(a.length>=4){let x=7+rankBonus;m.push(['Four of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult*=rankMult}`,
  'Rank tiers score independently at 3 and 4 cards'
);

// Full/Royal Court should score at 3 and then score again at 4.
rep(
  `  if(same){
    m.push(['Royal Court ('+same+')',10+courtChips,courtMult]);chips+=10+courtChips;mult*=courtMult;court=true;
  } else if(fullCount>=3){
    m.push(['Full Court',10+courtChips,courtMult]);chips+=10+courtChips;mult*=courtMult;court=true;
  }`,
  `  if(same){
    for(let tier=3;tier<=Math.min(4,sameCount);tier++){m.push(['Royal Court ('+tier+', '+same+')',10+courtChips,courtMult]);chips+=10+courtChips;mult*=courtMult;court=true;}
  } else if(fullCount>=3){
    for(let tier=3;tier<=Math.min(4,fullCount);tier++){m.push(['Full Court ('+tier+')',10+courtChips,courtMult]);chips+=10+courtChips;mult*=courtMult;court=true;}
  }`,
  'Court tiers score independently at 3 and 4 cards'
);

// Sequence should score again for each longer interval.
rep(
  `  if(best>=3){let x=10+seqBonus;m.push(['Sequence of '+best,x,seqMult]);chips+=x;mult*=seqMult}`,
  `  if(best>=3){for(let tier=3;tier<=best;tier++){let x=10+seqBonus;m.push(['Sequence of '+tier,x,seqMult]);chips+=x;mult*=seqMult}}`,
  'Sequence tiers score independently at 3, 4, and 5 cards'
);

// Slot highlighting should only bump the cards that belong to the specific tier being announced.
rep(
  `function slotsForMeld(name){let filled=state.spread.map((c,i)=>c?{c,i}:null).filter(Boolean);if(name.startsWith('Three of a Kind')||name.startsWith('Four of a Kind')){let rank=['Page','Knight','Queen','King'].find(r=>name.includes(r+'s'));return rank?filled.filter(x=>x.c.type==='court'&&x.c.rank===rank).map(x=>x.i):[]}if(name==='Full Court'){const ELIG=['Page','Knight','Queen','King'];let seen=new Set(),out=[];for(const x of filled){if(x.c.type==='court'&&!seen.has(x.c.rank)&&ELIG.includes(x.c.rank)){seen.add(x.c.rank);out.push(x.i)}}return out}if(name.startsWith('Royal Court')||name.startsWith('Flush')){let suit=SUITS.find(s=>name.includes(s));return suit?filled.filter(x=>x.c.suit===suit).map(x=>x.i):[]}if(name.startsWith('Sequence')){let tr=filled.filter(x=>x.c.type==='major').sort((a,b)=>a.c.num-b.c.num);let bs=0,bl=1,cs=0,cl=1;for(let j=1;j<tr.length;j++){if(tr[j].c.num===tr[j-1].c.num+1){cl++;if(cl>bl){bl=cl;bs=cs}}else{cs=j;cl=1}}return tr.slice(bs,bs+bl).map(x=>x.i)}if(name==='Path of the Magi')return filled.filter(x=>['major_0','major_1','major_21'].includes(x.c.id)).map(x=>x.i);return[]}`,
  `function slotsForMeld(name){let filled=state.spread.map((c,i)=>c?{c,i}:null).filter(Boolean);const tierFrom=()=>{let m=name.match(/\\((\\d+)/)||name.match(/of (\\d+)/);return m?parseInt(m[1]):0};if(name.startsWith('Three of a Kind')||name.startsWith('Four of a Kind')){let rank=['Page','Knight','Queen','King'].find(r=>name.includes(r+'s'));let lim=name.startsWith('Three')?3:4;return rank?filled.filter(x=>x.c.type==='court'&&x.c.rank===rank).slice(0,lim).map(x=>x.i):[]}if(name.startsWith('Full Court')){const ELIG=['Page','Knight','Queen','King'];let seen=new Set(),out=[],lim=tierFrom()||4;for(const x of filled){if(out.length>=lim)break;if(x.c.type==='court'&&!seen.has(x.c.rank)&&ELIG.includes(x.c.rank)){seen.add(x.c.rank);out.push(x.i)}}return out}if(name.startsWith('Royal Court')||name.startsWith('Flush')){let suit=SUITS.find(s=>name.includes(s));let lim=tierFrom()||4;return suit?filled.filter(x=>x.c.suit===suit).slice(0,lim).map(x=>x.i):[]}if(name.startsWith('Sequence')){let tr=filled.filter(x=>x.c.type==='major').sort((a,b)=>a.c.num-b.c.num);let bs=0,bl=1,cs=0,cl=1;for(let j=1;j<tr.length;j++){if(tr[j].c.num===tr[j-1].c.num+1){cl++;if(cl>bl){bl=cl;bs=cs}}else{cs=j;cl=1}}let want=tierFrom()||bl;return tr.slice(bs,bs+Math.min(want,bl)).map(x=>x.i)}if(name==='Path of the Magi')return filled.filter(x=>['major_0','major_1','major_21'].includes(x.c.id)).map(x=>x.i);return[]}`,
  'Tier-aware meld slot highlighting'
);

// Reference labels should reflect that interval tiers can repeat.
rep(`['Full Court (3+)','Consecutive ranks'`, `['Full Court (3/4)','Consecutive ranks'`, 'Reference label: Full Court tiers');
rep(`['Royal Court (3+)','Consecutive ranks, same suit'`, `['Royal Court (3/4)','Consecutive ranks, same suit'`, 'Reference label: Royal Court tiers');
rep(`['Sequence (3+)','Consecutive major arcana'`, `['Sequence (3/4/5)','Consecutive major arcana'`, 'Reference label: Sequence tiers');

html = html.replace('</script>', `${marker}\n</script>`);
fs.writeFileSync(file, html);
console.log(`Done — ${changed} tiered scoring replacements applied.`);
