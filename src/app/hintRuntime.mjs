// Hint/scoring bridge extracted as module utilities.
// The inline script still owns the active functions today; this module prepares
// module-owned equivalents and installs fallbacks only when no legacy function exists.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state;}
function persistOf(target){return runtime(target).persist;}
function hintSettingsOf(target){return runtime(target).hintSettings || {patterns:true,relics:false,patternText:true};}
function cachesOf(target){return runtime(target).caches || (target.__tlrRuntimeCaches ||= {});}

export function majorNumeral(id){
  const n=parseInt(String(id).split('_')[1]);
  if(n===0)return'0';
  const v=[1000,'M',900,'CM',500,'D',400,'CD',100,'C',90,'XC',50,'L',40,'XL',10,'X',9,'IX',5,'V',4,'IV',1,'I'];
  let r='',x=n;
  for(let i=0;i<v.length;i+=2){while(x>=v[i]){r+=v[i+1];x-=v[i];}}
  return r;
}

export function hintsKey(target = window){
  const state=stateOf(target);
  return state.spread.map(c=>c?c.uid:0).join(',')+'|'+state.hand.map(c=>c.uid).join(',');
}

export function cardHints(card,poolCards=null,target = window){
  const state=stateOf(target);
  const persist=persistOf(target);
  const settings=hintSettingsOf(target);
  const caches=cachesOf(target);
  if(!caches.hints)caches.hints=new Map();
  const baseKey=hintsKey(target);
  if(!poolCards){const k=baseKey+':'+card.uid;if(caches.hints.has(k))return caches.hints.get(k);}
  const hints=target.tlrHints.getCardHints(card,{spread:state.spread,hand:state.hand},{
    poolCards:poolCards||undefined,
    patterns:settings.patterns,
    relics:persist.relics,
    includeRelics:settings.relics,
    upgrades:persist.up,
    stampedMajors:persist.stampedMajors||[],
  });
  if(!poolCards){
    if(!caches.unlockedFragments){
      caches.unlockedFragments=target.tlrResonations?target.tlrResonations.getUnlockedFragments(target):(typeof target.getUnlockedFragments==='function'?target.getUnlockedFragments():[]);
    }
    const unlocked=caches.unlockedFragments;
    const spread=state.spread.filter(Boolean);
    const seen=new Set(hints.map(h=>h.label));
    for(const res of target.RESONATIONS||[]){
      if(!unlocked.includes(res.fragmentId))continue;
      const myCondIdx=res.conditions.findIndex(cond=>(cond.anyOf||[cond.cardId]).includes(card.id));
      if(myCondIdx===-1)continue;
      const othersInSpread=res.conditions.filter((cond,ci)=>{
        if(ci===myCondIdx)return false;
        return spread.some(c=>(cond.anyOf||[cond.cardId]).includes(c.id));
      }).length;
      const label='⚷ '+res.name;
      if(!seen.has(label)){
        seen.add(label);
        if(othersInSpread===res.conditions.length-1)hints.push({level:'complete',label,group:'hint-gold',colorKey:null});
        else if(othersInSpread>0)hints.push({level:'near',label,group:'hint-gold',colorKey:null});
      }
    }
    caches.hints.set(baseKey+':'+card.uid,hints);
  }
  return hints;
}

export function cardHint(card,poolCards=null,target = window){return cardHints(card,poolCards,target)[0]||null;}

export function slotsForMeld(name,target = window){
  const state=stateOf(target);
  const filled=state.spread.map((c,i)=>c?{c,i}:null).filter(Boolean);
  const tierFrom=()=>{const m=name.match(/\((\d+)/)||name.match(/of (\d+)/);return m?parseInt(m[1]):0;};
  if(name.startsWith('Three of a Kind')||name.startsWith('Four of a Kind')){
    const rank=['Page','Knight','Queen','King'].find(r=>name.includes(r+'s'));
    const limit=name.startsWith('Three')?3:4;
    return rank?filled.filter(x=>x.c.type==='court'&&x.c.rank===rank).slice(0,limit).map(x=>x.i):[];
  }
  if(name.startsWith('Full Court')){
    const eligible=['Page','Knight','Queen','King'];let seen=new Set(),out=[],limit=tierFrom()||4;
    for(const x of filled){if(out.length>=limit)break;if(x.c.type==='court'&&!seen.has(x.c.rank)&&eligible.includes(x.c.rank)){seen.add(x.c.rank);out.push(x.i);}}
    return out;
  }
  if(name.startsWith('Royal Court')||name.startsWith('Flush')){
    const suit=(target.SUITS||[]).find(s=>name.includes(s));const limit=tierFrom()||4;
    if(!suit)return[];
    const stampedIds=new Set((persistOf(target)?.stampedMajors)||[]);
    const matches=filled.filter(x=>
      x.c.suit===suit||
      (x.c.type==='major'&&stampedIds.has(x.c.id)&&(x.c.suits||[]).includes(suit))
    );
    return matches.slice(0,limit).map(x=>x.i);
  }
  if(name.startsWith('Sequence')){
    const tr=filled.filter(x=>x.c.type==='major').sort((a,b)=>a.c.num-b.c.num);
    let bs=0,bl=1,cs=0,cl=1;
    for(let j=1;j<tr.length;j+=1){if(tr[j].c.num===tr[j-1].c.num+1){cl+=1;if(cl>bl){bl=cl;bs=cs;}}else{cs=j;cl=1;}}
    const want=tierFrom()||bl;
    return tr.slice(bs,bs+Math.min(want,bl)).map(x=>x.i);
  }
  if(name==='Path of the Magi')return filled.filter(x=>['major_0','major_1','major_21'].includes(x.c.id)).map(x=>x.i);
  return[];
}

export function installHintRuntime(target = window){
  if(!target || target.__tlrHintRuntimeInstalled)return;
  target.__tlrHintRuntimeInstalled=true;
  target.tlrHintRuntime={majorNumeral,hintsKey,cardHints,cardHint,slotsForMeld};
  if(typeof target.majorNumeral!=='function')target.majorNumeral=majorNumeral;
  if(typeof target._hintsKey!=='function')target._hintsKey=()=>hintsKey(target);
  if(typeof target.cardHints!=='function')target.cardHints=(card,poolCards=null)=>cardHints(card,poolCards,target);
  if(typeof target.cardHint!=='function')target.cardHint=(card,poolCards=null)=>cardHint(card,poolCards,target);
  if(typeof target.slotsForMeld!=='function')target.slotsForMeld=name=>slotsForMeld(name,target);
}
