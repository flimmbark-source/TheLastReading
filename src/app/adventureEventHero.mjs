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
    body.mode-adventure{
      --adv-encounter-top:38px;
      --adv-encounter-width:min(720px,calc(100vw - 8px));
      --adv-scene-height:clamp(136px,39vw,174px);
      --adv-title-height:clamp(38px,10vw,46px);
      --adv-copy-min-height:clamp(58px,15vw,72px);
      --adv-action-top:clamp(286px,78vw,334px);
      --adv-spread-top:clamp(348px,94vw,404px);
    }

    body.mode-adventure #advEventDeck{
      position:fixed!important;
      z-index:26;
      top:var(--adv-encounter-top)!important;
      left:50%!important;
      right:auto!important;
      width:var(--adv-encounter-width)!important;
      max-width:none!important;
      margin:0!important;
      transform:translateX(-50%)!important;
      display:none;
      color:#f3dfb5;
      pointer-events:none;
      font-family:Georgia,serif;
    }
    body.mode-adventure #advEventDeck{display:block!important}

    /* Resolve now reads as the encounter's top rail rather than a detached pill. */
    body.mode-adventure #advHud{
      top:6px!important;
      left:7px!important;
      right:7px!important;
      max-width:none!important;
      z-index:43!important;
      align-items:flex-start;
    }
    body.mode-adventure #advHud::after{
      content:'';
      position:absolute;
      z-index:-1;
      top:15px;
      left:132px;
      right:9px;
      height:1px;
      background:linear-gradient(90deg,rgba(211,164,83,.58),rgba(211,164,83,.14) 72%,transparent);
      box-shadow:0 1px 0 rgba(0,0,0,.8);
    }
    body.mode-adventure #advHud .adv-hud__main{
      min-height:29px;
      padding:5px 12px 5px 13px;
      border:1px solid rgba(214,166,86,.48);
      border-radius:999px;
      background:linear-gradient(180deg,rgba(25,18,11,.97),rgba(11,8,6,.96));
      box-shadow:0 5px 16px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,225,166,.10);
    }
    body.mode-adventure #advHud .adv-hud__label{font-size:8px;letter-spacing:.2em}
    body.mode-adventure #advHud .adv-pip{width:9px;height:9px}
    body.mode-adventure #advHud .adv-hud__statuses{margin-top:3px}

    /* One outer object, but three genuinely separate content layers. */
    .adv-encounter{
      position:relative;
      width:100%;
      overflow:visible;
      padding:4px 4px 7px;
      border:1px solid rgba(202,157,81,.78);
      border-radius:11px;
      background:linear-gradient(180deg,#100c09,#090705);
      box-shadow:
        0 12px 30px rgba(0,0,0,.66),
        0 0 0 1px rgba(31,20,12,.94),
        inset 0 0 0 1px rgba(255,224,164,.08);
      isolation:isolate;
    }
    .adv-encounter::after{
      content:'';
      position:absolute;
      inset:8px;
      z-index:5;
      border:1px solid rgba(229,190,114,.13);
      border-radius:7px;
      pointer-events:none;
    }

    .adv-encounter__scene{
      position:relative;
      height:var(--adv-scene-height);
      overflow:hidden;
      border-radius:7px 7px 4px 4px;
      background-color:#17120d;
      background-repeat:no-repeat;
      background-size:auto 400%;
      background-position:center var(--adv-event-row,0%);
      box-shadow:inset 0 -18px 24px rgba(0,0,0,.22);
    }
    .adv-encounter__scene::before{
      content:'';
      position:absolute;
      inset:0;
      background:
        linear-gradient(180deg,rgba(4,5,6,.35) 0%,rgba(5,6,7,.02) 28%,rgba(6,6,6,.02) 66%,rgba(8,6,5,.48) 100%),
        linear-gradient(90deg,rgba(3,4,5,.22),transparent 18%,transparent 82%,rgba(3,4,5,.22));
    }

    .adv-encounter__title{
      position:relative;
      z-index:7;
      width:86%;
      min-height:var(--adv-title-height);
      margin:calc(var(--adv-title-height) * -.46) auto 0;
      padding:9px 18px 8px;
      display:flex;
      align-items:center;
      justify-content:center;
      box-sizing:border-box;
      border:1px solid rgba(222,177,94,.54);
      border-radius:7px 7px 4px 4px;
      color:#f1ddb3;
      background:
        linear-gradient(90deg,rgba(20,14,9,.96),rgba(11,8,6,.98) 18%,rgba(11,8,6,.98) 82%,rgba(20,14,9,.96));
      box-shadow:0 6px 16px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,226,172,.07);
      text-align:center;
      font:800 clamp(15px,4.7vw,24px)/1.05 'Cinzel',Georgia,serif;
      letter-spacing:.055em;
      text-transform:uppercase;
      text-shadow:0 2px 3px #000;
    }
    .adv-encounter__title::before,
    .adv-encounter__title::after{
      content:'✦';
      flex:0 0 auto;
      margin:0 9px;
      color:#bd8b44;
      font-size:8px;
      text-shadow:0 0 7px rgba(242,193,96,.42);
    }

    .adv-encounter__copy{
      position:relative;
      z-index:6;
      min-height:var(--adv-copy-min-height);
      margin:3px 7px 0;
      padding:10px 15px 9px;
      display:flex;
      align-items:center;
      justify-content:center;
      box-sizing:border-box;
      color:#eadcc0;
      background:linear-gradient(180deg,rgba(20,14,10,.88),rgba(9,7,5,.97));
      border:1px solid rgba(222,177,94,.28);
      border-radius:4px 4px 7px 7px;
      box-shadow:inset 0 1px 0 rgba(255,227,176,.04);
      text-align:center;
      font:500 clamp(10.5px,2.9vw,13.5px)/1.38 Georgia,serif;
      text-shadow:0 1px 2px #000;
    }

    .adv-encounter__next{
      position:absolute;
      z-index:9;
      right:10px;
      top:10px;
      padding:3px 7px;
      border:1px solid rgba(213,170,92,.30);
      border-radius:999px;
      color:#d9b978;
      background:rgba(12,9,7,.76);
      font:700 8px/1.2 system-ui,sans-serif;
      letter-spacing:.07em;
      text-transform:capitalize;
    }

    /* The two actions get a dedicated row beneath the complete encounter frame. */
    html body.mode-adventure .spread-actions{
      position:fixed!important;
      z-index:44!important;
      top:var(--adv-action-top)!important;
      bottom:auto!important;
      left:0!important;
      right:0!important;
      height:58px!important;
      padding:0 19px!important;
      display:flex!important;
      align-items:flex-start!important;
      justify-content:space-between!important;
      transform:none!important;
      pointer-events:none!important;
    }
    html body.mode-adventure .spread-actions button{pointer-events:auto!important}

    /* Keep the reading beneath the encounter/action composition. */
    html body.mode-adventure .spread-wrap{
      top:var(--adv-spread-top)!important;
      margin:0!important;
    }

    @media(max-width:640px){
      body.mode-adventure{
        --adv-encounter-top:37px;
        --adv-encounter-width:calc(100vw - 8px);
        --adv-scene-height:clamp(134px,40vw,156px);
        --adv-title-height:clamp(38px,10.5vw,44px);
        --adv-copy-min-height:clamp(60px,16vw,70px);
        --adv-action-top:clamp(282px,79vw,318px);
        --adv-spread-top:clamp(344px,96vw,382px);
      }
      body.mode-adventure #advHud{left:5px!important;right:5px!important}
      body.mode-adventure #advHud::after{left:126px;right:6px}
      body.mode-adventure #advHud .adv-hud__main{padding:5px 9px}
      .adv-encounter{padding:3px 3px 6px;border-radius:8px}
      .adv-encounter::after{inset:6px;border-radius:6px}
      .adv-encounter__scene{border-radius:5px 5px 3px 3px}
      .adv-encounter__title{width:88%;padding:8px 10px 7px;font-size:clamp(14px,4.8vw,20px)}
      .adv-encounter__title::before,.adv-encounter__title::after{margin:0 6px;font-size:7px}
      .adv-encounter__copy{margin:3px 5px 0;padding:9px 10px 8px}
      .adv-encounter__next{top:8px;right:8px}
      html body.mode-adventure .spread-actions{height:55px!important;padding:0 15px!important}
    }

    @media(min-width:760px){
      body.mode-adventure{
        --adv-encounter-top:43px;
        --adv-action-top:342px;
        --adv-spread-top:408px;
      }
      .adv-encounter__scene{height:186px}
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

  return `<section class="adv-encounter" aria-label="${esc(title)}">
    <div class="adv-encounter__scene" style="background-image:url('${image}');--adv-event-row:${row}" aria-hidden="true"></div>
    <h2 class="adv-encounter__title">${esc(title)}</h2>
    <div class="adv-encounter__copy">${esc(description)}</div>
    ${nextText ? `<div class="adv-encounter__next">${esc(nextText)}</div>` : ''}
  </section>`;
}

function upgradeDeck(deck) {
  if (!deck || deck.querySelector(':scope > .adv-encounter')) return;
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
