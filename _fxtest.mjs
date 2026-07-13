import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="summary"></div><div id="relicRack"></div></body></html>', { url: 'http://localhost/game.html', pretendToBeVisual: true });
const w = dom.window;
global.window = w; global.document = w.document;
w.requestAnimationFrame = cb => w.setTimeout(() => cb(performance.now?.()||Date.now()), 8);
w.cancelAnimationFrame = id => w.clearTimeout(id);
w.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
w.startReading = () => {};
let overlayHtml = '';
w.showOverlay = html => { overlayHtml = html; w.document.getElementById('summary').innerHTML = html; };
w.clearOverlay = () => { overlayHtml=''; w.document.getElementById('summary').innerHTML = ''; };
w.state = { hand: [], deck: [] }; w.persist = {}; w.location = { search: '' };

const mode = await import('./src/app/adventureModeV3.mjs');
const fx = await import('./src/app/adventureInteractionFx.mjs');
mode.installAdventureModeV3(w);
fx.installAdventureInteractionFx(w);   // wraps tlrAdventureOnCardPlaced
w.__tlrAdvRng = (() => { let s=999; return () => (s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff; })();
w.tlrStartAdventure();

const { ALL_CARD_DEFINITIONS } = await import('./src/data/cards.mjs');
const { cardAdventureProfile } = await import('./src/data/adventure/cardNodes.mjs');
const invCard = ALL_CARD_DEFINITIONS.find(c=>cardAdventureProfile(c).node==='investigation');

console.log('wrapped:', w.__tlrAdventurePlacementFxWrapped === true);
console.log('deck eventId:', w.document.getElementById('advEventDeck')?.dataset?.eventId);

// Track whether the FX ran by watching the resolving body class.
let sawResolving = false;
const obs = new w.MutationObserver(()=>{ if (w.document.body.classList.contains('adv-sprite-resolving')) sawResolving = true; });
obs.observe(w.document.body, { attributes:true, attributeFilter:['class'] });

const ok = w.tlrAdventureOnCardPlaced({ id: invCard.id, uid: 'u1' });
console.log('onCardPlaced ok:', ok);
await new Promise(r => w.setTimeout(r, 600));
console.log('animation ran (adv-sprite-resolving seen):', sawResolving);
console.log('sprite root cleaned up:', !w.document.getElementById('advInteractionFxRoot') );
console.log('outcome overlay shown after animation:', /result-panel/.test(overlayHtml), '| has data-adv-fx:', /data-adv-fx/.test(overlayHtml));
console.log('overlay title:', w.document.querySelector('#summary .rhead h3')?.textContent);
