// Code-driven "spectral blade" apparition for Aggression Adventure nodes.
//
// The card appears to summon a ghostly sword that manifests through drifting
// smoke, performs a real diagonal slash with translucent afterimages and a hot
// red energy trail, then frays back into rising motes and fog. Everything is
// live DOM driven through the Web Animations API so we can tune life, speed,
// weight, clarity and colour per node — the pattern we reuse for the other
// eleven apparitions.

export const AGGRESSION_APPARITION_DURATION_MS = 1500;

const STYLE_ID = 'tlr-aggression-apparition-style';
const ROOT_ID = 'tlrAggressionApparition';
const SVG_NS = 'http://www.w3.org/2000/svg';

// Slash geometry, in degrees from straight-up (clockwise positive). Kept fairly
// upright so the blade stays contained above the card rather than sweeping off
// the side of the screen.
const ANGLE_RAISED = -42;
const ANGLE_WINDUP = -56;
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
    /* layers anchored to the summoning "hand" (pivot near the card's upper third) */
    #${ROOT_ID} .tlr-appar-layer{left:50%;bottom:8%;width:0;height:84%;
      transform:translateX(-50%);transform-origin:50% 100%}
    /* cooler spectral bloom behind the whole apparition */
    #${ROOT_ID} .tlr-appar-aura{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,rgba(150,200,255,.45),rgba(96,140,220,.18) 46%,transparent 72%);
      filter:blur(10px)}
    /* drifting smoke wisps */
    #${ROOT_ID} .tlr-appar-wisp{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,rgba(206,216,234,.42),rgba(150,162,190,.16) 44%,transparent 74%);
      filter:blur(7px)}
    /* the sword body, edge-lit with a darker central fuller */
    #${ROOT_ID} .tlr-appar-blade{bottom:16%;left:50%;transform:translateX(-50%);
      transform-origin:50% 100%;
      background:linear-gradient(90deg,
        rgba(232,247,255,.97) 0%,rgba(176,210,246,.78) 20%,
        rgba(74,110,166,.34) 50%,
        rgba(176,210,246,.78) 80%,rgba(232,247,255,.97) 100%);
      clip-path:polygon(50% 0%,60% 7%,57% 84%,50% 100%,43% 84%,40% 7%);
      box-shadow:0 0 7px rgba(170,212,255,.55)}
    /* a hot cutting-edge highlight that flares during the slash */
    #${ROOT_ID} .tlr-appar-edge{bottom:16%;left:50%;transform:translateX(-50%);
      transform-origin:50% 100%;opacity:0;
      background:linear-gradient(90deg,
        rgba(255,255,255,.95) 0%,rgba(255,236,214,.55) 26%,transparent 52%);
      clip-path:polygon(50% 0%,60% 7%,57% 84%,50% 100%,43% 84%,40% 7%)}
    #${ROOT_ID} .tlr-appar-tip{border-radius:50%;opacity:.0;
      background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.95),rgba(190,222,255,.5) 45%,transparent 72%);
      filter:blur(1px)}
    #${ROOT_ID} .tlr-appar-guard{left:50%;transform:translate(-50%,0);border-radius:3px;
      background:linear-gradient(90deg,rgba(120,150,196,.25),rgba(238,246,255,.96) 50%,rgba(120,150,196,.25));
      box-shadow:0 0 7px rgba(180,214,255,.6)}
    #${ROOT_ID} .tlr-appar-grip{left:50%;transform:translate(-50%,0);border-radius:40%;
      background:linear-gradient(180deg,rgba(206,224,250,.85),rgba(120,150,200,.6))}
    #${ROOT_ID} .tlr-appar-pommel{left:50%;transform:translate(-50%,0);border-radius:50%;
      background:radial-gradient(circle at 50% 40%,rgba(244,250,255,.95),rgba(150,180,225,.7) 60%,transparent);
      box-shadow:0 0 6px rgba(180,214,255,.6)}
    /* translucent afterimages */
    #${ROOT_ID} .tlr-appar-ghost{opacity:0;filter:blur(.8px)}
    #${ROOT_ID} .tlr-appar-ghost .tlr-appar-blade{box-shadow:none;
      background:linear-gradient(90deg,rgba(206,230,255,.7),rgba(120,160,215,.32) 50%,rgba(206,230,255,.7))}
    /* red energy trail: outer glow path + hot gold-white core path */
    #${ROOT_ID} .tlr-appar-trail{left:0;top:0}
    #${ROOT_ID} .tlr-appar-trail path{fill:none;stroke-linecap:round}
    #${ROOT_ID} .tlr-appar-trail .tlr-appar-trail-glow{
      filter:drop-shadow(0 0 7px rgba(255,70,48,.85))}
    #${ROOT_ID} .tlr-appar-trail .tlr-appar-trail-core{
      filter:drop-shadow(0 0 3px rgba(255,228,180,.9))}
    /* impact flash at the follow-through */
    #${ROOT_ID} .tlr-appar-flash{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,rgba(255,248,232,.96),rgba(255,138,96,.5) 34%,rgba(255,60,40,.16) 60%,transparent 76%)}
    /* dissolve motes */
    #${ROOT_ID} .tlr-appar-mote{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,rgba(220,238,255,.9),rgba(150,185,235,.4) 55%,transparent);
      filter:blur(.4px)}
    @media (prefers-reduced-motion: reduce){
      #${ROOT_ID} .tlr-appar-blade,#${ROOT_ID} .tlr-appar-guard,
      #${ROOT_ID} .tlr-appar-pommel{box-shadow:none}
    }
  `;
  doc.head.appendChild(style);
}

// Derives a small set of multipliers from card potency (1–5) so the apparition
// ramps subtly with the card's strength. Everything is anchored at potency 3,
// which reproduces the baseline look; the spread is deliberately gentle.
function potencyProfile(potency) {
  const level = Math.max(1, Math.min(5, Math.round(Number(potency) || 3)));
  const lf = (level - 3) / 2; // -1 .. +1, 0 at the baseline
  return {
    level,
    size: 1 + lf * 0.09,    // blade / reach scale: ~0.91 .. 1.09
    energy: 1 + lf * 0.16,  // trail + bloom intensity: ~0.84 .. 1.16
    echo: 1 + lf * 0.24,    // afterimage strength
    snap: 1 - lf * 0.10,    // slash duration multiplier (stronger = faster)
    motes: 8 + Math.round(lf * 3), // fray-out particle count: 5 .. 11
    jolt: 1 + lf * 0.35,    // card recoil amplitude
  };
}

function animate(target, el, keyframes, options) {
  if (!el?.animate) {
    return new Promise(resolve => target.setTimeout(resolve, Number(options?.duration || 0)));
  }
  return el.animate(keyframes, options).finished.catch(() => undefined);
}

function tipPoint(pivotX, pivotY, length, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: pivotX + length * Math.sin(rad), y: pivotY - length * Math.cos(rad) };
}

function rot(angle) {
  return `translateX(-50%) rotate(${angle}deg)`;
}

// Deterministic jitter so repeated runs look identical but the wisps/motes feel
// organic rather than perfectly symmetrical.
function jitter(seed) {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function el(doc, className, styles) {
  const node = doc.createElement('div');
  node.className = className;
  if (styles) Object.assign(node.style, styles);
  return node;
}

function buildBlade(doc, bladeW, layerH, { detailed }) {
  const layer = el(doc, detailed ? 'tlr-appar-sword tlr-appar-layer' : 'tlr-appar-ghost tlr-appar-layer');
  const blade = el(doc, 'tlr-appar-blade', { width: `${bladeW}px`, height: `${layerH * 0.84}px` });
  layer.appendChild(blade);
  if (!detailed) return { layer };

  const edge = el(doc, 'tlr-appar-edge', { width: `${bladeW}px`, height: `${layerH * 0.84}px` });
  const tip = el(doc, 'tlr-appar-tip', {
    width: `${bladeW * 1.5}px`, height: `${bladeW * 1.5}px`,
    left: '50%', bottom: '94%', transform: 'translate(-50%,50%)',
  });
  const guard = el(doc, 'tlr-appar-guard', {
    width: `${bladeW * 1.85}px`, height: `${Math.max(3, layerH * 0.022)}px`, bottom: '14%',
  });
  const grip = el(doc, 'tlr-appar-grip', {
    width: `${bladeW * 0.4}px`, height: `${layerH * 0.12}px`, bottom: '2.5%',
  });
  const pommel = el(doc, 'tlr-appar-pommel', {
    width: `${bladeW * 0.55}px`, height: `${bladeW * 0.55}px`, bottom: '0%',
  });
  layer.append(edge, tip, guard, grip, pommel);
  return { layer, edge };
}

function buildApparition(doc, boxW, boxH, power) {
  const root = el(doc, '', { width: `${boxW}px`, height: `${boxH}px` });
  root.id = ROOT_ID;
  root.className = '';

  const pivotX = boxW / 2;
  const pivotY = boxH * 0.92;
  const reach = boxH * 0.66 * power.size;
  const layerH = boxH * 0.84 * power.size;
  const bladeW = boxW * 0.16 * power.size;

  const aura = el(doc, 'tlr-appar-aura', sizeAround(boxW, boxH, boxW * 0.82 * power.size));
  root.appendChild(aura);

  // Smoke wisps that birth the blade, plus a couple reused on dissolve.
  const wisps = [];
  for (let i = 0; i < 5; i += 1) {
    const size = boxW * (0.34 + jitter(i + 1) * 0.26);
    const wisp = el(doc, 'tlr-appar-wisp', {
      width: `${size}px`, height: `${size}px`,
      left: `${boxW * (0.32 + jitter(i + 7) * 0.36) - size / 2}px`,
      top: `${boxH * (0.6 + jitter(i + 3) * 0.26) - size / 2}px`,
    });
    root.appendChild(wisp);
    wisps.push(wisp);
  }

  // Red energy trail (outer glow + hot core), drawn along the tip's arc.
  const trail = doc.createElementNS(SVG_NS, 'svg');
  trail.setAttribute('class', 'tlr-appar-trail');
  trail.setAttribute('viewBox', `0 0 ${boxW} ${boxH}`);
  Object.assign(trail.style, { width: `${boxW}px`, height: `${boxH}px` });
  const s = tipPoint(pivotX, pivotY, reach, ANGLE_WINDUP);
  const e = tipPoint(pivotX, pivotY, reach, ANGLE_FOLLOW);
  const d = `M ${s.x} ${s.y} A ${reach} ${reach} 0 0 1 ${e.x} ${e.y}`;
  const glow = doc.createElementNS(SVG_NS, 'path');
  glow.setAttribute('class', 'tlr-appar-trail-glow');
  glow.setAttribute('d', d);
  glow.setAttribute('stroke', 'rgba(255,72,48,.92)');
  glow.setAttribute('stroke-width', String(Math.max(5, boxW * 0.06 * power.energy)));
  const core = doc.createElementNS(SVG_NS, 'path');
  core.setAttribute('class', 'tlr-appar-trail-core');
  core.setAttribute('d', d);
  core.setAttribute('stroke', 'rgba(255,238,206,.95)');
  core.setAttribute('stroke-width', String(Math.max(2, boxW * 0.022 * power.energy)));
  trail.append(glow, core);
  root.appendChild(trail);

  // Start the trail fully retracted so it draws only during the slash, rather
  // than rendering as a solid arc the moment the SVG mounts.
  const trailLen = trailLengthOf(glow, reach);
  for (const path of [glow, core]) {
    path.style.strokeDasharray = `${trailLen}`;
    path.style.strokeDashoffset = `${trailLen}`;
  }

  const ghost2 = buildBlade(doc, bladeW, layerH, { detailed: false });
  const ghost1 = buildBlade(doc, bladeW, layerH, { detailed: false });
  const sword = buildBlade(doc, bladeW, layerH, { detailed: true });
  root.append(ghost2.layer, ghost1.layer, sword.layer);

  const flash = el(doc, 'tlr-appar-flash');
  const flashSize = boxH * 0.5;
  const impact = tipPoint(pivotX, pivotY, reach * 0.9, ANGLE_FOLLOW);
  Object.assign(flash.style, {
    width: `${flashSize}px`, height: `${flashSize}px`,
    left: `${impact.x - flashSize / 2}px`, top: `${impact.y - flashSize / 2}px`,
  });
  root.appendChild(flash);

  // Motes seeded along the blade's settled position, for the fray-out.
  const motes = [];
  const moteCount = Math.max(4, power.motes);
  for (let i = 0; i < moteCount; i += 1) {
    const t = 0.22 + (i / moteCount) * 0.78;
    const p = tipPoint(pivotX, pivotY, reach * t, ANGLE_SETTLE);
    const size = boxW * (0.025 + jitter(i + 11) * 0.04);
    const mote = el(doc, 'tlr-appar-mote', {
      width: `${size}px`, height: `${size}px`,
      left: `${p.x + (jitter(i + 5) - 0.5) * boxW * 0.12 - size / 2}px`,
      top: `${p.y + (jitter(i + 9) - 0.5) * boxH * 0.06 - size / 2}px`,
    });
    root.appendChild(mote);
    motes.push(mote);
  }

  const glowGeo = { reach };
  return {
    root, aura, wisps, trailGlow: glow, trailCore: core, flash, motes,
    sword: sword.layer, edge: sword.edge,
    ghost1: ghost1.layer, ghost2: ghost2.layer,
    trailLength: trailLen, geo: glowGeo,
  };
}

function trailLengthOf(path, reach) {
  if (typeof path.getTotalLength === 'function') {
    try { return path.getTotalLength() || reach * 2; } catch { /* jsdom */ }
  }
  return reach * 2;
}

function sizeAround(boxW, boxH, size) {
  return {
    width: `${size}px`, height: `${size}px`,
    left: `${(boxW - size) / 2}px`, top: `${boxH * 0.86 - size}px`,
  };
}

async function playFull(p, target, onImpact, power) {
  const { sword, edge, ghost1, ghost2, aura, wisps, flash, motes, trailGlow, trailCore, trailLength } = p;
  const auraPeak = Math.min(.92, .7 * power.energy);
  const flashPeak = Math.min(1, .92 * power.energy);

  // 1. Manifest through smoke. Wisps drift up and dissipate while the sword
  //    condenses out of blur into a raised guard.
  sword.style.transform = rot(ANGLE_RAISED);
  ghost1.style.transform = rot(ANGLE_RAISED);
  ghost2.style.transform = rot(ANGLE_RAISED);
  const wispIn = wisps.map((w, i) => animate(target, w, [
    { opacity: 0, transform: `translateY(${10 + jitter(i) * 10}px) scale(.6)` },
    { opacity: .5, transform: 'translateY(-4px) scale(1.05)', offset: 0.5 },
    { opacity: 0, transform: `translateY(${-18 - jitter(i + 2) * 12}px) scale(1.4)` },
  ], { duration: 420 + jitter(i) * 120, delay: i * 28, easing: 'ease-out', fill: 'forwards' }));
  await Promise.all([
    animate(target, aura, [{ opacity: 0 }, { opacity: auraPeak }], { duration: 320, fill: 'forwards' }),
    animate(target, sword,
      [{ opacity: 0, filter: 'blur(10px) brightness(1.6)' },
       { opacity: 1, filter: 'blur(.3px) brightness(1.05)' }],
      { duration: 340, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }),
    wispIn[0],
  ]);

  // 2. Wind-up — anticipation. Draws back and swells slightly, gathering weight.
  await animate(target, sword,
    [{ transform: rot(ANGLE_RAISED) }, { transform: `${rot(ANGLE_WINDUP)} scale(1.04)` }],
    { duration: 230, easing: 'cubic-bezier(.34,.05,.5,1)', fill: 'forwards' });

  // 3. The slash. Hard acceleration; afterimages trail with delay; the energy
  //    trail draws and the cutting edge flares hot; impact flash + card recoil.
  const slashMs = Math.round(210 * power.snap);
  const ease = 'cubic-bezier(.7,0,.84,.25)';
  const ghostKeys = (peak) => [
    { transform: `${rot(ANGLE_WINDUP)} scale(1.04)`, opacity: 0 },
    { transform: `${rot(ANGLE_WINDUP)} scale(1.04)`, opacity: peak, offset: 0.12 },
    { transform: rot(ANGLE_FOLLOW), opacity: peak * 0.6, offset: 0.86 },
    { transform: rot(ANGLE_FOLLOW), opacity: 0 },
  ];
  animate(target, ghost1, ghostKeys(Math.min(.6, .46 * power.echo)), { duration: slashMs + 80, delay: 24, easing: ease, fill: 'forwards' });
  animate(target, ghost2, ghostKeys(Math.min(.42, .28 * power.echo)), { duration: slashMs + 120, delay: 50, easing: ease, fill: 'forwards' });
  animate(target, trailGlow,
    [{ strokeDashoffset: trailLength, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.85 }, { strokeDashoffset: 0, opacity: 1 }],
    { duration: slashMs, easing: ease, fill: 'forwards' });
  trailGlow.style.strokeDasharray = `${trailLength}`;
  trailCore.style.strokeDasharray = `${trailLength}`;
  animate(target, trailCore,
    [{ strokeDashoffset: trailLength, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }],
    { duration: slashMs - 20, easing: ease, fill: 'forwards' });
  animate(target, edge,
    [{ opacity: 0, transform: rot(ANGLE_WINDUP) }, { opacity: .95, transform: rot(0), offset: 0.6 }, { opacity: 0, transform: rot(ANGLE_FOLLOW) }],
    { duration: slashMs, easing: ease, fill: 'forwards' });
  animate(target, flash,
    [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(.4)', offset: 0.6 },
     { opacity: flashPeak, transform: 'scale(1)', offset: 0.78 }, { opacity: 0, transform: 'scale(1.35)' }],
    { duration: slashMs + 150, easing: 'ease-out', fill: 'forwards' });
  target.setTimeout(() => { try { onImpact?.(); } catch { /* host */ } }, slashMs - 30);
  await animate(target, sword,
    [{ transform: `${rot(ANGLE_WINDUP)} scale(1.04)` }, { transform: rot(ANGLE_FOLLOW) }],
    { duration: slashMs, easing: ease, fill: 'forwards' });

  // 4. Settle — a small recoil while the trail burns out.
  await Promise.all([
    animate(target, sword, [{ transform: rot(ANGLE_FOLLOW) }, { transform: rot(ANGLE_SETTLE) }],
      { duration: 170, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }),
    animate(target, trailGlow, [{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out', fill: 'forwards' }),
    animate(target, trailCore, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }),
  ]);

  // 5. Fray out — the blade dissolves into rising motes and a last breath of fog.
  const moteOut = motes.map((m, i) => animate(target, m, [
    { opacity: 0, transform: 'translateY(0) scale(.6)' },
    { opacity: .85, transform: `translateY(${-8 - jitter(i) * 10}px) scale(1)`, offset: 0.35 },
    { opacity: 0, transform: `translateY(${-30 - jitter(i + 1) * 26}px) translateX(${(jitter(i + 4) - 0.5) * 26}px) scale(.5)` },
  ], { duration: 460 + jitter(i) * 160, delay: jitter(i + 6) * 120, easing: 'ease-out', fill: 'forwards' }));
  const fogOut = wisps.slice(0, 3).map((w, i) => animate(target, w, [
    { opacity: 0, transform: 'scale(.7)' }, { opacity: .42, transform: 'scale(1.1)', offset: 0.45 }, { opacity: 0, transform: 'scale(1.6)' },
  ], { duration: 480, delay: i * 36, easing: 'ease-out', fill: 'forwards' }));
  await Promise.all([
    animate(target, sword,
      [{ opacity: 1, filter: 'blur(0px)', transform: `${rot(ANGLE_SETTLE)} scale(1)` },
       { opacity: 0, filter: 'blur(8px)', transform: `${rot(ANGLE_SETTLE)} scale(1.05)` }],
      { duration: 380, easing: 'ease-in', fill: 'forwards' }),
    animate(target, aura, [{ opacity: auraPeak }, { opacity: 0 }], { duration: 360, fill: 'forwards' }),
    ...moteOut, ...fogOut,
  ]);
}

async function playReduced(p, target, onImpact) {
  const { sword, aura, wisps, trailGlow, trailLength } = p;
  sword.style.transform = rot(ANGLE_RAISED);
  await Promise.all([
    animate(target, sword, [{ opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 150, fill: 'forwards' }),
    animate(target, aura, [{ opacity: 0 }, { opacity: .5 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }),
    animate(target, wisps[0], [{ opacity: 0 }, { opacity: .4 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }),
  ]);
  trailGlow.style.strokeDasharray = `${trailLength}`;
  target.setTimeout(() => { try { onImpact?.(); } catch { /* host */ } }, 150);
  await Promise.all([
    animate(target, sword, [{ transform: rot(ANGLE_RAISED) }, { transform: rot(ANGLE_FOLLOW) }],
      { duration: 170, easing: 'cubic-bezier(.6,0,.8,.35)', fill: 'forwards' }),
    animate(target, trailGlow, [{ strokeDashoffset: trailLength, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }],
      { duration: 170, fill: 'forwards' }),
  ]);
  await Promise.all([
    animate(target, sword, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 180, fill: 'forwards' }),
    animate(target, trailGlow, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }),
  ]);
}

/**
 * Plays the spectral-blade apparition centred above an anchor rectangle.
 * Resolves once manifest → slash → dissolve has fully finished.
 * @param {object} [options]
 * @param {boolean} [options.reduced] force the reduced-motion variant.
 * @param {number} [options.potency] card potency 1–5; subtly ramps the apparition's scale and energy (3 = baseline).
 * @param {() => void} [options.onImpact] fired at the slash impact (e.g. to jolt the card).
 * @returns {Promise<boolean>} true if it ran, false if the environment could not host it.
 */
export async function playAggressionApparition(target, anchorRect, options = {}) {
  const doc = target?.document;
  if (!doc || !anchorRect?.width || !anchorRect?.height) return false;

  ensureStyle(doc);
  doc.getElementById(ROOT_ID)?.remove();

  const power = potencyProfile(options.potency);
  const boxW = Math.max(120, anchorRect.width * 2.1);
  const boxH = Math.max(150, anchorRect.height * 1.75);
  const parts = buildApparition(doc, boxW, boxH, power);

  parts.root.style.left = `${anchorRect.left + anchorRect.width / 2}px`;
  parts.root.style.top = `${anchorRect.top - boxH * 0.5}px`;
  doc.body.appendChild(parts.root);

  const reduced = options.reduced
    ?? target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ?? false;

  try {
    if (reduced) await playReduced(parts, target, options.onImpact);
    else await playFull(parts, target, options.onImpact, power);
    return true;
  } finally {
    parts.root.remove();
  }
}
