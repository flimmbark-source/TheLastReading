const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* additive pattern mult patch */';
if (html.includes(marker)) {
  console.log('Additive pattern mult patch already present, skipping.');
  process.exit(0);
}

let changed = 0;
function rep(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count > 0) {
    html = html.split(oldText).join(newText);
    console.log('  ✓', label, `(${count})`);
    changed += count;
  } else {
    console.warn('  WARN: not found —', label);
  }
}

console.log('Additive pattern mult patch:');

// Pattern multipliers are stored as displayed total mult values: 1.25, 1.5, 2, etc.
// Scoring should combine their bonus portions additively into one final multiplier:
// 1 + (rankMult-1) + (courtMult-1) + ...
rep('mult*=rankMult', 'mult+=rankMult-1', 'Rank pattern mult adds instead of compounds');
rep('mult*=courtMult', 'mult+=courtMult-1', 'Court pattern mult adds instead of compounds');
rep('mult*=seqMult', 'mult+=seqMult-1', 'Sequence pattern mult adds instead of compounds');
rep('mult*=pathMult', 'mult+=pathMult-1', 'Path pattern mult adds instead of compounds');

// Make score text match the additive model. Relics already pass mode==='add'
// with their additive amount, while pattern entries store total values like 1.25.
// Keep ghosts compact: +0.25 instead of +0.25 Mult.
rep(
  `function meldStr(m){const chips=m[1],mult=m[2],additive=m[3]==='add';if(chips&&mult)return\`+\${chips} ×\${mult}\`;if(chips)return\`+\${chips}\`;if(mult)return\`×\${mult}\`;return'';}`,
  `function meldStr(m){const chips=m[1],mult=m[2],additive=m[3]==='add';const fmt=v=>('+'+Number(v).toFixed(2)).replace(/\\.?0+$/,'');const shown=additive?mult:mult-1;if(chips&&mult)return\`+\${chips} \${fmt(shown)}\`;if(chips)return\`+\${chips}\`;if(mult)return\`\${fmt(shown)}\`;return'';}`,
  'Meld text shows compact additive mult gains'
);

rep(
  `if(m[2]>0){const multLabel='×'+m[2];setTimeout(()=>fireMultGhost(multLabel),ghostDelay+200);}`,
  `if(m[2]>0){const _mg=m[3]==='add'?m[2]:m[2]-1;const multLabel=('+'+Number(_mg).toFixed(2)).replace(/\\.?0+$/,'');setTimeout(()=>fireMultGhost(multLabel),ghostDelay+200);}`,
  'Colored mult ghost uses compact additive gain label'
);

html = html.replace('</script>', `${marker}\n</script>`);
fs.writeFileSync(file, html);
console.log(`Done — ${changed} additive mult replacements applied.`);
