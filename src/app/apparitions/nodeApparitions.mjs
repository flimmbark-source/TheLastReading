// Characteristic apparitions for the non-Aggression action nodes, built on the
// shared core framework. Each spec defines a hero prop and one distinctive
// action; the core handles smoke, bloom, motes, potency scaling, reduced motion
// and the result-panel timing. Props are luminous (the root uses screen blend),
// so colours are light and tinted by each node's tone.

import { ACTION_NODES } from '../../data/adventure/nodes.mjs';
import { runApparition } from './core.mjs';

function accentGlow(ctx, px = 7) {
  return `drop-shadow(0 0 ${px}px ${ctx.tone.accent || 'rgba(200,220,255,.8)'})`;
}

// Expanding ward/shock ring centred on (x,y).
function shockRing(ctx, x, y, fromPx, toPx, color, dur, width = 2) {
  const ring = ctx.el('', {
    left: `${x}px`, top: `${y}px`, width: `${fromPx}px`, height: `${fromPx}px`,
    marginLeft: `${-fromPx / 2}px`, marginTop: `${-fromPx / 2}px`,
    borderRadius: '50%', border: `${width}px solid ${color}`, opacity: '0',
    boxShadow: `0 0 12px ${color}`,
  });
  ctx.add(ring);
  return ctx.animate(ring, [
    { opacity: 0.85, transform: 'scale(1)' },
    { opacity: 0, transform: `scale(${toPx / fromPx})` },
  ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
}

// Soft radial flash at (x,y).
function flash(ctx, x, y, size, color, dur) {
  const f = ctx.el('', {
    left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`,
    marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`, borderRadius: '50%',
    opacity: '0', background: `radial-gradient(circle at 50% 50%,${color},transparent 68%)`,
  });
  ctx.add(f);
  return ctx.animate(f, [
    { opacity: 0, transform: 'scale(.5)' },
    { opacity: 0.95, transform: 'scale(1)', offset: 0.4 },
    { opacity: 0, transform: 'scale(1.4)' },
  ], { duration: dur, easing: 'ease-out', fill: 'forwards' });
}

// ---------------------------------------------------------------------------
// PHYSICAL — a spectral hammer raises and slams down onto the Event.
// ---------------------------------------------------------------------------
const PHYSICAL = {
  tone: { aura: 'rgba(255,140,90,.42)', auraSoft: 'rgba(200,90,50,.16)', mote: 'rgba(255,205,165,.9)', accent: 'rgba(255,170,120,.95)' },
  build(ctx) {
    const { geo } = ctx;
    const h = geo.cardH * 0.82;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cardTop - geo.cardH * 0.66}px`,
      width: '0', height: `${h}px`, transform: 'translateX(-50%) rotate(-58deg)',
      transformOrigin: '50% 0%', opacity: '0', filter: accentGlow(ctx, 9),
    });
    const handle = ctx.el('', {
      left: '50%', top: '0', width: `${geo.cardW * 0.055}px`, height: `${h * 0.66}px`,
      transform: 'translateX(-50%)', borderRadius: '6px',
      background: 'linear-gradient(180deg,rgba(245,222,196,.85),rgba(150,120,96,.6))',
    });
    const head = ctx.el('', {
      left: '50%', top: `${h * 0.6}px`, width: `${geo.cardW * 0.46}px`, height: `${geo.cardW * 0.27}px`,
      transform: 'translateX(-50%)', borderRadius: '7px',
      background: 'linear-gradient(180deg,rgba(255,238,214,.95),rgba(214,150,110,.8))',
      boxShadow: '0 0 10px rgba(255,180,120,.5)',
    });
    prop.append(handle, head);
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo, power } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [
      { opacity: 0, filter: 'blur(9px)', transform: 'translateX(-50%) rotate(-58deg)' },
      { opacity: 1, filter: `blur(.3px) ${accentGlow(ctx, 9)}`, transform: 'translateX(-50%) rotate(-58deg)' },
    ], { duration: ctx.dur(300), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    await ctx.animate(p, [{ transform: 'translateX(-50%) rotate(-58deg)' }, { transform: 'translateX(-50%) rotate(-72deg)' }],
      { duration: ctx.dur(190), easing: 'cubic-bezier(.34,.05,.5,1)', fill: 'forwards' });
    const slash = ctx.dur(170 * power.snap);
    ctx.target.setTimeout(() => {
      ctx.impact();
      flash(ctx, geo.cx, geo.cardTop + geo.cardH * 0.12, geo.cardW * 0.7, ctx.tone.accent, ctx.dur(260));
      shockRing(ctx, geo.cx, geo.cardTop + geo.cardH * 0.14, geo.cardW * 0.3, geo.cardW * 1.2, ctx.tone.accent, ctx.dur(360), 3);
    }, slash - ctx.dur(30));
    await ctx.animate(p, [{ transform: 'translateX(-50%) rotate(-72deg)' }, { transform: 'translateX(-50%) rotate(6deg)' }],
      { duration: slash, easing: 'cubic-bezier(.7,0,.84,.25)', fill: 'forwards' });
    await ctx.animate(p, [{ transform: 'translateX(-50%) rotate(6deg)' }, { transform: 'translateX(-50%) rotate(0deg)' }],
      { duration: ctx.dur(160), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  },
};

// ---------------------------------------------------------------------------
// PROTECTION — a shield rises from below, braces upright and wards with a pulse.
// ---------------------------------------------------------------------------
const PROTECTION = {
  tone: { aura: 'rgba(120,190,255,.42)', auraSoft: 'rgba(70,120,210,.16)', mote: 'rgba(205,232,255,.9)', accent: 'rgba(150,210,255,.96)' },
  build(ctx) {
    const { geo } = ctx;
    const w = geo.cardW * 0.72;
    const h = geo.cardH * 0.74;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cy}px`, width: `${w}px`, height: `${h}px`,
      transform: `translate(-50%,-50%) translateY(${geo.cardH * 0.6}px)`, opacity: '0',
      filter: accentGlow(ctx, 9),
    });
    const face = ctx.el('', {
      inset: '0', clipPath: 'polygon(50% 0,100% 16%,100% 60%,50% 100%,0 60%,0 16%)',
      background: 'linear-gradient(160deg,rgba(225,242,255,.92),rgba(120,170,225,.7) 60%,rgba(80,120,190,.62))',
      boxShadow: 'inset 0 0 14px rgba(180,220,255,.5)',
    });
    const boss = ctx.el('', {
      left: '50%', top: '46%', width: `${w * 0.22}px`, height: `${w * 0.22}px`,
      transform: 'translate(-50%,-50%)', borderRadius: '50%',
      background: 'radial-gradient(circle at 50% 40%,rgba(255,255,255,.95),rgba(150,200,255,.6) 60%,transparent)',
    });
    prop.append(face, boss);
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [
      { opacity: 0, filter: 'blur(7px)', transform: `translate(-50%,-50%) translateY(${geo.cardH * 0.6}px) scale(.9)` },
      { opacity: 1, transform: 'translate(-50%,-50%) translateY(-6px) scale(1.02)', offset: 0.8 },
      { opacity: 1, transform: 'translate(-50%,-50%) translateY(0) scale(1)' },
    ], { duration: ctx.dur(440), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    ctx.impact();
    await Promise.all([
      ctx.animate(p, [
        { transform: 'translate(-50%,-50%) scale(1)', filter: accentGlow(ctx, 9) },
        { transform: 'translate(-50%,-50%) scale(1.06)', filter: accentGlow(ctx, 18), offset: 0.4 },
        { transform: 'translate(-50%,-50%) scale(1)', filter: accentGlow(ctx, 9) },
      ], { duration: ctx.dur(360), easing: 'ease-out', fill: 'forwards' }),
      shockRing(ctx, geo.cx, geo.cy, geo.cardW * 0.5, geo.cardW * 1.5, ctx.tone.accent, ctx.dur(420), 3),
    ]);
    await ctx.wait(ctx.dur(120));
  },
};

// ---------------------------------------------------------------------------
// ENDURANCE — a standing stone rises and plants itself, immovable.
// ---------------------------------------------------------------------------
const ENDURANCE = {
  tone: { aura: 'rgba(205,185,150,.4)', auraSoft: 'rgba(120,100,78,.16)', mote: 'rgba(228,212,184,.9)', accent: 'rgba(222,202,168,.92)' },
  build(ctx) {
    const { geo } = ctx;
    const w = geo.cardW * 0.5;
    const h = geo.cardH * 0.86;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cardBottom}px`, width: `${w}px`, height: `${h}px`,
      transform: `translate(-50%,-100%) translateY(${geo.cardH * 0.7}px)`, opacity: '0',
      filter: accentGlow(ctx, 7),
    });
    const stone = ctx.el('', {
      inset: '0', clipPath: 'polygon(34% 0,66% 3%,82% 22%,78% 78%,88% 100%,12% 100%,22% 76%,18% 24%)',
      background: 'linear-gradient(150deg,rgba(238,228,206,.9),rgba(150,134,108,.72) 55%,rgba(110,96,76,.7))',
      boxShadow: 'inset 0 0 16px rgba(90,76,58,.5)',
    });
    const seam = ctx.el('', {
      left: '54%', top: '12%', width: '2px', height: '64%', transform: 'rotate(6deg)',
      background: 'linear-gradient(180deg,transparent,rgba(80,66,50,.5),transparent)',
    });
    prop.append(stone, seam);
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [
      { opacity: 0, filter: 'blur(6px)', transform: `translate(-50%,-100%) translateY(${geo.cardH * 0.7}px) scaleY(.92)` },
      { opacity: 1, transform: 'translate(-50%,-100%) translateY(-4px) scaleY(1.02)', offset: 0.82 },
      { opacity: 1, transform: 'translate(-50%,-100%) translateY(0) scaleY(1)' },
    ], { duration: ctx.dur(480), easing: 'cubic-bezier(.25,.9,.3,1)', fill: 'forwards' });
    ctx.impact();
    // Dust settle at the base + a firm micro-tremor.
    flash(ctx, geo.cx, geo.cardBottom - geo.cardH * 0.04, geo.cardW * 0.9, 'rgba(220,205,175,.6)', ctx.dur(360));
    await ctx.animate(p, [
      { transform: 'translate(-50%,-100%) translateX(0)' },
      { transform: 'translate(-50%,-100%) translateX(-2px)', offset: 0.3 },
      { transform: 'translate(-50%,-100%) translateX(1px)', offset: 0.6 },
      { transform: 'translate(-50%,-100%) translateX(0)' },
    ], { duration: ctx.dur(260), easing: 'ease-out', fill: 'forwards' });
    await ctx.wait(ctx.dur(120));
  },
};

// ---------------------------------------------------------------------------
// COMPASSION — a chalice tips and pours luminous light over the Event.
// ---------------------------------------------------------------------------
const COMPASSION = {
  tone: { aura: 'rgba(255,180,200,.4)', auraSoft: 'rgba(210,120,150,.16)', mote: 'rgba(255,226,236,.9)', accent: 'rgba(255,206,172,.95)' },
  build(ctx) {
    const { geo } = ctx;
    const w = geo.cardW * 0.42;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cardTop + geo.cardH * 0.06}px`, width: `${w}px`, height: `${geo.cardH * 0.5}px`,
      transform: 'translate(-50%,0)', opacity: '0', transformOrigin: '50% 92%', filter: accentGlow(ctx, 8),
    });
    const cup = ctx.el('', {
      left: '50%', top: '0', width: `${w}px`, height: `${w * 0.58}px`, transform: 'translateX(-50%)',
      clipPath: 'polygon(2% 0,98% 0,82% 86%,18% 86%)',
      background: 'linear-gradient(180deg,rgba(255,244,232,.95),rgba(255,196,150,.7))',
      boxShadow: 'inset 0 0 10px rgba(255,210,170,.6)',
    });
    const stem = ctx.el('', {
      left: '50%', top: `${w * 0.56}px`, width: `${w * 0.1}px`, height: `${w * 0.3}px`, transform: 'translateX(-50%)',
      background: 'rgba(255,224,196,.8)',
    });
    const foot = ctx.el('', {
      left: '50%', top: `${w * 0.84}px`, width: `${w * 0.5}px`, height: `${w * 0.1}px`, transform: 'translateX(-50%)',
      borderRadius: '40%', background: 'rgba(255,224,196,.85)',
    });
    prop.append(cup, stem, foot);
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [{ opacity: 0, filter: 'blur(7px)', transform: 'translate(-50%,0) scale(.92)' },
      { opacity: 1, filter: accentGlow(ctx, 8), transform: 'translate(-50%,0) scale(1)' }],
      { duration: ctx.dur(320), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    await ctx.animate(p, [{ transform: 'translate(-50%,0) rotate(0deg)' }, { transform: 'translate(-50%,0) rotate(-30deg)' }],
      { duration: ctx.dur(260), easing: 'cubic-bezier(.3,.1,.4,1)', fill: 'forwards' });
    ctx.impact();
    // A cascade of light droplets falls onto the card.
    const drops = [];
    for (let i = 0; i < 7; i += 1) {
      const size = geo.cardW * (0.04 + (i % 3) * 0.012);
      const dx = geo.cx - geo.cardW * 0.16 + (i / 7) * geo.cardW * 0.1;
      const drop = ctx.el('appar-mote', {
        left: `${dx}px`, top: `${geo.cardTop + geo.cardH * 0.28}px`, width: `${size}px`, height: `${size}px`,
      });
      ctx.add(drop);
      drops.push(ctx.animate(drop, [
        { opacity: 0, transform: 'translateY(0) scale(.6)' },
        { opacity: 1, transform: `translateY(${geo.cardH * 0.18}px) scale(1)`, offset: 0.5 },
        { opacity: 0, transform: `translateY(${geo.cardH * 0.42}px) scale(.5)` },
      ], { duration: ctx.dur(520), delay: ctx.dur(i * 46), easing: 'cubic-bezier(.4,.2,.6,1)', fill: 'forwards' }));
    }
    flash(ctx, geo.cx, geo.cy + geo.cardH * 0.1, geo.cardW * 0.8, 'rgba(255,220,190,.55)', ctx.dur(520));
    await Promise.all(drops);
    await ctx.animate(p, [{ transform: 'translate(-50%,0) rotate(-30deg)' }, { transform: 'translate(-50%,0) rotate(0deg)' }],
      { duration: ctx.dur(200), easing: 'ease-out', fill: 'forwards' });
  },
};

// ---------------------------------------------------------------------------
// AUTHORITY — a glowing seal forms, presses down and imprints a sigil.
// ---------------------------------------------------------------------------
const AUTHORITY = {
  tone: { aura: 'rgba(190,150,255,.42)', auraSoft: 'rgba(120,90,200,.16)', mote: 'rgba(228,208,255,.9)', accent: 'rgba(255,226,150,.95)' },
  build(ctx) {
    const { geo } = ctx;
    const d = Math.min(geo.cardW, geo.cardH) * 0.6;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cy}px`, width: `${d}px`, height: `${d}px`,
      transform: 'translate(-50%,-50%) translateY(-18px) scale(1.4)', opacity: '0', filter: accentGlow(ctx, 9),
    });
    const ring = ctx.el('', {
      inset: '0', borderRadius: '50%', border: `${d * 0.06}px solid rgba(255,232,170,.9)`,
      boxShadow: 'inset 0 0 12px rgba(200,160,255,.5),0 0 12px rgba(255,220,150,.5)',
    });
    const star = ctx.svg('svg', { viewBox: '0 0 100 100', class: '' });
    star.style.cssText = 'inset:0;width:100%;height:100%';
    const sig = ctx.svg('path', {
      d: 'M50 14 L61 40 L88 40 L66 58 L74 86 L50 70 L26 86 L34 58 L12 40 L39 40 Z',
      fill: 'none', stroke: 'rgba(255,236,186,.95)', 'stroke-width': '4', 'stroke-linejoin': 'round',
    });
    star.appendChild(sig);
    prop.append(ring, star);
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [
      { opacity: 0, filter: 'blur(8px)', transform: 'translate(-50%,-50%) translateY(-18px) scale(1.4)' },
      { opacity: 1, filter: accentGlow(ctx, 9), transform: 'translate(-50%,-50%) translateY(0) scale(1.06)' },
    ], { duration: ctx.dur(360), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    ctx.impact();
    await ctx.animate(p, [
      { transform: 'translate(-50%,-50%) scale(1.06)', filter: accentGlow(ctx, 9) },
      { transform: 'translate(-50%,-50%) scale(.86)', filter: `${accentGlow(ctx, 22)} brightness(1.5)`, offset: 0.4 },
      { transform: 'translate(-50%,-50%) scale(1)', filter: accentGlow(ctx, 9) },
    ], { duration: ctx.dur(300 * ctx.power.snap), easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' });
    flash(ctx, geo.cx, geo.cy, geo.cardW * 0.7, ctx.tone.accent, ctx.dur(300));
    await shockRing(ctx, geo.cx, geo.cy, geo.cardW * 0.5, geo.cardW * 1.4, ctx.tone.accent, ctx.dur(380), 3);
  },
};

// ---------------------------------------------------------------------------
// MYSTERY — a moon rises and waxes to full with a haloed pulse.
// ---------------------------------------------------------------------------
const MYSTERY = {
  tone: { aura: 'rgba(150,160,255,.42)', auraSoft: 'rgba(90,100,200,.16)', mote: 'rgba(216,221,255,.9)', accent: 'rgba(202,212,255,.95)' },
  build(ctx) {
    const { geo } = ctx;
    const d = Math.min(geo.cardW, geo.cardH) * 0.52;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cy - geo.cardH * 0.06}px`, width: `${d}px`, height: `${d}px`,
      transform: `translate(-50%,-50%) translateY(${geo.cardH * 0.3}px) scale(.7)`, opacity: '0',
    });
    const moon = ctx.el('', {
      inset: '0', borderRadius: '50%',
      background: 'radial-gradient(circle at 42% 38%,rgba(255,255,255,.97),rgba(206,216,255,.8) 55%,rgba(150,166,235,.6) 80%)',
      boxShadow: '0 0 18px rgba(190,205,255,.6)',
    });
    prop.appendChild(moon);
    for (let i = 0; i < 2; i += 1) {
      const s = d * 0.12;
      const star = ctx.el('', {
        left: '50%', top: '50%', width: `${s}px`, height: `${s}px`, borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(255,255,255,.95),transparent 60%)',
        transform: `rotate(${i * 180}deg) translateX(${d * 0.8}px)`, transformOrigin: '0 0',
      });
      prop.appendChild(star);
      ctx.parts[`star${i}`] = star;
    }
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [
      { opacity: 0, transform: `translate(-50%,-50%) translateY(${geo.cardH * 0.3}px) scale(.7)`, filter: 'blur(6px) brightness(.8)' },
      { opacity: 1, transform: 'translate(-50%,-50%) translateY(0) scale(1)', filter: 'blur(0) brightness(1.18)' },
    ], { duration: ctx.dur(520), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    ctx.impact();
    await Promise.all([
      ctx.animate(p, [
        { filter: 'brightness(1.18)', transform: 'translate(-50%,-50%) scale(1)' },
        { filter: 'brightness(1.55)', transform: 'translate(-50%,-50%) scale(1.05)', offset: 0.4 },
        { filter: 'brightness(1.18)', transform: 'translate(-50%,-50%) scale(1)' },
      ], { duration: ctx.dur(420), easing: 'ease-out', fill: 'forwards' }),
      shockRing(ctx, geo.cx, geo.cy - geo.cardH * 0.06, geo.cardW * 0.55, geo.cardW * 1.3, ctx.tone.accent, ctx.dur(460), 2),
    ]);
  },
};

// ---------------------------------------------------------------------------
// DECEPTION — a mask materialises, then splits apart revealing nothing.
// ---------------------------------------------------------------------------
const DECEPTION = {
  tone: { aura: 'rgba(170,140,230,.4)', auraSoft: 'rgba(110,160,130,.16)', mote: 'rgba(212,226,216,.9)', accent: 'rgba(190,255,210,.9)' },
  build(ctx) {
    const { geo } = ctx;
    const w = geo.cardW * 0.5;
    const h = geo.cardH * 0.56;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cy}px`, width: `${w}px`, height: `${h}px`,
      transform: 'translate(-50%,-50%)', opacity: '0',
    });
    // Each half is a full-size overlay clipped to one side of a theatrical mask
    // silhouette (rounded brow, tapering to a chin), so together they read as a
    // single mask before the split.
    const half = (side) => ctx.el('', {
      inset: '0',
      clipPath: side === 'left'
        ? 'polygon(50% 3%,30% 5%,12% 26%,9% 52%,24% 82%,50% 100%)'
        : 'polygon(50% 3%,70% 5%,88% 26%,91% 52%,76% 82%,50% 100%)',
      background: side === 'left'
        ? 'linear-gradient(120deg,rgba(228,238,232,.78),rgba(150,205,175,.5))'
        : 'linear-gradient(240deg,rgba(228,238,232,.78),rgba(150,205,175,.5))',
      filter: accentGlow(ctx, 6),
    });
    const left = half('left');
    const right = half('right');
    // A faint brow ridge to suggest a face.
    const brow = ctx.el('', {
      left: '24%', top: '34%', width: '52%', height: '5%', borderRadius: '50%',
      background: 'rgba(245,255,250,.5)', filter: 'blur(1px)',
    });
    ctx.parts.left = left;
    ctx.parts.right = right;
    prop.append(left, right, brow);
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [{ opacity: 0, filter: 'blur(7px)', transform: 'translate(-50%,-50%) scale(.95)' },
      { opacity: 1, filter: 'blur(0)', transform: 'translate(-50%,-50%) scale(1)' }],
      { duration: ctx.dur(360), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    await ctx.wait(ctx.dur(120));
    ctx.impact();
    flash(ctx, geo.cx, geo.cy, geo.cardW * 0.4, ctx.tone.accent, ctx.dur(320));
    await Promise.all([
      ctx.animate(ctx.parts.left, [{ transform: 'translateX(0) rotate(0)' }, { transform: `translateX(${-geo.cardW * 0.2}px) rotate(-12deg)` }],
        { duration: ctx.dur(300 * ctx.power.snap), easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }),
      ctx.animate(ctx.parts.right, [{ transform: 'translateX(0) rotate(0)' }, { transform: `translateX(${geo.cardW * 0.2}px) rotate(12deg)` }],
        { duration: ctx.dur(300 * ctx.power.snap), easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }),
    ]);
  },
  exit(ctx) {
    return Promise.all([
      ctx.animate(ctx.parts.left, [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(7px)' }], { duration: ctx.dur(320), fill: 'forwards' }),
      ctx.animate(ctx.parts.right, [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(7px)' }], { duration: ctx.dur(320), fill: 'forwards' }),
    ]);
  },
};

// ---------------------------------------------------------------------------
// INVESTIGATION — a lantern descends and sweeps a beam of light across the card.
// ---------------------------------------------------------------------------
const INVESTIGATION = {
  tone: { aura: 'rgba(255,210,120,.42)', auraSoft: 'rgba(200,150,60,.16)', mote: 'rgba(255,236,182,.95)', accent: 'rgba(255,226,140,.97)' },
  build(ctx) {
    const { geo } = ctx;
    const beamH = geo.cardH * 0.78;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cardTop - geo.cardH * 0.12}px`, width: '0', height: `${beamH}px`,
      transform: 'translateX(-50%)', opacity: '0', transformOrigin: '50% 8%',
    });
    const beam = ctx.el('', {
      left: '50%', top: '6%', width: `${geo.cardW * 0.7}px`, height: '94%', transform: 'translateX(-50%)',
      clipPath: 'polygon(42% 0,58% 0,100% 100%,0 100%)',
      background: 'linear-gradient(180deg,rgba(255,236,180,.5),rgba(255,214,120,.12) 70%,transparent)',
      filter: 'blur(1px)',
    });
    const body = ctx.el('', {
      left: '50%', top: '0', width: `${geo.cardW * 0.16}px`, height: `${geo.cardW * 0.2}px`, transform: 'translate(-50%,-50%)',
      borderRadius: '4px', background: 'radial-gradient(circle at 50% 40%,rgba(255,250,225,.97),rgba(255,200,110,.7) 60%,rgba(190,140,70,.6))',
      boxShadow: '0 0 14px rgba(255,210,130,.7)',
    });
    prop.append(beam, body);
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [
      { opacity: 0, transform: 'translateX(-50%) translateY(-14px) rotate(0deg)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'translateX(-50%) translateY(0) rotate(-26deg)', filter: 'blur(0)' },
    ], { duration: ctx.dur(360), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    ctx.target.setTimeout(() => {
      ctx.impact();
      flash(ctx, geo.cx, geo.cy + geo.cardH * 0.06, geo.cardW * 0.5, 'rgba(255,232,170,.5)', ctx.dur(360));
    }, ctx.dur(300));
    await ctx.animate(p, [
      { transform: 'translateX(-50%) rotate(-26deg)' },
      { transform: 'translateX(-50%) rotate(28deg)' },
    ], { duration: ctx.dur(620), easing: 'cubic-bezier(.4,.1,.4,.9)', fill: 'forwards' });
    await ctx.wait(ctx.dur(80));
  },
  exit(ctx) {
    return ctx.animate(ctx.parts.prop, [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(6px)' }],
      { duration: ctx.dur(340), fill: 'forwards' });
  },
};

// ---------------------------------------------------------------------------
// TRANSFORMATION — a moth emerges from a glow and flutters upward.
// ---------------------------------------------------------------------------
const TRANSFORMATION = {
  tone: { aura: 'rgba(130,230,220,.4)', auraSoft: 'rgba(120,110,210,.16)', mote: 'rgba(212,255,246,.9)', accent: 'rgba(180,245,230,.95)' },
  build(ctx) {
    const { geo } = ctx;
    const w = geo.cardW * 0.62;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cy + geo.cardH * 0.1}px`, width: `${w}px`, height: `${w * 0.7}px`,
      transform: 'translate(-50%,-50%) scale(.2)', opacity: '0', filter: accentGlow(ctx, 8),
    });
    const body = ctx.el('', {
      left: '50%', top: '50%', width: `${w * 0.1}px`, height: `${w * 0.5}px`, transform: 'translate(-50%,-50%)',
      borderRadius: '40%', background: 'linear-gradient(180deg,rgba(235,255,250,.9),rgba(150,190,210,.7))',
    });
    const wing = (side) => ctx.el('', {
      top: '50%', [side]: '50%', width: `${w * 0.46}px`, height: `${w * 0.62}px`,
      transform: `translateY(-50%) ${side === 'left' ? '' : 'scaleX(-1)'}`,
      transformOrigin: side === 'left' ? '100% 50%' : '0% 50%',
      clipPath: 'polygon(100% 50%,30% 0,0 32%,12% 70%,46% 100%)',
      background: 'radial-gradient(circle at 80% 50%,rgba(220,255,248,.92),rgba(150,210,235,.6) 60%,rgba(150,160,230,.5))',
    });
    const left = wing('left');
    const right = wing('right');
    ctx.parts.left = left;
    ctx.parts.right = right;
    prop.append(left, right, body);
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    await ctx.animate(p, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.2)', filter: 'blur(6px) brightness(1.5)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.05)', filter: `blur(0) ${accentGlow(ctx, 10)}`, offset: 0.7 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', filter: accentGlow(ctx, 8) },
    ], { duration: ctx.dur(380), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    ctx.impact();
    const flap = (wing) => ctx.animate(wing, [
      { transform: 'translateY(-50%) scaleX(1)' },
      { transform: 'translateY(-50%) scaleX(.3)' },
      { transform: 'translateY(-50%) scaleX(1)' },
    ], { duration: ctx.dur(220), iterations: 4, easing: 'ease-in-out' });
    flap(ctx.parts.left);
    // The right wing is mirrored (scaleX(-1)); flap it between -1 and -0.3.
    ctx.animate(ctx.parts.right, [
      { transform: 'translateY(-50%) scaleX(-1)' },
      { transform: 'translateY(-50%) scaleX(-.3)' },
      { transform: 'translateY(-50%) scaleX(-1)' },
    ], { duration: ctx.dur(220), iterations: 4, easing: 'ease-in-out' });
    await ctx.animate(p, [
      { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg)' },
      { transform: `translate(-50%,-50%) translate(${geo.cardW * 0.1}px,${-geo.cardH * 0.16}px) rotate(8deg)`, offset: 0.5 },
      { transform: `translate(-50%,-50%) translate(${-geo.cardW * 0.06}px,${-geo.cardH * 0.34}px) rotate(-6deg)` },
    ], { duration: ctx.dur(880), easing: 'cubic-bezier(.4,.2,.5,.9)', fill: 'forwards' });
  },
  exit(ctx) {
    return ctx.animate(ctx.parts.prop, [
      { opacity: 1, filter: `blur(0) ${accentGlow(ctx, 8)}`, transform: ctx.parts.prop.style.transform },
      { opacity: 0, filter: 'blur(6px)', transform: `${ctx.parts.prop.style.transform} translate(0,-14px)` },
    ], { duration: ctx.dur(360), easing: 'ease-in', fill: 'forwards' });
  },
};

// ---------------------------------------------------------------------------
// CREATION — a sprout grows from the card, unfurls leaves and blooms.
// ---------------------------------------------------------------------------
const CREATION = {
  tone: { aura: 'rgba(150,230,150,.4)', auraSoft: 'rgba(80,170,90,.16)', mote: 'rgba(212,255,206,.9)', accent: 'rgba(180,245,170,.95)' },
  build(ctx) {
    const { geo } = ctx;
    // One self-contained SVG (viewBox 0..100) so the sprout's geometry is fully
    // bounded — stem, leaves and bloom all live inside the box.
    const w = geo.cardW * 0.66;
    const h = geo.cardH * 0.62;
    const baseY = geo.cy + geo.cardH * 0.3; // root sits in the lower card
    const svg = ctx.svg('svg', { viewBox: '0 0 100 100' });
    svg.style.cssText = `left:${geo.cx}px;top:${baseY - h}px;width:${w}px;height:${h}px;transform:translateX(-50%);overflow:visible;filter:${accentGlow(ctx, 7)}`;

    const stem = ctx.svg('path', {
      d: 'M50 100 C 46 74, 54 52, 50 26', fill: 'none', stroke: 'rgba(190,250,180,.95)',
      'stroke-width': '6', 'stroke-linecap': 'round',
    });
    const leaf = (d) => {
      const node = ctx.svg('path', { d, fill: 'rgba(196,250,186,.88)' });
      node.style.cssText = 'transform-box:fill-box;transform-origin:center;transform:scale(0)';
      return node;
    };
    const l1 = leaf('M50 64 C 30 54, 16 60, 14 72 C 30 76, 44 72, 50 64 Z');
    const l2 = leaf('M50 52 C 70 42, 84 48, 86 60 C 70 64, 56 60, 50 52 Z');
    const bloom = ctx.svg('circle', { cx: '50', cy: '24', r: '14', fill: 'rgba(248,255,236,.96)' });
    bloom.style.cssText = 'transform-box:fill-box;transform-origin:center;transform:scale(0);filter:drop-shadow(0 0 7px rgba(200,255,180,.8))';

    svg.append(stem, l1, l2, bloom);
    ctx.parts.stem = stem; ctx.parts.l1 = l1; ctx.parts.l2 = l2; ctx.parts.bloom = bloom;
    ctx.parts.prop = svg;
  },
  async run(ctx) {
    const stem = ctx.parts.stem;
    const len = (typeof stem.getTotalLength === 'function' && (() => { try { return stem.getTotalLength(); } catch { return 90; } })()) || 90;
    stem.style.strokeDasharray = `${len}`;
    stem.style.strokeDashoffset = `${len}`;
    await ctx.animate(stem, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: ctx.dur(440), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    await Promise.all([
      ctx.animate(ctx.parts.l1, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
        { duration: ctx.dur(260), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }),
      ctx.animate(ctx.parts.l2, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
        { duration: ctx.dur(260), delay: ctx.dur(90), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }),
    ]);
    ctx.impact();
    await ctx.animate(ctx.parts.bloom, [
      { transform: 'scale(0)', filter: 'brightness(1)' },
      { transform: 'scale(1.15)', filter: 'brightness(1.4)', offset: 0.6 },
      { transform: 'scale(1)', filter: 'brightness(1.1)' },
    ], { duration: ctx.dur(380), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    await ctx.wait(ctx.dur(100));
  },
};

// ---------------------------------------------------------------------------
// FORTUNE — a die tumbles in, bounces and lands showing its pips.
// ---------------------------------------------------------------------------
const FORTUNE = {
  tone: { aura: 'rgba(230,210,130,.42)', auraSoft: 'rgba(150,160,80,.16)', mote: 'rgba(246,240,190,.9)', accent: 'rgba(236,226,150,.95)' },
  build(ctx) {
    const { geo } = ctx;
    const d = Math.min(geo.cardW, geo.cardH) * 0.42;
    const prop = ctx.el('', {
      left: `${geo.cx}px`, top: `${geo.cy}px`, width: `${d}px`, height: `${d}px`,
      transform: `translate(-50%,-50%) translate(${-geo.cardW * 0.34}px,${-geo.cardH * 0.42}px) rotate(0deg) scale(.7)`,
      opacity: '0', filter: accentGlow(ctx, 8),
    });
    const cube = ctx.el('', {
      inset: '0', borderRadius: '16%',
      background: 'linear-gradient(150deg,rgba(255,250,228,.95),rgba(225,205,130,.78))',
      boxShadow: 'inset 0 0 12px rgba(180,150,70,.45)',
    });
    prop.appendChild(cube);
    // Five pips (a "5" face), as glowing dots.
    const pip = (xp, yp) => ctx.el('', {
      left: `${xp}%`, top: `${yp}%`, width: `${d * 0.16}px`, height: `${d * 0.16}px`, transform: 'translate(-50%,-50%)',
      borderRadius: '50%', background: 'radial-gradient(circle,rgba(120,90,30,.9),rgba(160,120,50,.7))',
    });
    for (const [x, y] of [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]]) prop.appendChild(pip(x, y));
    ctx.parts.prop = prop;
  },
  async run(ctx) {
    const { geo } = ctx;
    const p = ctx.parts.prop;
    const base = 'translate(-50%,-50%)';
    await ctx.animate(p, [
      { opacity: 0, transform: `${base} translate(${-geo.cardW * 0.34}px,${-geo.cardH * 0.42}px) rotate(0deg) scale(.7)`, filter: 'blur(4px)' },
      { opacity: 1, transform: `${base} translate(${-geo.cardW * 0.08}px,${-geo.cardH * 0.06}px) rotate(380deg) scale(1)`, filter: 'blur(0)' },
    ], { duration: ctx.dur(420), easing: 'cubic-bezier(.3,.4,.5,1)', fill: 'forwards' });
    // Two damped bounces while settling rotation to 0.
    await ctx.animate(p, [
      { transform: `${base} translate(${-geo.cardW * 0.08}px,${-geo.cardH * 0.06}px) rotate(380deg)` },
      { transform: `${base} translate(${-geo.cardW * 0.02}px,${geo.cardH * 0.04}px) rotate(540deg)`, offset: 0.35 },
      { transform: `${base} translate(${geo.cardW * 0.02}px,${-geo.cardH * 0.05}px) rotate(540deg)`, offset: 0.6 },
      { transform: `${base} translate(${geo.cardW * 0.02}px,${geo.cardH * 0.03}px) rotate(540deg)`, offset: 0.82 },
      { transform: `${base} translate(${geo.cardW * 0.02}px,0) rotate(540deg)` },
    ], { duration: ctx.dur(520 * ctx.power.snap), easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
    ctx.impact();
    flash(ctx, geo.cx + geo.cardW * 0.02, geo.cy, geo.cardW * 0.6, ctx.tone.accent, ctx.dur(340));
    await ctx.animate(p, [
      { filter: `${accentGlow(ctx, 8)} brightness(1)` },
      { filter: `${accentGlow(ctx, 18)} brightness(1.35)`, offset: 0.4 },
      { filter: `${accentGlow(ctx, 8)} brightness(1)` },
    ], { duration: ctx.dur(320), easing: 'ease-out', fill: 'forwards' });
  },
};

const SPECS = {
  [ACTION_NODES.PHYSICAL]: PHYSICAL,
  [ACTION_NODES.PROTECTION]: PROTECTION,
  [ACTION_NODES.ENDURANCE]: ENDURANCE,
  [ACTION_NODES.COMPASSION]: COMPASSION,
  [ACTION_NODES.AUTHORITY]: AUTHORITY,
  [ACTION_NODES.MYSTERY]: MYSTERY,
  [ACTION_NODES.DECEPTION]: DECEPTION,
  [ACTION_NODES.INVESTIGATION]: INVESTIGATION,
  [ACTION_NODES.TRANSFORMATION]: TRANSFORMATION,
  [ACTION_NODES.CREATION]: CREATION,
  [ACTION_NODES.FORTUNE]: FORTUNE,
};

export const NODE_APPARITION_SPECS = SPECS;

// Returns a play function (target, anchorRect, options) for a node, or null.
export function nodeApparition(node) {
  const spec = SPECS[node];
  if (!spec) return null;
  return (target, anchorRect, options) => runApparition(target, anchorRect, options, spec);
}
