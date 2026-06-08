const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Attic scene shell patch */';

if (!html.includes(marker)) {
  const css = `
${marker}
#atticScene{position:fixed;inset:0;z-index:520;opacity:0;pointer-events:none;background:url('backgrounds/attic_room_mvp_1080x1920.png') center center/cover no-repeat;transition:opacity .9s ease,filter .9s ease,transform 1.15s ease;transform:scale(1.04);filter:blur(2px);overflow:hidden;color:#ead9b5;font-family:Georgia,serif}
#atticScene::before{content:'';position:absolute;inset:0;background:url('fx/transition_dark_vignette_1080x1920.png') center center/cover no-repeat;opacity:.72;z-index:1}
#atticScene::after{content:'';position:absolute;inset:0;background:url('fx/table_to_attic_fog_overlay_1080x1920.png') center center/cover no-repeat;opacity:.36;z-index:2;mix-blend-mode:screen}
body.mode-to-attic #atticScene,body.mode-attic #atticScene{opacity:1;filter:none;transform:scale(1);pointer-events:auto}
body.mode-to-table #atticScene{opacity:0;filter:blur(3px);transform:scale(1.04);pointer-events:none}
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

fs.writeFileSync(file, html);
console.log('Applied attic scene shell patch.');
