const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* drawer tabs and desktop drift patch */';
if (html.includes(marker)) {
  console.log('Drawer tabs/desktop drift patch already present, skipping.');
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

console.log('Drawer tabs / desktop drift patch:');

html = html.replace('</style>', `
${marker}
/* Top pull-tabs */
#scoringBtn,#abilitiesBtn,#menuBtn{position:fixed!important;top:0!important;height:31px!important;z-index:310!important;border-top:0!important;border-radius:0 0 10px 10px!important;padding:0 14px!important;font:900 10px system-ui,sans-serif!important;letter-spacing:.12em!important;text-transform:uppercase!important;box-shadow:0 7px 18px rgba(0,0,0,.5),inset 0 -1px 0 rgba(0,0,0,.28)!important;filter:none!important;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;white-space:nowrap}
#scoringBtn,#abilitiesBtn{background:linear-gradient(180deg,#e7d7ad,#b99a62)!important;color:#2a1408!important;border-color:#8a6533!important;text-shadow:0 1px 0 rgba(255,240,190,.35)!important}
#scoringBtn{left:calc(50% - 112px)!important;transform:translateX(-50%)!important}
#abilitiesBtn{left:calc(50% + 4px)!important;transform:translateX(-50%)!important}
#menuBtn{left:14px!important;width:74px!important;background:linear-gradient(180deg,#5a351c,#2d170c)!important;color:#e4c189!important;border-color:#7a5428!important;font-size:0!important}
#menuBtn::after{content:'Menu';font-size:10px!important}
#scoringBtn:active,#abilitiesBtn:active,#menuBtn:active,#scoringBtn:focus,#abilitiesBtn:focus,#menuBtn:focus{outline:none!important;filter:none!important}
#titleContent .actions{min-height:0!important;margin:0!important}
/* Parchment pull-out reference sheets */
.refs-layer{position:fixed!important;inset:0 auto auto 0!important;display:block!important;z-index:285!important;pointer-events:none!important;transform:none!important}
.refs-layer .ref{position:fixed!important;top:31px!important;left:50%!important;transform:translateX(-50%)!important;max-width:min(92vw,760px)!important;max-height:min(72vh,620px)!important;overflow:auto!important;margin:0!important;padding:28px 18px 16px!important;background:linear-gradient(165deg,#eadbb7,#c4a872 62%,#a98950)!important;color:#2a160a!important;border:1px solid #8a6533!important;border-top:0!important;border-radius:0 0 14px 14px!important;box-shadow:0 18px 48px rgba(0,0,0,.68),inset 0 1px 0 rgba(255,248,210,.3)!important;font-family:Georgia,serif!important;pointer-events:auto!important}
.refs-layer .ref.hidden{display:none!important}
.refs-layer .ref::before{position:absolute;left:50%;top:7px;transform:translateX(-50%);font:900 10px system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#5b3515;text-shadow:0 1px 0 rgba(255,240,190,.4)}
#ref::before{content:'Scoring'}
#abilityRef::before{content:'Abilities'}
.refs-layer .ref table,.refs-layer .ref td,.refs-layer .ref th{color:#2a160a!important;border-color:rgba(77,45,18,.22)!important}
.refs-layer .ref .r,.refs-layer .scoring-sheet .r,.refs-layer .scoring-sheet .score-head,.refs-layer .scoring-sheet .arcana-row td{color:#5b3515!important}
/* Brown menu pull-out sheet */
#settingsPanel{position:fixed!important;top:31px!important;left:14px!important;min-width:220px!important;background:linear-gradient(165deg,#4b2a16,#241209 70%,#160b06)!important;border:1px solid #7a5428!important;border-top:0!important;border-radius:0 0 12px 12px!important;box-shadow:0 16px 38px rgba(0,0,0,.68),inset 0 1px 0 rgba(255,210,130,.08)!important;z-index:300!important;color:#e4c189!important}
#settingsPanel.hidden{display:none!important}
#settingsPanel .settings-title{color:#f0d58a!important;border-bottom-color:rgba(228,193,137,.22)!important}
/* Restore a subtle hand cycle without fighting the swipe transform. */
@keyframes handCardIdleCycle{0%,100%{translate:0 0;rotate:0deg;filter:brightness(1)}50%{translate:0 -2px;rotate:.35deg;filter:brightness(1.035)}}
.hand:not(.hand-scroll-dragging):not(.has-selected-card) .card:not(.sel):not(.ability-picked):not(.purge-picked):not(.hand-card-dragging){animation:handCardIdleCycle 4.8s ease-in-out infinite}
.hand:not(.hand-scroll-dragging) .card:nth-child(2){animation-delay:-.8s}.hand:not(.hand-scroll-dragging) .card:nth-child(3){animation-delay:-1.6s}.hand:not(.hand-scroll-dragging) .card:nth-child(4){animation-delay:-2.4s}.hand:not(.hand-scroll-dragging) .card:nth-child(5){animation-delay:-3.2s}.hand:not(.hand-scroll-dragging) .card:nth-child(6){animation-delay:-4s}.hand:not(.hand-scroll-dragging) .card:nth-child(7){animation-delay:-4.8s}.hand:not(.hand-scroll-dragging) .card:nth-child(8){animation-delay:-5.6s}
@media(prefers-reduced-motion:reduce){.hand .card{animation:none!important}}
</style>`);
changed++;

// Reverse desktop horizontal drag/swipe direction only. Mobile touch keeps the current direction.
rep(
  `const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);`,
  `const _desktopDir=window.matchMedia('(pointer:fine)').matches?-1:1;const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE*_desktopDir);`,
  'Reverse desktop pointer drift direction'
);

// Reverse desktop horizontal wheel/trackpad drift direction.
rep(
  `applyOffset(softClamp(offset+dx*DEG_PER_SIDE_SCROLL));`,
  `applyOffset(softClamp(offset-dx*DEG_PER_SIDE_SCROLL));`,
  'Reverse desktop horizontal wheel drift direction'
);

// Keep the reference drawers mutually exclusive when using the new pull tabs.
html = html.replace('</script>', `
(function(){
  const oldRef=window.toggleRef;
  const oldAbility=window.toggleAbilityRef;
  if(typeof oldRef==='function'&&!oldRef.__drawerTabsWrapped){
    const wrapped=function(e){const a=document.getElementById('abilityRef');if(a)a.classList.add('hidden');return oldRef.apply(this,arguments);};
    wrapped.__drawerTabsWrapped=true;window.toggleRef=wrapped;
  }
  if(typeof oldAbility==='function'&&!oldAbility.__drawerTabsWrapped){
    const wrapped=function(e){const r=document.getElementById('ref');if(r)r.classList.add('hidden');return oldAbility.apply(this,arguments);};
    wrapped.__drawerTabsWrapped=true;window.toggleAbilityRef=wrapped;
  }
})();
</script>`);
changed++;

fs.writeFileSync(file, html);
console.log(`Done — ${changed} drawer tab / desktop drift changes applied.`);
