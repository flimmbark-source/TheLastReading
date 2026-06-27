const STYLE_ID = 'adventure-event-hero-style';

export const EVENT_HERO_SPRITES = Object.freeze({
  iron_gate: { page: 1, row: 0 },
  ambush: { page: 1, row: 1 },
  strange_shrine: { page: 1, row: 2 },
  flooded_road: { page: 1, row: 3 },
  cornered_beast: { page: 2, row: 0 },
  traveling_merchant: { page: 2, row: 1 },
  suspicious_villagers: { page: 2, row: 2 },
  unmarked_grave: { page: 2, row: 3 },
  beneath_the_floor: { page: 3, row: 0 },
  whispering_tree: { page: 3, row: 1 },
  recovery_camp: { page: 3, row: 2 },
  woman_in_the_well: { page: 3, row: 3 },
});

const ROW_POSITIONS = ['0%', '33.333%', '66.667%', '100%'];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.mode-adventure #advEventDeck{
      top:20px!important;
      left:8px!important;
      right:8px!important;
      width:auto!important;
      max-width:720px;
      margin:0 auto;
      transform:none!important;
      display:none;
      align-items:stretch!important;
      color:#f3dfb5;
      pointer-events:none;
    }
    body.mode-adventure #advEventDeck{display:block!important}

    body.mode-adventure #advHud{
      top:calc(20px + clamp(132px,36vw,178px) + 3px)!important;
      left:50%!important;
      right:auto!important;
      width:auto!important;
      max-width:70vw!important;
      transform:translateX(-50%)!important;
      align-items:center!important;
      z-index:42!important;
    }
    body.mode-adventure #advHud .adv-hud__main{
      padding:5px 12px 6px!important;
    }
    body.mode-adventure #advHud .adv-hud__resolve{
      display:flex!important;
      flex-direction:column-reverse!important;
      align-items:center!important;
      justify-content:center!important;
      gap:4px!important;
    }
    body.mode-adventure #advHud .adv-pips{
      justify-content:center!important;
    }
    body.mode-adventure #advHud .adv-hud__label{
      text-align:center!important;
      line-height:1!important;
    }
    body.mode-adventure #advHud .adv-hud__statuses{
      justify-content:center!important;
      padding-left:0!important;
    }

    .adv-event-hero{
      position:relative;
      width:100%;
      height:clamp(132px,36vw,178px);
      overflow:hidden;
      border:1px solid rgba(202,157,81,.68);
      border-radius:9px;
      background-color:#17120d;
      background-repeat:no-repeat;
      background-size:100% 400%;
      background-position:center var(--adv-event-row,0%);
      box-shadow:0 10px 26px rgba(0,0,0,.62),inset 0 0 0 1px rgba(255,224,164,.08);
      isolation:isolate;
    }
    .adv-event-hero::before{
      content:'';
      position:absolute;
      inset:0;
      z-index:0;
      background:
        linear-gradient(180deg,rgba(6,7,8,.74) 0%,rgba(8,9,10,.18) 34%,rgba(7,7,8,.18) 48%,rgba(8,7,6,.92) 100%),
        linear-gradient(90deg,rgba(4,5,6,.36),transparent 24%,transparent 76%,rgba(4,5,6,.36));
    }
    .adv-event-hero::after{
      content:'';
      position:absolute;
      inset:5px;
      z-index:1;
      border:1px solid rgba(229,190,114,.18);
      border-radius:6px;
      pointer-events:none;
    }
    .adv-event-hero__title{
      position:absolute;
      z-index:2;
      top:8px;
      left:16px;
      right:16px;
      margin:0;
      color:#f3dfb5;
      text-align:center;
      font:800 clamp(16px,4.8vw,25px)/1.05 'Cinzel',Georgia,serif;
      letter-spacing:.045em;
      text-transform:uppercase;
      text-shadow:0 2px 3px #000,0 0 16px rgba(0,0,0,.95);
    }
    .adv-event-hero__copy{
      position:absolute;
      z-index:2;
      left:clamp(12px,4vw,30px);
      right:clamp(12px,4vw,30px);
      bottom:10px;
      padding:8px 12px 7px;
      color:#eadcc0;
      text-align:center;
      font:600 clamp(10px,2.8vw,13px)/1.32 Georgia,serif;
      text-shadow:0 1px 2px #000;
      background:linear-gradient(180deg,rgba(16,12,9,.28),rgba(13,9,7,.78));
      border-top:1px solid rgba(226,187,110,.2);
      border-bottom:1px solid rgba(226,187,110,.12);
      border-radius:5px;
      backdrop-filter:blur(1.5px);
    }
    .adv-event-hero__next{
      position:absolute;
      z-index:3;
      right:11px;
      top:39px;
      padding:3px 7px;
      border:1px solid rgba(213,170,92,.28);
      border-radius:999px;
      color:#d9b978;
      background:rgba(12,9,7,.68);
      font:700 8px/1.2 system-ui,sans-serif;
      letter-spacing:.07em;
      text-transform:capitalize;
    }

    body.mode-adventure .spread-wrap{
      margin-top:clamp(28px,7vw,48px)!important;
    }
    body.mode-adventure .spread-actions{
      z-index:29;
    }

    @media(max-width:640px){
      body.mode-adventure #advEventDeck{top:18px!important;left:5px!important;right:5px!important}
      body.mode-adventure #advHud{
        top:calc(18px + clamp(128px,38vw,156px) + 3px)!important;
        left:0!important;
        right:0!important;
        width:100%!important;
        max-width:none!important;
        transform:none!important;
        align-items:center!important;
        padding-top:38px!important;
        pointer-events:none!important;
      }
      body.mode-adventure #advHud .adv-hud__main{
        position:fixed!important;
        top:auto!important;
        left:50%!important;
        right:auto!important;
        bottom:max(7px,env(safe-area-inset-bottom))!important;
        transform:translateX(-50%)!important;
        z-index:47!important;
        padding:5px 12px 6px!important;
        pointer-events:none!important;
      }
      body.mode-adventure #advHud .adv-hud__statuses{
        position:static!important;
      }
      .adv-event-hero{height:clamp(128px,38vw,156px);border-radius:7px}
      .adv-event-hero__title{top:7px;left:10px;right:10px}
      .adv-event-hero__copy{left:8px;right:8px;bottom:7px;padding:7px 9px 6px}
      .adv-event-hero__next{top:34px;right:8px}
    }

    @media(min-width:760px){
      body.mode-adventure #advEventDeck{top:24px!important}
      body.mode-adventure #advHud{top:211px!important}
      .adv-event-hero{height:184px}
    }
  `;
  doc.head.appendChild(style);
}

function heroMarkup(deck) {
  const eventId = deck.dataset.eventId || '';
  const sprite = EVENT_HERO_SPRITES[eventId];
  if (!sprite) return null;

  const title = deck.querySelector('.adv-deck__art')?.getAttribute('alt')
    || deck.querySelector('.adv-deck__title')?.textContent
    || eventId.replaceAll('_', ' ');
  const description = deck.querySelector('.adv-event-desc')?.textContent || '';
  const nextText = deck.querySelector('.adv-next-event')?.textContent || '';
  const row = ROW_POSITIONS[sprite.row] || '0%';
  const image = `/Events-page${sprite.page}.png`;

  return `<section class="adv-event-hero" aria-label="${esc(title)}" style="background-image:url('${image}');--adv-event-row:${row}">
    <h2 class="adv-event-hero__title">${esc(title)}</h2>
    ${nextText ? `<div class="adv-event-hero__next">${esc(nextText)}</div>` : ''}
    <div class="adv-event-hero__copy">${esc(description)}</div>
  </section>`;
}

function upgradeDeck(deck) {
  if (!deck || deck.querySelector(':scope > .adv-event-hero')) return;
  const markup = heroMarkup(deck);
  if (markup) deck.innerHTML = markup;
}

export function installAdventureEventHero(target = window) {
  const doc = target?.document;
  if (!doc || target.__tlrAdventureEventHeroInstalled) return;
  target.__tlrAdventureEventHeroInstalled = true;
  ensureStyle(doc);

  const observeDeck = deck => {
    if (!deck || deck.__tlrAdventureHeroObserved) return;
    deck.__tlrAdventureHeroObserved = true;
    const observer = new target.MutationObserver(() => upgradeDeck(deck));
    observer.observe(deck, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-event-id'] });
    upgradeDeck(deck);
  };

  const mountObserver = new target.MutationObserver(() => observeDeck(doc.getElementById('advEventDeck')));
  mountObserver.observe(doc.body, { childList: true, subtree: true });
  observeDeck(doc.getElementById('advEventDeck'));
}

if (typeof window !== 'undefined') installAdventureEventHero(window);
