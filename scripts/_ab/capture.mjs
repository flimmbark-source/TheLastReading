// A/B computed-style capture harness for !important reduction.
// Boots the game into deterministic UI states and dumps computed styles for
// every element (plus ::before/::after) to a JSON file for diffing.
// Usage: node scripts/_ab/capture.mjs <out.json>
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
if (!OUT) { console.error('usage: capture.mjs <out.json>'); process.exit(1); }

// ── Property list: every property name mentioned in the stylesheets ──
function allCssFiles(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) allCssFiles(p, out);
    else if (p.endsWith('.css')) out.push(p);
  }
  return out;
}
const propSet = new Set(['content', 'display', 'position', 'z-index', 'opacity', 'transform', 'visibility', 'pointer-events']);
for (const f of allCssFiles('/home/user/TheLastReading/src/styles')) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/(?:^|[;{}]|\s)((?:--)?[a-zA-Z][a-zA-Z0-9-]*)\s*:/g)) propSet.add(m[1]);
}
const PROPS = [...propSet].filter(p => !p.startsWith('--')); // custom props enumerated per-element at runtime
console.error(`capturing ${PROPS.length} named properties + custom props`);

const SEED_SCRIPT = `
(() => {
  let s = 42;
  Math.random = function() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

const STORAGE = {
  tlr_tut_inv_open: '1', tlr_tut_inv_detail: '1', tlr_tut_inv_name: '1',
  tlr_tut_archives_found: '1', tlr_attic_tutored_obals: '1', tlr_attic_tutored: '1',
  tlr_attic_pan_hint: '1', tlr_spv2_hand_hint_seen: '1', tlr_hand_hint_step: '4',
  tlr_pull_tabs_fanned_v2: '1', tlr_candlelight_lighting: '1',
  tlr_attic_found_items: JSON.stringify(['letter_01', 'photo_01', 'clipping_01']),
  tlr_inv_unlocked: JSON.stringify(['frag_sophias_fall_1']),
  tlr_inv_pos: JSON.stringify({
    letter_01: { x: 40, y: 30, rot: -5, named: true },
    photo_01: { x: 140, y: 30, rot: 5, named: true },
    clipping_01: { x: 240, y: 30, rot: 0, named: false },
    frag_sophias_fall_1: { x: 90, y: 120, rot: 3, named: true },
  }),
  tlr_tab_x: '250', tlr_menu_pull_tab_x: '14', tlr_scoring_pull_tab_x: '104', tlr_abilities_pull_tab_x: '194',
};

const CAPTURE_FN = `(props) => {
  const out = [];
  const els = document.querySelectorAll('*');
  let i = 0;
  for (const el of els) {
    i += 1;
    const key = i + ':' + el.tagName + (el.id ? '#' + el.id : '') + '.' + [...el.classList].sort().join('.');
    const parts = [];
    const cs = getComputedStyle(el);
    for (const p of props) parts.push(p + '=' + cs.getPropertyValue(p));
    // custom properties actually set on this element (Chromium enumerates them)
    const customs = [];
    for (let k = 0; k < cs.length; k++) { const n = cs.item(k); if (n.startsWith('--')) customs.push(n); }
    customs.sort();
    for (const n of customs) parts.push(n + '=' + cs.getPropertyValue(n));
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === 'none') { parts.push(pseudo + '=none'); continue; }
      for (const p of props) parts.push(pseudo + p + '=' + ps.getPropertyValue(p));
    }
    out.push([key, parts.join('\\u0001')]);
  }
  return out;
}`;

const SKIP = new Set((process.env.TLR_SKIP || '').split(',').filter(Boolean));
const on = name => !SKIP.has(name);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const results = {};

async function newPage(ctx) {
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(SEED_SCRIPT);
  page.on('pageerror', e => console.error('PAGEERROR:', e.message));
  await page.goto(`http://localhost:${process.env.TLR_PORT || 8080}/game.html`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.evaluate(storage => {
    localStorage.clear();
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
  }, STORAGE);
  // Reload so boot paths read the seeded storage AND the seeded RNG restarts.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);
  return page;
}

async function snap(page, name) {
  await page.waitForTimeout(250);
  results[name] = await page.evaluate(eval(CAPTURE_FN), PROPS);
  console.error('state captured: ' + name + ' (' + results[name].length + ' elements)');
}

async function boot(page) {
  await page.click('button:has-text("New Game")');
  await page.waitForTimeout(3000);
}

// ─────────────────────────── MOBILE ───────────────────────────
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

if (on('m-menu')) { // menu
  const p = await newPage(mob);
  await snap(p, 'm-menu');
  await p.close();
}
if (on('m-reading')) { // reading + toggles
  const p = await newPage(mob);
  await boot(p);
  await snap(p, 'm-reading');
  await p.evaluate(() => { // select first hand card
    const c = document.querySelector('#hand .card[data-uid]');
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 }));
    c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 }));
  });
  await p.waitForTimeout(500);
  await snap(p, 'm-card-selected');
  await p.evaluate(() => window.tlrTogglePullTab('menu'));
  await p.waitForTimeout(600);
  await snap(p, 'm-menu-drawer');
  await p.evaluate(() => { window.tlrTogglePullTab('menu'); window.toggleRef(); });
  await p.waitForTimeout(600);
  await snap(p, 'm-scoring-drawer');
  await p.evaluate(() => window.tlrTogglePullTab('scoring'));
  await p.click('#spv2ArchiveBtn');
  await p.waitForTimeout(600);
  await snap(p, 'm-archive');
  await p.tap('.inv-item[data-inv-id="letter_01"]'); // named item: one tap opens the detail overlay
  await p.waitForTimeout(500);
  await snap(p, 'm-item-detail');
  await p.close();
}
if (on('m-mid-drag')) { // mid-card-drag hold
  const p = await newPage(mob);
  await boot(p);
  const cdp = await mob.newCDPSession(p);
  const r = await p.evaluate(() => document.querySelectorAll('#hand .card[data-uid]')[1].getBoundingClientRect().toJSON());
  const sx = r.x + r.width / 2, sy = r.y + r.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  await p.waitForTimeout(120);
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - i * 28, id: 1 }] });
    await p.waitForTimeout(30);
  }
  await p.waitForTimeout(400);
  await snap(p, 'm-mid-drag');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await p.close();
}
if (on('m-ability-targeting')) { // ability targeting
  const p = await newPage(mob);
  await boot(p);
  await p.evaluate(() => {
    const mirrorCard = { id: 'major_5', uid: 5001, type: 'major', number: 5, ability: 'MIRROR_1' };
    const otherCard = { id: 'major_1', uid: 5002, type: 'major', number: 1 };
    const deckCard = { id: 'major_20', uid: 5003, type: 'major', number: 20 };
    window.tlrStore.dispatch({ type: window.tlrActions.SYNC_LEGACY_RUN, run: { hand: [mirrorCard, otherCard], deck: [deckCard], discard: [], discardedCards: [], discards: 3, selectedCardId: null } });
    const st = window.tlrRuntime.state;
    st.hand = [mirrorCard, otherCard]; st.deck = [deckCard]; st.discard = []; st.discardedCards = []; st.discards = 3;
    window.render();
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => window.discardCardUid(5001));
  await p.waitForTimeout(700);
  await snap(p, 'm-ability-targeting');
  await p.close();
}
if (on('m-attic')) { // attic + pickup
  const p = await newPage(mob);
  await boot(p);
  await p.evaluate(() => window.tlrDebugEnterAttic(3, false));
  await p.waitForTimeout(1700);
  await snap(p, 'm-attic');
  await p.evaluate(() => {
    const coat = [...document.querySelectorAll('.attic-prop')].find(el => el.className.includes('motion-search'));
    if (coat) coat.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await p.waitForTimeout(900);
  await snap(p, 'm-attic-pickup');
  await p.close();
}
if (on('m-adventure')) { // adventure
  const p = await newPage(mob);
  await p.click('button:has-text("Adventure Mode")');
  await p.waitForTimeout(3500);
  await snap(p, 'm-adventure');
  await p.close();
}
if (on('m-duel-cpu')) { // duel chain
  const p = await newPage(mob);
  await p.click('button:has-text("Duel")');
  await p.waitForTimeout(2500);
  await snap(p, 'm-loadout');
  await p.click('[data-loadout-action="ready"]');
  await p.waitForTimeout(1200);
  await snap(p, 'm-matchmaking');
  const cpuBtn = await p.$('.mm-cpu-btn');
  if (cpuBtn) {
    await cpuBtn.click();
    await p.waitForTimeout(4000);
    await snap(p, 'm-duel-cpu');
  } else {
    console.error('no vs CPU button; skipping duel state');
  }
  await p.close();
}
if (on('m-forced-overlays')) { // forced overlays
  const p = await newPage(mob);
  await boot(p);
  await p.evaluate(() => {
    document.getElementById('modal')?.classList.add('show', 'ability-reveal');
    document.getElementById('tutTip')?.classList.add('show');
    document.body.classList.add('hand-card-action-drag-active');
  });
  await p.waitForTimeout(400);
  await snap(p, 'm-forced-overlays');
  await p.close();
}
await mob.close();

// ─────────────────────────── DESKTOP ───────────────────────────
const desk = await browser.newContext({ viewport: { width: 1100, height: 800 } });
if (on('d-menu')) {
  const p = await newPage(desk);
  await snap(p, 'd-menu');
  await boot(p);
  await snap(p, 'd-reading');
  await p.evaluate(() => {
    const c = document.querySelector('#hand .card[data-uid]');
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0 }));
    c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0 }));
  });
  await p.waitForTimeout(500);
  await snap(p, 'd-card-selected');
  await p.evaluate(() => window.tlrTogglePullTab('menu'));
  await p.waitForTimeout(600);
  await snap(p, 'd-menu-drawer');
  await p.evaluate(() => { window.tlrTogglePullTab('menu'); });
  await p.evaluate(() => { window.renderInventory(); window.toggleInventory(); });
  await p.waitForTimeout(600);
  await snap(p, 'd-archive');
  await p.close();
}
await desk.close();

await browser.close();
writeFileSync(OUT, JSON.stringify(results));
console.error('wrote ' + OUT);
