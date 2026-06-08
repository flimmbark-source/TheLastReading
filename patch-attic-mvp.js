const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Attic scene shell patch */';
const jsMarker = '// Attic end screen transition patch';

if (!html.includes(marker)) {
  const css = `
${marker}
#atticScene{position:fixed;inset:0;z-index:520;opacity:0;pointer-events:none;background:url('backgrounds/attic_room_mvp_1080x1920.png') center center/cover no-repeat;transition:opacity .9s ease,filter .9s ease,transform 1.15s ease;transform:scale(1.04);filter:blur(2px);overflow:hidden;color:#ead9b5;font-family:Georgia,serif}
#atticScene::before{content:'';position:absolute;inset:0;background:url('fx/transition_dark_vignette_1080x1920.png') center center/cover no-repeat;opacity:.72;z-index:1;pointer-events:none}
#atticScene::after{content:'';position:absolute;inset:0;background:url('fx/table_to_attic_fog_overlay_1080x1920.png') center center/cover no-repeat;opacity:.36;z-index:2;mix-blend-mode:screen;pointer-events:none}
body.mode-to-attic #atticScene,body.mode-attic #atticScene{opacity:1;filter:none;transform:scale(1);pointer-events:auto}
body.mode-to-table #atticScene{opacity:0;filter:blur(3px);transform:scale(1.04);pointer-events:none}
body.mode-to-attic #titleWrap,body.mode-to-attic .score-stack,body.mode-to-attic .spread-wrap,body.mode-to-attic .handDock,body.mode-to-attic #relicRack,body.mode-to-attic #invWrap,body.mode-to-attic .refs-layer{opacity:0;transform:scale(.9) translateY(14vh);filter:blur(2px);pointer-events:none;transition:opacity .75s ease,transform 1.1s ease,filter .75s ease}
body.mode-attic #titleWrap,body.mode-attic .score-stack,body.mode-attic .spread-wrap,body.mode-attic .handDock,body.mode-attic #relicRack,body.mode-attic #invWrap,body.mode-attic .refs-layer{opacity:0!important;pointer-events:none!important;filter:blur(3px);transform:scale(.88) translateY(18vh)}
body.mode-to-table #titleWrap,body.mode-to-table .score-stack,body.mode-to-table .spread-wrap,body.mode-to-table .handDock,body.mode-to-table #relicRack,body.mode-to-table #invWrap,body.mode-to-table .refs-layer{opacity:1;transform:none;filter:none;transition:opacity .85s ease,transform 1.15s ease,filter .85s ease}
#atticObjects{position:absolute;inset:0;z-index:6}
#candlelightHud{position:absolute;left:14px;top:12px;z-index:14;display:flex;gap:6px;align-items:center;padding:7px 9px;border:1px solid rgba(155,111,55,.55);border-radius:999px;background:rgba(15,9,5,.54);box-shadow:0 10px 28px rgba(0,0,0,.45)}
.candlelight-icon{width:34px;height:34px;background-size:contain;background-position:center;background-repeat:no-repeat;transition:opacity .25s ease,transform .25s ease}
.candlelight-icon.on{background-image:url('ui/candle_flame_on.png')}
.candlelight-icon.off{background-image:url('ui/candle_flame_off.png');opacity:.48;transform:scale(.92)}
#atticWhisper{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:16;min-width:min(82vw,420px);max-width:min(90vw,560px);min-height:62px;padding:18px 28px 20px;background:url('ui/attic_whisper_plaque.png') center/100% 100% no-repeat;color:#ead9b5;text-align:center;font:700 14px Georgia,serif;text-shadow:0 2px 8px rgba(0,0,0,.9);opacity:0;pointer-events:none;transition:opacity .25s ease}
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
  let resetOnLeave=false;
  let candleCount=0;
  function candlesFromScore(score){if(score>=1000)return 7;if(score>=700)return 6;if(score>=450)return 5;if(score>=250)return 4;if(score>=100)return 3;if(score>=50)return 2;return 1;}
  function renderCandles(){const h=document.getElementById('candlelightHud');if(!h)return;let out='';const n=Math.max(1,candleCount||1);for(let i=0;i<n;i++)out+='<span class="candlelight-icon on"></span>';h.innerHTML=out;}
  function whisper(text){const w=document.getElementById('atticWhisper');if(!w)return;w.textContent=text;w.classList.add('show');clearTimeout(whisper.t);whisper.t=setTimeout(function(){w.classList.remove('show')},2600);}
  function enter(candles,shouldReset){
    inAttic=true;resetOnLeave=!!shouldReset;candleCount=Math.max(1,Number(candles)||1);renderCandles();
    document.body.classList.remove('mode-reading','mode-to-table');document.body.classList.add('mode-to-attic');
    const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','false');
    setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic');whisper('You get up from the table. The attic waits. Tap the room to return for now.');},900);
  }
  function leave(){
    if(!inAttic)return;inAttic=false;
    document.body.classList.remove('mode-attic','mode-to-attic');document.body.classList.add('mode-to-table');
    const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');
    setTimeout(function(){document.body.classList.remove('mode-to-table');document.body.classList.add('mode-reading');if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}},900);
  }
  window.tlrScoreToCandlelight=candlesFromScore;
  window.tlrDebugEnterAttic=enter;
  window.tlrDebugLeaveAttic=leave;
  window.tlrEnterAtticAfterReading=function(score){enter(candlesFromScore(Number(score)||0),true);};
  document.addEventListener('keydown',function(e){if(e.shiftKey&&e.key==='A'){inAttic?leave():enter(3,false);}});
  window.addEventListener('DOMContentLoaded',function(){const scene=document.getElementById('atticScene');if(scene)scene.addEventListener('click',function(){if(inAttic)leave();});});
})();
`;
  html = html.replace('</script>', js + '\n</script>');
}

const oldEnd = "function endSession(){showOverlay(`<div class=\"result-panel pass\"><div class=\"rhead\"><span class=\"rorn\">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class=\"pass\">The Session Ends</h3></div><div class=\"rscore\"><span class=\"rsf\">${persist.totalScore||0}</span></div><span class=\"rverdict pass\">Total Score</span><div class=\"rbtns\"><button class=\"btn-gold\" onclick=\"resetSession()\">Begin Again</button></div></div>`)}function resetSession(){";
const newEnd = "function endSession(){const total=persist.totalScore||0;const candles=window.tlrScoreToCandlelight?window.tlrScoreToCandlelight(total):1;showOverlay(`<div class=\"result-panel pass\"><div class=\"rhead\"><span class=\"rorn\">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class=\"pass\">The Reading Ends</h3></div><div class=\"rscore\"><span class=\"rsf\">${total}</span></div><span class=\"rverdict pass\">Total Score</span><div class=\"rscore\" style=\"margin-top:10px\"><span class=\"rsf\" style=\"font-size:32px\">${candles}</span></div><span class=\"rverdict pass\">Candlelight</span><p style=\"margin:16px 0 0;color:#8a7551;font-size:12px;text-align:center\">Tap to close.</p></div>`);const s=document.getElementById('summary');const openedAt=Date.now();const go=function(){if(Date.now()-openedAt<250)return;s.removeEventListener('click',go);clearOverlay();if(window.tlrDebugEnterAttic)window.tlrDebugEnterAttic(candles,true);};s.addEventListener('click',go)}function resetSession(){";
if (html.includes(oldEnd)) {
  html = html.replace(oldEnd, newEnd);
} else {
  console.warn('Attic end screen hook not applied; original endSession signature was not found.');
}

fs.writeFileSync(file, html);
console.log('Applied attic end screen transition patch.');
