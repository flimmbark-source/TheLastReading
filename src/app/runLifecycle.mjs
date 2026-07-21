// Run lifecycle policy for moving between the reading table and the attic.
// Attic visits are pauses inside the current run; only an actual session end
// awards its Obals and creates a fresh run.

function currentStoredObals(target){
  const value=Number(target.tlrStore?.getState?.()?.persist?.obals);
  return Number.isFinite(value)?Math.max(0,value):0;
}

function closeTableMenu(target){
  target.tlrCloseArchives?.();
  const panel=target.document?.getElementById('settingsPanel');
  if(panel)panel.classList.add('hidden');
  const wrap=target.document?.getElementById('menuPullWrap');
  if(wrap?.classList.contains('open')){
    wrap.classList.remove('open');
    const tab=target.document.getElementById('menuPullTab');
    if(tab)tab.innerHTML='&#9660; Menu';
  }
}

function failedResultOpen(target){
  const summary=target.document?.getElementById('summary');
  return Boolean(summary?.classList.contains('show')&&summary.querySelector('.result-panel.fail'));
}

function rewriteFailedRunAction(target){
  const summary=target.document?.getElementById('summary');
  const button=summary?.querySelector('.result-panel.fail button[onclick*="endSession"]');
  if(button)button.textContent='Start New Run';
}

function startNewRun(target){
  target.clearOverlay?.();
  target.resetSession?.();
}

export function installRunLifecycle(target=globalThis.window){
  if(!target||target.__tlrRunLifecycleInstalled)return;
  target.__tlrRunLifecycleInstalled=true;

  target.tlrEnterAtticPreservingRun=function(){
    target.clearOverlay?.();
    target.tlrDebugEnterAttic?.(currentStoredObals(target),false);
  };

  target.tlrStartNewRunAfterSession=function(){startNewRun(target);};

  target.getUpFromTable=function(){
    if(target.state?.busy)return;
    closeTableMenu(target);
    target.showOverlay?.(`<div class="result-panel"><div class="rhead"><span class="rorn">✦ &nbsp; ✦ &nbsp; ✦</span><h3>Rise from the Table?</h3></div><p style="color:#8a7551;font-size:13px;text-align:center;margin:0 0 22px;line-height:1.5">The cards and current run will remain as they are.<br>Sit back down to continue.</p><div class="rbtns"><button onclick="clearOverlay()">Stay</button><button class="btn-gold" onclick="tlrEnterAtticPreservingRun()">Go to the Attic</button></div></div>`);
  };

  target.endSession=function(skipSummary=false){
    const total=Number(target.persist?.totalScore)||0;
    const obals=target.tlrScoreToObals?target.tlrScoreToObals(total):1;
    target.tlrStore?.dispatch?.({type:target.tlrActions.END_SESSION,totalScore:total,obals});

    if(skipSummary||failedResultOpen(target)){
      startNewRun(target);
      return;
    }

    target.showOverlay?.(`<div class="result-panel pass"><div class="rhead"><span class="rorn">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class="pass">The Reading Ends</h3></div><div class="rscore"><span class="rsf">${total}</span></div><span class="rverdict pass">Total Score</span><div class="rscore" style="margin-top:10px"><span class="rsf" style="font-size:32px">${obals}</span></div><span class="rverdict pass">Obals</span><div class="rbtns"><button class="btn-gold" onclick="tlrStartNewRunAfterSession()">Start New Run</button></div></div>`);
  };

  const doc=target.document;
  const Observer=target.MutationObserver||globalThis.MutationObserver;
  const summary=doc?.getElementById?.('summary');
  if(summary&&typeof Observer==='function'){
    const observer=new Observer(()=>rewriteFailedRunAction(target));
    observer.observe(summary,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    target.__tlrRunLifecycleObserver=observer;
    rewriteFailedRunAction(target);
  }
}
