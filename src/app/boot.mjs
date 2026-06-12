// Boot ownership extracted from the remaining legacy inline fallback.

export function bootGame(target = window){
  if(!target || target.__tlrBooted)return;
  target.__tlrBooted=true;

  if(target.__tlrBootFallback){
    try{target.clearTimeout(target.__tlrBootFallback);}catch(e){}
    target.__tlrBootFallback=null;
  }

  target.tlrLegacyBoot=function(){
    if(typeof target.tlrShowMainMenu==='function'){
      target.tlrShowMainMenu();
    } else {
      if(typeof target.startReading==='function')target.startReading();
      if(!target.localStorage.getItem('tlr_tut_done')&&typeof target.tutShow==='function'){
        target.setTimeout(()=>target.tutShow(0),400);
      }
    }
  };

  target.tlrLegacyBoot();
}
