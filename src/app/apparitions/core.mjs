// Shared framework for code-driven Adventure "apparitions".
//
// Each action node summons a ghostly object that manifests through smoke,
// performs a characteristic action on the Event, then frays back into motes and
// fog. This module owns everything common — the themed atmosphere (aura, smoke
// wisps, dissolve motes), potency scaling, reduced-motion handling, the
// manifest → action → dissolve runner and the onImpact hook — so each node's
// spec only has to build its hero prop and describe its one distinctive action.
//
// Props are rendered light/luminous and the root uses `mix-blend-mode: screen`,
// so everything reads as a spectral apparition tinted by its node's tone.

export const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_ID = 'tlr-apparition-core-style';
const ROOT_ID = 'tlrApparition';

export function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

// Deterministic jitter so repeated runs look identical but feel organic.
export function jitter(seed) {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

export function el(doc, className, styles) {
  const node = doc.createElement('div');
  if (className) node.className = className;
  if (styles) Object.assign(node.style, styles);
  return node;
}

export function svgEl(doc, name, attrs) {
  const node = doc.createElementNS(SVG_NS, name);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function animate(target, node, keyframes, options) {
  if (!node?.animate) {
    return new Promise(resolve => target.setTimeout(resolve, Number(options?.duration || 0)));
  }
  return node.animate(keyframes, options).finished.catch(() => undefined);
}

// Subtle multipliers from card potency (1–5), anchored so potency 3 is baseline.
export function potencyProfile(potency) {
  const level = clamp(Math.round(Number(potency) || 3), 1, 5);
  const lf = (level - 3) / 2; // -1 .. +1
  return {
    level,
    size: 1 + lf * 0.09,
    energy: 1 + lf * 0.16,
    echo: 1 + lf * 0.24,
    snap: 1 - lf * 0.10,
    motes: 8 + Math.round(lf * 3),
    jolt: 1 + lf * 0.35,
  };
}

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}{position:fixed;z-index:2147482800;pointer-events:none;
      mix-blend-mode:screen;transform:translate(-50%,0);will-change:opacity,transform}
    #${ROOT_ID} *{position:absolute;will-change:transform,opacity,filter}
    #${ROOT_ID} .appar-aura{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,var(--appar-aura,rgba(150,200,255,.45)),
        var(--appar-aura-soft,rgba(96,140,220,.16)) 46%,transparent 72%);filter:blur(10px)}
    #${ROOT_ID} .appar-wisp{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,rgba(206,216,234,.4),rgba(150,162,190,.15) 44%,transparent 74%);
      filter:blur(7px)}
    #${ROOT_ID} .appar-mote{border-radius:50%;opacity:0;
      background:radial-gradient(circle at 50% 50%,var(--appar-mote,rgba(220,238,255,.9)),transparent 62%);
      filter:blur(.4px)}
  `;
  doc.head.appendChild(style);
}

function sizeAround(cx, cy, size) {
  return { width: `${size}px`, height: `${size}px`, left: `${cx - size / 2}px`, top: `${cy - size / 2}px` };
}

function buildStage(doc, anchorRect, power, tone) {
  const cardW = anchorRect.width;
  const cardH = anchorRect.height;
  const boxW = Math.max(140, cardW * 2.0);
  const boxH = Math.max(180, cardH * 2.0);

  const root = el(doc, '', { width: `${boxW}px`, height: `${boxH}px` });
  root.id = ROOT_ID;
  if (tone?.aura) root.style.setProperty('--appar-aura', tone.aura);
  if (tone?.auraSoft) root.style.setProperty('--appar-aura-soft', tone.auraSoft);
  if (tone?.mote) root.style.setProperty('--appar-mote', tone.mote);

  const cx = boxW / 2;
  const cy = boxH / 2;
  const cardTop = cy - cardH / 2;
  const cardBottom = cy + cardH / 2;
  const cardLeft = cx - cardW / 2;
  const cardRight = cx + cardW / 2;

  const aura = el(doc, 'appar-aura', sizeAround(cx, cy, boxW * 0.7 * power.size));
  root.appendChild(aura);

  const wisps = [];
  for (let i = 0; i < 5; i += 1) {
    const size = boxW * (0.3 + jitter(i + 1) * 0.24);
    const wisp = el(doc, 'appar-wisp', {
      width: `${size}px`, height: `${size}px`,
      left: `${cx + (jitter(i + 7) - 0.5) * cardW * 1.1 - size / 2}px`,
      top: `${cy + (jitter(i + 3) - 0.2) * cardH * 0.6 - size / 2}px`,
    });
    root.appendChild(wisp);
    wisps.push(wisp);
  }

  const geo = {
    boxW, boxH, cx, cy, cardW, cardH, cardTop, cardBottom, cardLeft, cardRight,
    span: Math.min(boxW, boxH),
  };
  return { root, aura, wisps, geo };
}

function buildMotes(doc, root, geo, power) {
  const motes = [];
  const count = clamp(power.motes, 4, 12);
  for (let i = 0; i < count; i += 1) {
    const size = geo.cardW * (0.03 + jitter(i + 11) * 0.05);
    const mote = el(doc, 'appar-mote', {
      width: `${size}px`, height: `${size}px`,
      left: `${geo.cx + (jitter(i + 5) - 0.5) * geo.cardW * 0.9 - size / 2}px`,
      top: `${geo.cy + (jitter(i + 9) - 0.5) * geo.cardH * 0.7 - size / 2}px`,
    });
    root.appendChild(mote);
    motes.push(mote);
  }
  return motes;
}

/**
 * Runs an apparition spec through the shared manifest → action → dissolve arc.
 *
 * spec = {
 *   tone:  { aura, auraSoft, mote, accent } — colour theme,
 *   build: (ctx) => void   — create the hero prop(s); attach handles to ctx.parts,
 *   run:   (ctx) => Promise — manifest + perform the characteristic action,
 *                             calling ctx.impact() at the moment it lands,
 *   exit?: (ctx) => Promise — custom dissolve (defaults to a blur-fade of ctx.parts.prop),
 * }
 *
 * @returns {Promise<boolean>} true if it ran, false if the host could not support it.
 */
export async function runApparition(target, anchorRect, options, spec) {
  const doc = target?.document;
  if (!doc || !anchorRect?.width || !anchorRect?.height) return false;

  ensureStyle(doc);
  doc.getElementById(ROOT_ID)?.remove();

  const power = potencyProfile(options?.potency);
  const reduced = options?.reduced
    ?? target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ?? false;

  const { root, aura, wisps, geo } = buildStage(doc, anchorRect, power, spec.tone);
  const motes = buildMotes(doc, root, geo, power);

  let impactFired = false;
  const ctx = {
    doc, target, root, geo, power, reduced,
    tone: spec.tone || {},
    parts: {},
    el: (cls, styles) => el(doc, cls, styles),
    svg: (name, attrs) => svgEl(doc, name, attrs),
    animate: (node, kf, opts) => animate(target, node, kf, opts),
    wait: (ms) => new Promise(resolve => target.setTimeout(resolve, ms)),
    dur: (ms) => Math.round(reduced ? ms * 0.55 : ms),
    add: (node) => { root.appendChild(node); return node; },
    impact: () => {
      if (impactFired) return;
      impactFired = true;
      try { options?.onImpact?.(); } catch { /* host */ }
    },
  };

  spec.build(ctx);
  // The prop layer is appended above the aura/wisps but below nothing else.
  if (ctx.parts.prop && !ctx.parts.prop.parentNode) root.appendChild(ctx.parts.prop);

  parts2dom(root, ctx.parts);
  doc.body.appendChild(root);
  root.style.left = `${anchorRect.left + anchorRect.width / 2}px`;
  root.style.top = `${anchorRect.top + anchorRect.height / 2 - geo.boxH / 2}px`;

  const auraPeak = clamp(0.62 * power.energy, 0.3, 0.9);

  try {
    // Atmosphere blooms while the prop manifests and acts.
    ctx.animate(aura, [{ opacity: 0 }, { opacity: auraPeak }], { duration: ctx.dur(320), fill: 'forwards' });
    wisps.forEach((w, i) => ctx.animate(w, [
      { opacity: 0, transform: `translateY(${8 + jitter(i) * 10}px) scale(.6)` },
      { opacity: 0.45, transform: 'translateY(-4px) scale(1.05)', offset: 0.5 },
      { opacity: 0, transform: `translateY(${-16 - jitter(i + 2) * 12}px) scale(1.4)` },
    ], { duration: ctx.dur(440 + jitter(i) * 120), delay: ctx.dur(i * 26), easing: 'ease-out', fill: 'forwards' }));

    await spec.run(ctx);

    // Dissolve: prop frays out, motes rise, a last breath of fog.
    ctx.animate(aura, [{ opacity: auraPeak }, { opacity: 0 }], { duration: ctx.dur(360), fill: 'forwards' });
    const moteOut = motes.map((m, i) => ctx.animate(m, [
      { opacity: 0, transform: 'translateY(0) scale(.6)' },
      { opacity: 0.85, transform: `translateY(${-8 - jitter(i) * 10}px) scale(1)`, offset: 0.35 },
      { opacity: 0, transform: `translateY(${-28 - jitter(i + 1) * 26}px) translateX(${(jitter(i + 4) - 0.5) * 26}px) scale(.5)` },
    ], { duration: ctx.dur(460 + jitter(i) * 160), delay: ctx.dur(jitter(i + 6) * 120), easing: 'ease-out', fill: 'forwards' }));
    const fogOut = wisps.slice(0, 3).map((w, i) => ctx.animate(w, [
      { opacity: 0, transform: 'scale(.7)' }, { opacity: 0.4, transform: 'scale(1.1)', offset: 0.45 }, { opacity: 0, transform: 'scale(1.6)' },
    ], { duration: ctx.dur(460), delay: ctx.dur(i * 36), easing: 'ease-out', fill: 'forwards' }));

    const exit = spec.exit
      ? spec.exit(ctx)
      : ctx.parts.prop && ctx.animate(ctx.parts.prop, [
          { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)' },
        ], { duration: ctx.dur(380), easing: 'ease-in', fill: 'forwards' });

    await Promise.all([exit, ...moteOut, ...fogOut].filter(Boolean));
    return true;
  } finally {
    root.remove();
  }
}

// Appends any handle that is a fully detached element (no parent yet), so specs
// can stash top-level elements on ctx.parts without manual appends. Elements
// already nested inside another part (e.g. svg children, prop children) have a
// parentNode and are left in place — checking parentNode rather than isConnected
// matters because the root is not in the document at this point.
function parts2dom(root, parts) {
  for (const value of Object.values(parts)) {
    if (value && value.nodeType === 1 && !value.parentNode) root.appendChild(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && item.nodeType === 1 && !item.parentNode) root.appendChild(item);
      }
    }
  }
}
