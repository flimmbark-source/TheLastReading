// Menu panel controls extracted from the legacy inline tail.

function inlineScriptStillContains(marker){
  return [...document.scripts].some(script=>script.textContent&&script.textContent.includes(marker));
}

export function installMenuControls(target = window){
  if(!target || target.__tlrMenuControlsInstalled)return;

  // Keep this passive while the inline function/listener remains, otherwise the
  // menu outside-click handler would be registered twice.
  if(inlineScriptStillContains('function toggleMenu(){const p=document.getElementById')){
    target.__tlrLegacyInlineMenuDetected=true;
    return;
  }

  target.__tlrMenuControlsInstalled=true;

  if(typeof target.tlrTogglePullTab==='function'){
    target.toggleMenu=function(){target.tlrTogglePullTab('menu');};
    document.addEventListener('click',e=>{
      const menuWrap=document.getElementById('menuPullWrap');
      const menuTab=document.getElementById('menuPullTab');
      if(!menuWrap||!menuWrap.classList.contains('open'))return;
      const t=e.target instanceof Element?e.target:null;
      if(t&&(menuWrap.contains(t)||t.closest('#menuBtn,#menuPullTab')))return;
      menuWrap.classList.remove('open');
      if(menuTab)menuTab.innerHTML='&#9660; Menu';
    },{capture:false});
    return;
  }

  target.toggleMenu=function(){
    const p=document.getElementById('settingsPanel');
    if(p)p.classList.toggle('hidden');
  };
  document.addEventListener('click',e=>{
    const p=document.getElementById('settingsPanel');
    const b=document.getElementById('menuBtn');
    if(p&&!p.classList.contains('hidden')&&!p.contains(e.target)&&e.target!==b)p.classList.add('hidden');
  },{capture:false});
}
