// Code-driven "spectral blade" apparition for Aggression Adventure nodes.
//
// This replaces the baked sprite-sheet / WebP clip with live DOM elements that
// are animated through the Web Animations API. The card appears to summon a
// ghostly sword that manifests through smoke, performs a real diagonal slash
// with translucent afterimages and a red energy trail, then dissolves back into
// fog. Building it from code (instead of a pre-rendered image) lets us tune the
// life, speed, weight and clarity per node, and is the production pattern we
// intend to reuse for the other eleven apparitions.

export const AGGRESSION_APPARITION_DURATION_MS = 1450;

const STYLE_ID = 'tlr-aggression-apparition-style';
const ROOT_ID = 'tlrAggressionApparition';

// Slash geometry, in degrees from straight-up (clockwise positive). Kept fairly
// upright so the blade stays contained above the card rather than sweeping off
// the side of the screen.
const ANGLE_RAISED = -42;
const ANGLE_WINDUP = -54;
const ANGLE_FOLLOW = 56;
const ANGLE_SETTLE = 42;

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}{position:fixed;z-index:2147482800;pointer-events:none;
      mix-blend-mode:screen;will-change:opacity,transform;transform:translate(-50%,0)}
    #${ROOT_ID} *{position:absolute;will-change:transform,opacity,filter}
    #${ROOT_ID} .tlr-appar-fog{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,rgba(214,222,235,.5),rgba(150,160,185,.22) 42%,transparent 72%);
      filter:blur(9px)}
    #${ROOT_ID} .tlr-appar-swing{transform-origin:50% 100%;bottom:8%;left:50%;
      width:0;height:84%}
    #${ROOT_ID} .tlr-appar-blade{left:0;bottom:0;transform:translateX(-50%);
      transform-origin:50% 100%;
      background:linear-gradient(180deg,rgba(235,244,255,.96) 0%,rgba(186,206,236,.9) 38%,rgba(120,150,196,.82) 78%,rgba(86,112,160,.7) 100%);
      box-shadow:0 0 10px rgba(176,208,255,.6),0 0 22px rgba(120,160,230,.32);
      clip-path:polygon(50% 0%,58% 5%,62% 78%,54% 92%,50% 100%,46% 92%,38% 78%,42% 5%);
      filter:saturate(1.1)}
    #${ROOT_ID} .tlr-appar-guard{left:50%;bottom:6%;transform:translate(-50%,0);
      border-radius:2px;background:linear-gradient(90deg,rgba(120,150,196,.2),rgba(226,236,252,.92),rgba(120,150,196,.2));
      box-shadow:0 0 8px rgba(176,208,255,.5)}
    #${ROOT_ID} .tlr-appar-ghost{opacity:0;mix-blend-mode:screen;filter:blur(.6px)}
    #${ROOT_ID} .tlr-appar-trail path{fill:none;stroke-linecap:round;
      filter:drop-shadow(0 0 6px rgba(255,72,52,.8))}
    #${ROOT_ID} .tlr-appar-flash{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,rgba(255,244,228,.95),rgba(255,120,90,.5) 36%,rgba(255,60,40,.18) 60%,transparent 75%)}
    @media (prefers-reduced-motion: reduce){
      #${ROOT_ID} .tlr-appar-blade{box-shadow:none}
    }
  `;
  doc.head.appendChild(style);
}

function animate(target, el, keyframes, options) {
  if (!el?.animate) {
    return new Promise(resolve => target.setTimeout(resolve, Number(options?.duration || 0)));
  }
  return el.animate(keyframes, options).finished.catch(() => undefined);
}

function tipPoint(pivotX, pivotY, length, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: pivotX + length * Math.sin(rad),
    y: pivotY - length * Math.cos(rad),
  };
}

// Builds the elements once and returns handles plus the slash arc path string,
// so the timeline below can drive everything by transform.
function buildApparition(doc, target, boxW, boxH) {
  const root = doc.createElement('div');
  root.id = ROOT_ID;
  root.style.width = `${boxW}px`;
  root.style.height = `${boxH}px`;

  const fogBack = doc.createElement('div');
  fogBack.className = 'tlr-appar-fog';
  sizeFog(fogBack, boxW, boxH, 0.78);

  const trailSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  trailSvg.setAttribute('class', 'tlr-appar-trail');
  trailSvg.setAttribute('viewBox', `0 0 ${boxW} ${boxH}`);
  Object.assign(trailSvg.style, { left: '0', top: '0', width: `${boxW}px`, height: `${boxH}px` });
  const trailPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  const pivotX = boxW / 2;
  const pivotY = boxH * 0.92;
  const reach = boxH * 0.66;
  const start = tipPoint(pivotX, pivotY, reach, ANGLE_WINDUP);
  const end = tipPoint(pivotX, pivotY, reach, ANGLE_FOLLOW);
  trailPath.setAttribute('d', `M ${start.x} ${start.y} A ${reach} ${reach} 0 0 1 ${end.x} ${end.y}`);
  trailPath.setAttribute('stroke', 'rgba(255,80,56,.92)');
  trailPath.setAttribute('stroke-width', String(Math.max(4, boxW * 0.05)));
  trailSvg.appendChild(trailPath);

  const swing = doc.createElement('div');
  swing.className = 'tlr-appar-swing';

  const bladeW = boxW * 0.16;
  const bladeH = boxH * 0.62;
  const makeBlade = (className) => {
    const blade = doc.createElement('div');
    blade.className = className;
    blade.style.width = `${bladeW}px`;
    blade.style.height = `${bladeH}px`;
    return blade;
  };
  const ghost2 = makeBlade('tlr-appar-blade tlr-appar-ghost');
  const ghost1 = makeBlade('tlr-appar-blade tlr-appar-ghost');
  const blade = makeBlade('tlr-appar-blade');

  const guard = doc.createElement('div');
  guard.className = 'tlr-appar-guard';
  guard.style.width = `${bladeW * 1.7}px`;
  guard.style.height = `${Math.max(3, boxH * 0.018)}px`;

  swing.append(ghost2, ghost1, blade, guard);

  const flash = doc.createElement('div');
  flash.className = 'tlr-appar-flash';
  const flashSize = boxH * 0.5;
  flash.style.width = `${flashSize}px`;
  flash.style.height = `${flashSize}px`;
  const impact = tipPoint(pivotX, pivotY, reach * 0.92, ANGLE_FOLLOW);
  flash.style.left = `${impact.x - flashSize / 2}px`;
  flash.style.top = `${impact.y - flashSize / 2}px`;

  const fogFront = doc.createElement('div');
  fogFront.className = 'tlr-appar-fog';
  sizeFog(fogFront, boxW, boxH, 0.62);

  root.append(fogBack, trailSvg, swing, flash, fogFront);

  let trailLength = reach * 2;
  if (typeof trailPath.getTotalLength === 'function') {
    try { trailLength = trailPath.getTotalLength() || trailLength; } catch { /* jsdom */ }
  }
  trailPath.style.strokeDasharray = `${trailLength}`;
  trailPath.style.strokeDashoffset = `${trailLength}`;

  return { root, fogBack, fogFront, swing, blade, ghost1, ghost2, flash, trailPath, trailLength };
}

function sizeFog(el, boxW, boxH, scale) {
  const size = boxW * scale;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${(boxW - size) / 2}px`;
  el.style.top = `${boxH * 0.92 - size}px`;
}

function rot(angle, extra = '') {
  return `rotate(${angle}deg)${extra ? ` ${extra}` : ''}`;
}

// Reduced-motion path: a brief manifest, one quick slash, a quick dissolve.
async function playReduced(parts, target) {
  const { swing, blade, fogBack, fogFront, trailPath, trailLength } = parts;
  swing.style.transform = rot(ANGLE_RAISED);
  await Promise.all([
    animate(target, blade, [{ opacity: 0, filter: 'blur(5px)' }, { opacity: .9, filter: 'blur(0px)' }],
      { duration: 140, fill: 'forwards' }),
    animate(target, fogBack, [{ opacity: 0 }, { opacity: .4 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }),
  ]);
  await Promise.all([
    animate(target, swing, [{ transform: rot(ANGLE_RAISED) }, { transform: rot(ANGLE_FOLLOW) }],
      { duration: 170, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' }),
    animate(target, trailPath, [{ strokeDashoffset: trailLength, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }],
      { duration: 170, fill: 'forwards' }),
  ]);
  await Promise.all([
    animate(target, blade, [{ opacity: .9, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }],
      { duration: 170, fill: 'forwards' }),
    animate(target, trailPath, [{ opacity: 1 }, { opacity: 0 }], { duration: 170, fill: 'forwards' }),
    animate(target, fogFront, [{ opacity: 0 }, { opacity: .4 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }),
  ]);
}

async function playFull(parts, target) {
  const { swing, blade, ghost1, ghost2, fogBack, fogFront, flash, trailPath, trailLength } = parts;

  // 1. Manifest through smoke: fog blooms, blade condenses out of blur.
  swing.style.transform = rot(ANGLE_RAISED);
  await Promise.all([
    animate(target, fogBack,
      [{ opacity: 0, transform: 'scale(.55)' }, { opacity: .55, transform: 'scale(1.05)' }, { opacity: 0, transform: 'scale(1.35)' }],
      { duration: 360, easing: 'ease-out', fill: 'forwards' }),
    animate(target, blade,
      [{ opacity: 0, filter: 'blur(9px) brightness(1.5)', transform: 'translateX(-50%) translateY(14px) scaleY(.86)' },
       { opacity: .92, filter: 'blur(.4px) brightness(1.05)', transform: 'translateX(-50%) translateY(0) scaleY(1)' }],
      { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }),
  ]);

  // 2. Wind-up: the blade draws back, gathering weight.
  await animate(target, swing,
    [{ transform: rot(ANGLE_RAISED) }, { transform: rot(ANGLE_WINDUP) }],
    { duration: 180, easing: 'cubic-bezier(.3,.1,.5,1)', fill: 'forwards' });

  // 3. The slash. Blade swings fast; ghosts trail with delay; the red energy
  // trail draws along the arc; an impact flash fires near the follow-through.
  const slashMs = 230;
  const slashEase = 'cubic-bezier(.55,0,.78,.35)';
  const swingFrames = [{ transform: rot(ANGLE_WINDUP) }, { transform: rot(ANGLE_FOLLOW) }];
  swing.style.transform = rot(ANGLE_FOLLOW);
  const ghostFrames = (peak) => [
    { transform: rot(ANGLE_WINDUP), opacity: 0 },
    { transform: rot(ANGLE_WINDUP), opacity: peak, offset: 0.12 },
    { transform: rot(ANGLE_FOLLOW), opacity: peak * 0.7, offset: 0.85 },
    { transform: rot(ANGLE_FOLLOW), opacity: 0 },
  ];
  animate(target, ghost1, ghostFrames(.42),
    { duration: slashMs + 70, delay: 26, easing: slashEase, fill: 'forwards' });
  animate(target, ghost2, ghostFrames(.26),
    { duration: slashMs + 110, delay: 52, easing: slashEase, fill: 'forwards' });
  animate(target, trailPath,
    [{ strokeDashoffset: trailLength, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.8 }, { strokeDashoffset: 0, opacity: 1 }],
    { duration: slashMs, easing: slashEase, fill: 'forwards' });
  animate(target, flash,
    [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(.4)', offset: 0.62 },
     { opacity: .9, transform: 'scale(1)', offset: 0.78 }, { opacity: 0, transform: 'scale(1.3)' }],
    { duration: slashMs + 140, easing: 'ease-out', fill: 'forwards' });
  await animate(target, swing, swingFrames,
    { duration: slashMs, easing: slashEase, fill: 'forwards' });

  // 4. Settle: a slight recoil while the trail burns out.
  await Promise.all([
    animate(target, swing, [{ transform: rot(ANGLE_FOLLOW) }, { transform: rot(ANGLE_SETTLE) }],
      { duration: 160, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }),
    animate(target, trailPath, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }),
    animate(target, ghost1, [{ opacity: .2 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }),
    animate(target, ghost2, [{ opacity: .12 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }),
  ]);

  // 5. Dissolve back into fog.
  await Promise.all([
    animate(target, blade,
      [{ opacity: .9, filter: 'blur(0px)', transform: 'translateX(-50%) scaleY(1)' },
       { opacity: 0, filter: 'blur(7px)', transform: 'translateX(-50%) translateY(-6px) scaleY(1.04)' }],
      { duration: 360, easing: 'ease-in', fill: 'forwards' }),
    animate(target, fogFront,
      [{ opacity: 0, transform: 'scale(.7)' }, { opacity: .5, transform: 'scale(1.05)' }, { opacity: 0, transform: 'scale(1.5)' }],
      { duration: 440, easing: 'ease-out', fill: 'forwards' }),
  ]);
}

/**
 * Plays the spectral-blade apparition centred above an anchor rectangle.
 * Resolves when the manifest → slash → dissolve sequence has fully finished.
 * @returns {Promise<boolean>} true if it ran, false if the environment could not host it.
 */
export async function playAggressionApparition(target, anchorRect, options = {}) {
  const doc = target?.document;
  if (!doc || !anchorRect?.width || !anchorRect?.height) return false;

  ensureStyle(doc);
  doc.getElementById(ROOT_ID)?.remove();

  const boxW = Math.max(120, anchorRect.width * 2.1);
  const boxH = Math.max(150, anchorRect.height * 1.75);
  const parts = buildApparition(doc, target, boxW, boxH);

  // Centre horizontally on the card; rest the blade's pivot just above its top edge.
  parts.root.style.left = `${anchorRect.left + anchorRect.width / 2}px`;
  parts.root.style.top = `${anchorRect.top - boxH * 0.5}px`;
  doc.body.appendChild(parts.root);

  const reduced = options.reduced
    ?? target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ?? false;

  try {
    if (reduced) await playReduced(parts, target);
    else await playFull(parts, target);
    return true;
  } finally {
    parts.root.remove();
  }
}
