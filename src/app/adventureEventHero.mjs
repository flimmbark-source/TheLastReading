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
      top:38px!important;
      left:6px!important;
      right:6px!important;
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
      top:7px!important;
      left:8px!important;
      right:8px;
      max-width:none!important;
      z-index:43!important;
      align-items:flex-start;
    }
    body.mode-adventure #advHud .adv-hud__main{
      min-height:28px;
      padding:5px 11px 5px 12px;
      border-color:rgba(214,166,86,.42);
      border-radius:999px;
      background:linear-gradient(180deg,rgba(24,17,11,.96),rgba(12,9,7,.94));
      box-shadow:0 5px 16px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,224,162,.09);
    }
    body.mode-adventure #advHud .adv-hud__label{font-size:8px;letter-spacing:.2em}
    body.mode-adventure #advHud .adv-pip{width:9px;height:9px}
    body.mode-adventure #advHud .adv-hud__statuses{margin-top:2px}

    .adv-event-hero{
      position:relative;
      width:100%;
      height:clamp(154px,42vw,196px);
      overflow:hidden;
      border:1px solid rgba(202,157,81,.76);
      border-radius:11px;
      background-color:#17120d;
      background-repeat:no-repeat;
      background-size:auto 400%;
      background-position:center var(--adv-event-row,0%);
      box-shadow:
        0 12px 30px rgba(0,0,0,.65),
        0 0 0 1px rgba(34,22,13,.9),
        inset 0 0 0 1px rgba(255,224,164,.09);
      isolation:isolate;
    }
    .adv-event-hero::before{
      content:'';
      position:absolute;
      inset:0;
      z-index:0;
      background:
        linear-gradient(180deg,rgba(5,6,7,.58) 0%,rgba(6,7,8,.06) 25%,rgba(7,7,8,.04) 50%,rgba(7,6,5,.78) 78%,rgba(7,5,4,.96) 100%),
        linear-gradient(90deg,rgba(3,4,5,.30),transparent 20%,transparent 80%,rgba(3,4,5,.30));
    }
    .adv-event-hero::after{
      content:'';
      position:absolute;
      inset:5px;
      z-index:1;
      border:1px solid rgba(229,190,114,.24);
      border-radius:7px;
      box-shadow:inset 0 0 18px rgba(0,0,0,.22);
      pointer-events:none;
    }
    .adv-event-hero__ornament{
      position:absolute;
      z-index:3;
      top:33px;
      left:50%;
      width:88px;
      height:1px;
      transform:translateX(-50%);
      background:linear-gradient(90deg,transparent,rgba(226,184,105,.62),transparent);
    }
    .adv-event-hero__ornament::after{
      content:'✦';
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      padding:0 6px;
      color:#d9b16b;
      background:rgba(10,8,6,.78);
      font-size:8px;
      text-shadow:0 0 7px rgba(242,193,96,.48);
    }
    .adv-event-hero__title{
      position:absolute;
      z-index:3;
      top:7px;
      left:50%;
      width:max-content;
      max-width:88%;
      transform:translateX(-50%);
      margin:0;
      padding:5px 18px 6px;
      color:#f1ddb3;
      text-align:center;
      white-space:nowrap;
      font:800 clamp(15px,4.6vw,24px)/1 'Cinzel',Georgia,serif;
      letter-spacing:.05em;
      text-transform:uppercase;
      text-shadow:0 2px 3px #000;
      background:linear-gradient(90deg,transparent,rgba(10,8,6,.86) 14%,rgba(10,8,6,.86) 86%,transparent);
    }
    .adv-event-hero__copy{
      position:absolute;
      z-index:3;
      left:clamp(14px,4.5vw,34px);
      right:clamp(14px,4.5vw,34px);
      bottom:8px;
      padding:9px 14px 8px;
      color:#eadcc0;
      text-align:center;
      font:500 clamp(10.5px,2.9vw,13.5px)/1.36 Georgia,serif;
      text-shadow:0 1px 2px #000;
      background:linear-gradient(180deg,rgba(16,12,9,.54),rgba(10,7,5,.88));
      border:1px solid rgba(222,177,94,.28);
      border-radius:7px;
      box-shadow:0 5px 14px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,227,176,.05);
      backdrop-filter:blur(2px);
    }
    .adv-event-hero__next{
      position:absolute;
      z-index:4;
      right:10px;
      top:40px;
      padding:3px 7px;
      border:1px solid rgba(213,170,92,.28);
      border-radius:999px;
      color:#d9b978;
      background:rgba(12,9,7,.72);
      font:700 8px/1.2 system-ui,sans-serif;
      letter-spacing:.07em;
      text-transform:capitalize;
    }

    body.mode-adventure .spread-wrap{margin-top:clamp(48px,11vw,68px)!important}
    body.mode-adventure .spread-actions{z-index:29;transform:translateY(12px)}

    @media(max-width:640px){
      body.mode-adventure #advEventDeck{top:37px!important;left:4px!important;right:4px!important}
      body.mode-adventure #advHud{left:5px!important;right:5px}
      body.mode-adventure #advHud .adv-hud__main{padding:5px 9px}
      .adv-event-hero{height:clamp(150px,44vw,178px);border-radius:8px}
      .adv-event-hero__title{top:6px;padding:5px 13px 6px;font-size:clamp(14px,4.8vw,20px)}
      .adv-event-hero__ornament{top:31px;width:72px}
      .adv-event-hero__copy{left:7px;right:7px;bottom:6px;padding:8px 10px 7px}
      .adv-event-hero__next{top:36px;right:7px}
      body.mode-adventure .spread-wrap{margin-top:54px!important}
      body.mode-adventure .spread-actions{transform:translateY(15px)}
    }

    @media(min-width:760px){
      body.mode-adventure #advEventDeck{top:43px!important}
      .adv-event-hero{height:202px}
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
    <span class="adv-event-hero__ornament" aria-hidden="true"></span>
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
