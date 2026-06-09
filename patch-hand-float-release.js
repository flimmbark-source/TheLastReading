const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* hand float release patch */';
if (html.includes(marker)) {
  console.log('Hand float release patch already present, skipping.');
  process.exit(0);
}

const oldBlock = `const runLiftMomentum=v0=>{
    cancelLiftMomentum();
    const from=lift;
    const target=clampLift(lift+v0*210);
    const sway=Math.max(-7,Math.min(7,v0*80));
    const start=performance.now(),dur=420;
    const step=t=>{
      const p=Math.min(1,(t-start)/dur);
      const e=1-Math.pow(1-p,3);
      const wobble=Math.sin(p*Math.PI*2.35)*sway*(1-p);
      applyLift(clampLift(from+(target-from)*e+wobble));
      if(p<1)liftMomentumRaf=requestAnimationFrame(step);
      else{applyLift(target);liftMomentumRaf=null;}
    };
    liftMomentumRaf=requestAnimationFrame(step);
  };`;

const newBlock = `const runLiftMomentum=v0=>{
    cancelLiftMomentum();
    // Leave the hand floating where the player released it.
    // Only correct back into bounds if the player let go while rubber-banding past the allowance.
    const target=clampLift(lift);
    if(Math.abs(target-lift)<.25){applyLift(target);return;}
    const from=lift;
    const start=performance.now(),dur=180;
    const step=t=>{
      const p=Math.min(1,(t-start)/dur);
      const e=1-Math.pow(1-p,3);
      applyLift(from+(target-from)*e);
      if(p<1)liftMomentumRaf=requestAnimationFrame(step);
      else{applyLift(target);liftMomentumRaf=null;}
    };
    liftMomentumRaf=requestAnimationFrame(step);
  };`;

if (!html.includes(oldBlock)) {
  console.warn('WARN: could not find runLiftMomentum block to replace.');
} else {
  html = html.replace(oldBlock, newBlock);
  console.log('Fixed: vertical release now floats in place instead of drifting/snapping.');
}

html = html.replace('</style>', `${marker}\n</style>`);
fs.writeFileSync(file, html);
console.log('Applied hand float release patch.');
