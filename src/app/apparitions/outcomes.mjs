// Code-driven Event outcome reactions (Failure / Success / Great Success).
//
// Replaces V6's sprite-sheet outcome badge with live DOM animated through the
// Web Animations API — the same treatment the node apparitions got. Each tier
// reacts the Event card itself and overlays a themed burst of light/fracture,
// scaled subtly by potency. Built on the shared core helpers.

import { el, svgEl, animate, jitter, clamp, potencyProfile } from './core.mjs';

const STYLE_ID = 'tlr-outcome-fx-style';

const TIERS = {
  failure: {
    label: 'Failure',
    accent: 'rgba(232,86,72,.95)',
    soft: 'rgba(150,40,34,.5)',
    mote: 'rgba(232,120,96,.85)',
  },
  success: {
    label: 'Success',
    accent: 'rgba(244,196,108,.96)',
    soft: 'rgba(210,150,60,.5)',
    mote: 'rgba(255,222,150,.9)',
  },
  great_success: {
    label: 'Great Success',
    accent: 'rgba(255,232,170,.98)',
    soft: 'rgba(255,196,110,.55)',
    mote: 'rgba(255,240,200,.95)',
  },
};

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .adv-outcome-fx{position:absolute;pointer-events:none;z-index:6;overflow:visible}
    .adv-outcome-fx *{position:absolute;will-change:transform,opacity,filter}
    .adv-outcome-fx .ofx-ring{border-radius:50%;opacity:0}
    .adv-outcome-fx .ofx-flash{border-radius:50%;opacity:0}
    .adv-outcome-fx .ofx-rays{border-radius:50%;opacity:0;
      -webkit-mask:radial-gradient(circle,transparent 16%,#000 30%,#000 66%,transparent 84%);
      mask:radial-gradient(circle,transparent 16%,#000 30%,#000 66%,transparent 84%)}
    .adv-outcome-fx .ofx-mote{border-radius:50%;opacity:0}
    .adv-outcome-fx .ofx-crack path{fill:none;stroke-linecap:round;stroke-linejoin:round}
  `;
  doc.head.appendChild(style);
}

function dur(reduced, ms) {
  return Math.round(reduced ? ms * 0.55 : ms);
}

function makeRing(ctx, size, color, width) {
  return ctx.el('ofx-ring', {
    left: `${ctx.cx}px`, top: `${ctx.cy}px`, width: `${size}px`, height: `${size}px`,
    marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`,
    border: `${width}px solid ${color}`, boxShadow: `0 0 12px ${color}`,
  });
}

function flashAt(ctx, x, y, size, color) {
  const f = ctx.el('ofx-flash', {
    left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`,
    marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`,
    background: `radial-gradient(circle at 50% 50%,${color},transparent 66%)`,
  });
  return f;
}

// ---------------------------------------------------------------------------

function playFailure(ctx) {
  const { card, tone, geo } = ctx;
  const anims = [];

  // The Event card recoils: shudder, darken, sink.
  anims.push(ctx.animate(card, [
    { transform: 'translate(0,0)', filter: 'brightness(1) saturate(1)' },
    { transform: 'translate(-5px,1px) rotate(-1deg)', filter: 'brightness(.7) saturate(.6)', offset: 0.15 },
    { transform: 'translate(5px,2px) rotate(1deg)', filter: 'brightness(.72) saturate(.6)', offset: 0.3 },
    { transform: 'translate(-3px,3px) rotate(-.5deg)', filter: 'brightness(.8) saturate(.7)', offset: 0.5 },
    { transform: 'translate(0,4px)', filter: 'brightness(.85) saturate(.8)', offset: 0.75 },
    { transform: 'translate(0,2px)', filter: 'brightness(.92) saturate(.9)' },
  ], { duration: ctx.dur(640), easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }));

  // A dull red flash, then a fracture is struck across the card.
  const flash = flashAt(ctx, geo.cx, geo.cy, geo.w * 0.9, tone.soft);
  ctx.add(flash);
  anims.push(ctx.animate(flash, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: .8, transform: 'scale(1)', offset: .2 }, { opacity: 0, transform: 'scale(1.1)' }],
    { duration: ctx.dur(420), easing: 'ease-out', fill: 'forwards' }));

  const crack = ctx.svg('svg', { viewBox: `0 0 ${geo.w} ${geo.h}`, class: 'ofx-crack' });
  crack.style.cssText = `left:0;top:0;width:${geo.w}px;height:${geo.h}px;opacity:0`;
  const zig = `M ${geo.w * 0.2} ${geo.h * 0.08} L ${geo.w * 0.44} ${geo.h * 0.34} L ${geo.w * 0.34} ${geo.h * 0.5} `
    + `L ${geo.w * 0.6} ${geo.h * 0.66} L ${geo.w * 0.5} ${geo.h * 0.8} L ${geo.w * 0.74} ${geo.h * 0.96}`;
  const glow = ctx.svg('path', { d: zig, stroke: tone.accent, 'stroke-width': Math.max(3, geo.w * 0.03) });
  glow.style.filter = `drop-shadow(0 0 5px ${tone.accent})`;
  const core = ctx.svg('path', { d: zig, stroke: 'rgba(255,236,228,.95)', 'stroke-width': Math.max(1.4, geo.w * 0.012) });
  crack.append(glow, core);
  ctx.add(crack);
  const len = (typeof glow.getTotalLength === 'function' && (() => { try { return glow.getTotalLength(); } catch { return geo.h * 1.4; } })()) || geo.h * 1.4;
  for (const p of [glow, core]) { p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`; }
  anims.push(ctx.animate(crack, [{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .8 }, { opacity: .55 }], { duration: ctx.dur(700), delay: ctx.dur(120), fill: 'forwards' }));
  for (const p of [glow, core]) {
    ctx.animate(p, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: ctx.dur(260), delay: ctx.dur(140), easing: 'cubic-bezier(.6,0,.8,.3)', fill: 'forwards' });
  }

  // An imploding ward and a scatter of dim embers falling.
  const ring = makeRing(ctx, geo.w * 1.25, tone.soft, 3);
  ctx.add(ring);
  anims.push(ctx.animate(ring, [{ opacity: .7, transform: 'scale(1.25)' }, { opacity: 0, transform: 'scale(.78)' }], { duration: ctx.dur(420), easing: 'ease-in', fill: 'forwards' }));
  ctx.emberFall(anims);
  return Promise.all(anims);
}

function playSuccess(ctx) {
  const { card, tone, geo } = ctx;
  const anims = [];

  // The Event card lifts and warms.
  anims.push(ctx.animate(card, [
    { transform: 'translate(0,0) scale(1)', filter: 'brightness(1)' },
    { transform: 'translate(0,-6px) scale(1.025)', filter: 'brightness(1.18)', offset: .4 },
    { transform: 'translate(0,-2px) scale(1.005)', filter: 'brightness(1.08)' },
  ], { duration: ctx.dur(620), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));

  const bloom = flashAt(ctx, geo.cx, geo.cy, geo.w * 1.3, tone.soft);
  ctx.add(bloom);
  anims.push(ctx.animate(bloom, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: .7, transform: 'scale(1)', offset: .4 }, { opacity: 0, transform: 'scale(1.15)' }],
    { duration: ctx.dur(680), easing: 'ease-out', fill: 'forwards' }));

  const ring = makeRing(ctx, geo.w * 0.55, tone.accent, Math.max(2, geo.w * 0.02));
  ctx.add(ring);
  anims.push(ctx.animate(ring, [{ opacity: .85, transform: 'scale(.7)' }, { opacity: .7, transform: 'scale(1.05)', offset: .6 }, { opacity: 0, transform: 'scale(1.5)' }],
    { duration: ctx.dur(560), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }));

  ctx.sparksRise(anims, 1);
  return Promise.all(anims);
}

function playGreatSuccess(ctx) {
  const { card, tone, geo } = ctx;
  const anims = [];

  // The Event card leaps up, flares bright, and settles.
  anims.push(ctx.animate(card, [
    { transform: 'translate(0,0) scale(1)', filter: 'brightness(1)' },
    { transform: 'translate(0,-11px) scale(1.06)', filter: 'brightness(1.5)', offset: .35 },
    { transform: 'translate(0,-5px) scale(1.02)', filter: 'brightness(1.2)', offset: .6 },
    { transform: 'translate(0,-3px) scale(1.01)', filter: 'brightness(1.1)' },
  ], { duration: ctx.dur(720), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));

  const flash = flashAt(ctx, geo.cx, geo.cy, geo.w * 1.1, 'rgba(255,248,224,.95)');
  ctx.add(flash);
  anims.push(ctx.animate(flash, [{ opacity: 0, transform: 'scale(.5)' }, { opacity: .95, transform: 'scale(1)', offset: .3 }, { opacity: 0, transform: 'scale(1.5)' }],
    { duration: ctx.dur(520), easing: 'ease-out', fill: 'forwards' }));

  // Radiant rays.
  const raySize = geo.span * 1.9;
  const rays = ctx.el('ofx-rays', {
    left: `${geo.cx}px`, top: `${geo.cy}px`, width: `${raySize}px`, height: `${raySize}px`,
    marginLeft: `${-raySize / 2}px`, marginTop: `${-raySize / 2}px`,
    background: `repeating-conic-gradient(from 0deg,${tone.accent} 0deg 4deg,transparent 4deg 15deg)`,
  });
  ctx.add(rays);
  anims.push(ctx.animate(rays, [
    { opacity: 0, transform: 'scale(.4) rotate(-12deg)' },
    { opacity: .85, transform: 'scale(1) rotate(0deg)', offset: .35 },
    { opacity: 0, transform: 'scale(1.25) rotate(10deg)' },
  ], { duration: ctx.dur(720), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }));

  // Two staggered rings.
  for (let i = 0; i < 2; i += 1) {
    const ring = makeRing(ctx, geo.w * 0.5, tone.accent, Math.max(2, geo.w * 0.022));
    ctx.add(ring);
    anims.push(ctx.animate(ring, [{ opacity: .9, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(1.7)' }],
      { duration: ctx.dur(620), delay: ctx.dur(i * 150), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }));
  }

  // A glint at the crown of the card.
  const glint = flashAt(ctx, geo.cx, geo.h * 0.06, geo.w * 0.4, 'rgba(255,255,245,.95)');
  ctx.add(glint);
  anims.push(ctx.animate(glint, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: .95, transform: 'scale(1)', offset: .5 }, { opacity: 0, transform: 'scale(.6)' }],
    { duration: ctx.dur(520), delay: ctx.dur(180), easing: 'ease-out', fill: 'forwards' }));

  ctx.sparksRise(anims, 1.8);
  return Promise.all(anims);
}

const RUNNERS = { failure: playFailure, success: playSuccess, great_success: playGreatSuccess };

/**
 * Plays a code-driven Event outcome reaction over the (cloned) Event card.
 * @param {object} opts
 * @param {Element} opts.root   FX root the overlay is appended to.
 * @param {Element} opts.card   the Event card clone to react.
 * @param {{left:number,top:number,width:number,height:number}} opts.rect
 * @param {'failure'|'success'|'great_success'} opts.tier
 * @returns {Promise<boolean>}
 */
export async function playEventOutcome(target, { root, card, rect, tier, potency, reduced } = {}) {
  const doc = target?.document;
  const tone = TIERS[tier];
  if (!doc || !root || !card || !rect || !tone) return false;
  ensureStyle(doc);

  const power = potencyProfile(potency);
  const fx = el(doc, 'adv-outcome-fx', {
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
  });
  root.appendChild(fx);

  const geo = { w: rect.width, h: rect.height, cx: rect.width / 2, cy: rect.height / 2, span: Math.min(rect.width, rect.height) };
  const ctx = {
    doc, target, card, tone, geo, power, cx: geo.cx, cy: geo.cy,
    dur: (ms) => dur(reduced, ms),
    el: (cls, styles) => el(doc, cls, styles),
    svg: (name, attrs) => svgEl(doc, name, attrs),
    animate: (node, kf, opts) => animate(target, node, kf, opts),
    add: (node) => { fx.appendChild(node); return node; },
    sparksRise: (anims, scale = 1) => {
      const count = clamp(Math.round(power.motes * scale), 4, 16);
      for (let i = 0; i < count; i += 1) {
        const size = geo.w * (0.03 + jitter(i + 2) * 0.05);
        const mote = ctx.el('ofx-mote', {
          left: `${geo.w * (0.16 + jitter(i + 1) * 0.68)}px`, top: `${geo.h * (0.5 + jitter(i + 5) * 0.4)}px`,
          width: `${size}px`, height: `${size}px`,
          background: `radial-gradient(circle,${tone.mote},transparent 62%)`,
        });
        ctx.add(mote);
        anims.push(ctx.animate(mote, [
          { opacity: 0, transform: 'translateY(0) scale(.5)' },
          { opacity: .9, transform: `translateY(${-geo.h * 0.18}px) scale(1)`, offset: .4 },
          { opacity: 0, transform: `translateY(${-geo.h * (0.5 + jitter(i) * 0.3)}px) translateX(${(jitter(i + 3) - 0.5) * geo.w * 0.3}px) scale(.4)` },
        ], { duration: ctx.dur(620 + jitter(i) * 260), delay: ctx.dur(jitter(i + 7) * 220), easing: 'ease-out', fill: 'forwards' }));
      }
    },
    emberFall: (anims) => {
      const count = clamp(Math.round(power.motes * 0.7), 3, 10);
      for (let i = 0; i < count; i += 1) {
        const size = geo.w * (0.025 + jitter(i + 2) * 0.035);
        const mote = ctx.el('ofx-mote', {
          left: `${geo.w * (0.2 + jitter(i + 1) * 0.6)}px`, top: `${geo.h * (0.3 + jitter(i + 5) * 0.3)}px`,
          width: `${size}px`, height: `${size}px`,
          background: `radial-gradient(circle,${tone.mote},transparent 62%)`,
        });
        ctx.add(mote);
        anims.push(ctx.animate(mote, [
          { opacity: 0, transform: 'translateY(0) scale(.6)' },
          { opacity: .8, transform: `translateY(${geo.h * 0.12}px) scale(1)`, offset: .4 },
          { opacity: 0, transform: `translateY(${geo.h * (0.4 + jitter(i) * 0.3)}px) translateX(${(jitter(i + 3) - 0.5) * geo.w * 0.2}px) scale(.5)` },
        ], { duration: ctx.dur(560 + jitter(i) * 220), delay: ctx.dur(180 + jitter(i + 7) * 220), easing: 'cubic-bezier(.4,.2,.6,1)', fill: 'forwards' }));
      }
    },
  };

  try {
    await (RUNNERS[tier] || playSuccess)(ctx);
    return true;
  } finally {
    fx.remove();
  }
}
