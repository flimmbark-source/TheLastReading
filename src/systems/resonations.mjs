// Pure resonation matching helpers.

export function readUnlockedFragments(storage = localStorage){
  try{return JSON.parse(storage.getItem('tlr_inv_unlocked')||'[]');}
  catch(e){return [];}
}

export function writeUnlockedFragments(unlocked, storage = localStorage){
  try{storage.setItem('tlr_inv_unlocked',JSON.stringify(unlocked));}
  catch(e){}
}

export function checkResonationState(spread, resonations){
  const cards = Array.isArray(spread) ? spread : [];
  return resonations.map(res=>{
    const placed=res.conditions.map((cond,ci)=>{
      const ids=cond.anyOf||[cond.cardId];
      const idx=cards.findIndex(c=>c&&ids.includes(c.id));
      return{idx,ci,cond};
    });
    const present=placed.filter(p=>p.idx!==-1);
    if(!present.length)return{res,level:0,matchedSlots:[],matchedConditions:[]};
    const matchedSlots=present.map(p=>p.idx);
    const matchedConditions=present;
    let inOrder=true;
    for(let j=1;j<present.length;j+=1){
      if(present[j].idx<=present[j-1].idx){inOrder=false;break;}
    }
    const level=inOrder?present.length:1;
    return{res,level,matchedSlots,matchedConditions};
  });
}

export function resonationDisplayLevel(match, runState = {}){
  if(!match||!match.level)return 0;
  const key='res_'+match.res.id;
  const alreadyFired=runState.resonationTriggeredThisReading&&runState.resonationTriggeredThisReading[key];
  return alreadyFired?1:match.level;
}

export function itemRequirementsNamed(resonation, inventoryPositions = {}){
  return resonation.conditions.every(cond=>!cond.itemId||inventoryPositions[cond.itemId]?.named);
}

export function triggeredResonations(spread, resonations, runState = {}){
  return checkResonationState(spread,resonations).filter(match=>{
    const key='res_'+match.res.id;
    if(runState.resonationTriggeredThisReading&&runState.resonationTriggeredThisReading[key])return false;
    return match.level===match.res.conditions.length;
  });
}
