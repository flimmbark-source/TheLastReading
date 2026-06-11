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
