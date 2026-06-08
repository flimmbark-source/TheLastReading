const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Attic scene shell patch */';
const jsMarker = '// Attic debug shortcut patch';

if (!html.includes(marker)) {
  const css = `
${marker}
#atticScene{position:fixed;inset:0;z-index:520;opacity:0;pointer-events:none;background:url('backgrounds/attic_room_mvp_1080x1920.png') center center/cover no-repeat;transition:opacity .9s ease,filter .9s ease,transform 1.15s ease;transform:scale(1.04);filter:blur(2px);overflow:hidden;color:#ead9b5;font-family:Georgia,serif}
#atticScene::before{content:'';position:absolute;inset:0;background:url('fx/transition_dark_vignette_1080x1920.png') center center/cover no-repeat;opacity:.72;z-index:1}
#atticScene::after{content:'';position:absolute;inset:0;background:url('fx/table_to_attic_fog_overlay_1080x1920.png') center center/cover no-repeat;opacity:.36;z-index:2;mix-blend-mode:screen}
body.mode-to-attic #atticScene,body.mode-attic #atticScene{opacity:1;filter:none;transform:scale(1);pointer-events:auto}
body.mode-to-table #atticScene{opacity:0;filter:blur(3px);transform:scale(1.04);pointer-events:none}
body.mode-to-attic #titleWrap,body.mode-to-attic .score-stack,body.mode-to-attic .spread-wrap,body.mode-to-attic .handDock,body.mode-to-attic #relicRack,body.mode-to-attic #invWrap,body.mode-to-attic .refs-layer{opacity:0;transform:scale(.9) translateY(14vh);filter:blur(2px);pointer-events:none;transition:opacity .75s ease,transform 1.1s ease,filter .75s ease}
body.mode-attic #titleWrap,body.mode-attic .score-stack,body.mode-attic .spread-wrap,body.mode-attic .handDock,body.mode-attic #relicRack,body.mode-attic #invWrap,body.mode-attic .refs-layer{opacity:0!important;pointer-events:none!important;filter:blur(3px);transform:scale(.88) translateY(18vh)}
body.mode-to-table #titleWrap,body.mode-to-table .score-stack,body.mode-to-table .spread-wrap,body.mode-to-table .handDock,body.mode-to-table #relicRack,body.mode-to-table #invWrap,body.mode-to-table .refs-layer{opacity:1;transform:none;filter:none;transition:opacity .85s ease,transform 1.15s ease,filter .85s ease}
#atticObjects{position:absolute;inset:0;z-index:6}
#candlelightHud{position:absolute;left:14px;top:12px;z-index:14;display:flex;gap:6px}
#atticWhisper{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:16;opacity:0;pointer-events:none}
#atticWhisper.show{opacity:1}
`;
  html = html.replace('</style>', css + '\n</style>');
}

if (!html.includes('<div id="atticScene"')) {
  const scene = '<div id="atticScene" aria-hidden="true"><div id="candlelightHud"></div><div id="atticObjects"></div><div id="atticWhisper"></div></div>\n';
  html = html.replace('<div id="summary"></div>', scene + '<div id="summary"></div>');
}

if (!html.includes(jsMarker)) {
  const js = `
${jsMarker}
(function(){
  let inAttic=false;
  function enter(){
    inAttic=true;
    document.body.classList.remove('mode-reading','mode-to-table');
    document.body.classList.add('mode-to-attic');
    const scene=document.getElementById('atticScene');
    if(scene)scene.setAttribute('aria-hidden','false');
    setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic')},900);
  }
  function leave(){
    inAttic=false;
    document.body.classList.remove('mode-attic','mode-to-attic');
    document.body.classList.add('mode-to-table');
    const scene=document.getElementById('atticScene');
    if(scene)scene.setAttribute('aria-hidden','true');
    setTimeout(function(){document.body.classList.remove('mode-to-table');document.body.classList.add('mode-reading')},900);
  }
  window.tlrDebugEnterAttic=enter;
  window.tlrDebugLeaveAttic=leave;
  document.addEventListener('keydown',function(e){if(e.shiftKey&&e.key==='A'){inAttic?leave():enter();}});
})();
`;
  html = html.replace('</script>', js + '\n</script>');
}

fs.writeFileSync(file, html);
console.log('Applied attic scene shell and debug shortcut patch.');
