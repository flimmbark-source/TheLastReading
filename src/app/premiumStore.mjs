// Premium expansion gallery ("The Curiosity Shop"), reachable from the
// main menu's promo banner. This is a storefront prototype, so the interface
// deliberately presents the intended finished purchase experience. Mock data,
// local ownership persistence and unwired content stay implementation details
// rather than appearing in player-facing copy.

const OWNED_KEY = 'tlr_premium_owned';
const FEATURED_ID = 'story';

const BUNDLE = {
  id: 'bundle',
  type: 'Collection Bundle',
  name: 'The Complete Reading',
  price: '$12.99',
  art: { kind: 'image', src: 'assets/Store_Front.webp' },
  desc: 'Chapter II together with every deck and table cosmetic currently displayed in the shop.',
  contents: ['Chapter II — The Empty Chair', 'Gilded Arcana Deck', 'Threadbare Deck', 'Velvet Table & Trim'],
};

const CATALOG = [
  {
    id: 'story', type: 'Story Expansion', name: 'Chapter II — The Empty Chair', price: '$6.99',
    art: { kind: 'image', src: 'assets/background.webp' },
    desc: 'Six new readings beyond the attic. A new patron takes the chair across from you — and this one already knows how it ends.',
    contents: ['6 new story readings', 'A new patron with unique dialogue', '3 exclusive relics', 'The attic epilogue'],
  },
  {
    id: 'gilded', type: 'Deck Skin', name: 'Gilded Arcana Deck', price: '$3.99',
    art: { kind: 'swatch', className: 'premium-store-swatch-gilded' },
    desc: 'All 78 cards reillustrated in gold leaf and lacquer. Purely cosmetic — your saves and scoring stay exactly the same.',
    contents: ['78 reillustrated card faces', 'Matching gilded card back'],
  },
  {
    id: 'threadbare', type: 'Deck Skin', name: 'Threadbare Deck', price: '$2.99',
    art: { kind: 'swatch', className: 'premium-store-swatch-threadbare' },
    desc: 'A deck worn soft by a hundred hands before yours — frayed edges, faded ink, a different card back.',
    contents: ['78 reillustrated card faces', 'Matching worn card back'],
  },
  {
    id: 'velvet', type: 'Cosmetic Set', name: 'Velvet Table & Trim', price: '$1.99',
    art: { kind: 'swatch', className: 'premium-store-swatch-velvet' },
    desc: 'Deep velvet felt and brass candle trim for the table between readings.',
    contents: ['Velvet table theme', 'Brass candle trim', '2 collectible card backs'],
  },
];

function findItem(id) {
  return id === 'bundle' ? BUNDLE : CATALOG.find(it => it.id === id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadOwned(target) {
  try {
    const raw = target.localStorage.getItem(OWNED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveOwned(target, owned) {
  try {
    target.localStorage.setItem(OWNED_KEY, JSON.stringify(owned));
  } catch {
    // Storage unavailable (private browsing, quota) -- ownership just won't
    // persist across reloads; the prototype flow still works for this session.
  }
}

export function installPremiumStore(target = window) {
  if (!target || target.__tlrPremiumStoreInstalled) return;
  target.__tlrPremiumStoreInstalled = true;

  let owned = loadOwned(target);
  let view = 'store'; // 'store' | 'detail' | 'done'
  let selectedId = null;

  const doc = () => target.document;
  const byId = id => doc().getElementById(id);

  function setText(id, text) {
    const node = byId(id);
    if (node) node.textContent = text;
  }

  function setNodeText(selector, text) {
    const node = doc().querySelector(selector);
    if (node) node.textContent = text;
  }

  function applyArt(node, item) {
    if (!node) return;
    node.style.backgroundImage = '';
    node.classList.remove('premium-store-swatch-gilded', 'premium-store-swatch-threadbare', 'premium-store-swatch-velvet');
    if (!item?.art) return;
    if (item.art.kind === 'swatch') node.classList.add(item.art.className);
    else if (item.art.kind === 'image') node.style.backgroundImage = `url(${item.art.src})`;
  }

  function prepareStoreChrome() {
    const featured = findItem(FEATURED_ID);
    const featuredBtn = byId('premiumStoreBundle');
    if (featuredBtn) {
      featuredBtn.onclick = () => openDetail(FEATURED_ID);
      featuredBtn.setAttribute('aria-label', `View ${featured.name}`);
    }

    setNodeText('.premium-store-tag-value', 'STORY EXPANSION');
    setNodeText('.premium-store-tag-save', 'FEATURED');
    setNodeText('.premium-store-bundle-name', featured.name);
    setNodeText('.premium-store-bundle-desc', 'Six new readings beyond the attic, centered on the patron waiting in the empty chair.');
    setNodeText('.premium-store-section-label', 'Decks, table themes & collection');
    setNodeText('.premium-store-footnote', 'One-time purchases · Yours on every device');
    setNodeText('.premium-store-fineprint', 'One-time purchase · Restores with your save');
    setNodeText('.premium-store-confirm-label', 'Confirm purchase');
    setNodeText('.premium-store-confirm-note', 'One-time purchase · No recurring charge');
    setNodeText('.premium-store-done-title', 'Added to your collection');

    applyArt(doc().querySelector('.premium-store-bundle-art'), featured);
  }

  function renderGrid() {
    const grid = byId('premiumStoreGrid');
    if (!grid) return;

    const secondaryItems = [
      ...CATALOG.filter(item => item.id !== FEATURED_ID),
      BUNDLE,
    ];

    grid.innerHTML = secondaryItems.map(item => {
      const isOwned = !!owned[item.id];
      const artClass = item.art?.kind === 'swatch' ? ` ${item.art.className}` : '';
      const artStyle = item.art?.kind === 'image' ? ` style="background-image:url(${item.art.src})"` : '';
      return `
        <button type="button" class="premium-store-item${isOwned ? ' premium-store-owned' : ''}" data-store-item="${escapeHtml(item.id)}">
          <div class="premium-store-item-art${artClass}"${artStyle}></div>
          <div class="premium-store-item-body">
            <div class="premium-store-item-type">${escapeHtml(item.type)}</div>
            <div class="premium-store-item-name">${escapeHtml(item.name)}</div>
            <div class="premium-store-item-price">${isOwned ? '✓ Owned' : escapeHtml(item.price)}</div>
          </div>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('[data-store-item]').forEach(card => {
      card.addEventListener('click', () => openDetail(card.dataset.storeItem));
    });
  }

  function renderFeatured() {
    const featured = findItem(FEATURED_ID);
    const featuredBtn = byId('premiumStoreBundle');
    const isOwned = !!owned[FEATURED_ID];
    if (featuredBtn) featuredBtn.classList.toggle('premium-store-owned', isOwned);
    setText('premiumStoreBundlePrice', isOwned ? '✓ Owned' : featured.price);
  }

  function renderDetail() {
    const item = selectedId && findItem(selectedId);
    if (!item) return;
    const isOwned = !!owned[selectedId];
    applyArt(byId('premiumStoreDetailArt'), item);
    setText('premiumStoreDetailType', item.type);
    setText('premiumStoreDetailName', item.name);
    setText('premiumStoreDetailDesc', item.desc);
    const list = byId('premiumStoreDetailContents');
    if (list) {
      list.innerHTML = '';
      for (const line of item.contents) {
        const li = doc().createElement('li');
        li.textContent = line;
        list.appendChild(li);
      }
    }
    const cta = byId('premiumStoreCta');
    if (cta) {
      cta.disabled = isOwned;
      cta.textContent = isOwned ? '✓ In your collection' : `Purchase · ${item.price}`;
    }
  }

  function renderDone() {
    const item = selectedId && findItem(selectedId);
    if (item) {
      setText('premiumStoreDoneDesc', `${item.name} is yours and ready at the table.`);
    }
  }

  function syncViews() {
    const list = byId('premiumStoreList');
    const detail = byId('premiumStoreDetail');
    const done = byId('premiumStoreDone');
    const back = byId('premiumStoreBack');
    if (list) list.hidden = view !== 'store';
    if (detail) detail.hidden = view !== 'detail';
    if (done) done.hidden = view !== 'done';
    if (back) back.hidden = view !== 'detail';
    const item = selectedId && findItem(selectedId);
    setText('premiumStoreSubtitle', view === 'detail' && item ? item.type : 'Chapter expansions & cosmetic collections');
  }

  function render() {
    syncViews();
    renderFeatured();
    if (view === 'detail') renderDetail();
    if (view === 'done') renderDone();
  }

  function openStore() {
    const overlay = byId('premiumStore');
    if (!overlay) return;
    view = 'store';
    selectedId = null;
    prepareStoreChrome();
    renderGrid();
    render();
    overlay.classList.remove('premium-store-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof target.tlrSetMusicContext === 'function') target.tlrSetMusicContext('premiumStore');
  }

  function closeStore() {
    const overlay = byId('premiumStore');
    if (!overlay) return;
    overlay.classList.add('premium-store-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    cancelBuy();
    if (typeof target.tlrSetMusicContext === 'function') {
      const menuActive = target.document?.body?.classList.contains('main-menu-active');
      target.tlrSetMusicContext(menuActive ? 'mainMenu' : 'default');
    }
  }

  function openDetail(id) {
    if (!findItem(id)) return;
    selectedId = id;
    view = 'detail';
    render();
  }

  function backToList() {
    view = 'store';
    selectedId = null;
    renderGrid();
    render();
  }

  function back() {
    if (view === 'detail') backToList();
    else closeStore();
  }

  function ctaAction() {
    if (!selectedId || owned[selectedId]) return;
    const confirm = byId('premiumStoreConfirm');
    if (!confirm) return;
    const item = findItem(selectedId);
    setText('premiumStoreConfirmName', item.name);
    setText('premiumStoreConfirmPrice', item.price);
    setText('premiumStoreConfirmBuy', `Confirm — ${item.price}`);
    confirm.hidden = false;
  }

  function cancelBuy() {
    const confirm = byId('premiumStoreConfirm');
    if (confirm) confirm.hidden = true;
  }

  function confirmBuy() {
    if (!selectedId) return;
    owned = { ...owned, [selectedId]: true };
    saveOwned(target, owned);
    cancelBuy();
    view = 'done';
    render();
  }

  target.tlrOpenPremiumStore = openStore;
  target.tlrClosePremiumStore = closeStore;
  target.tlrPremiumStoreOpenDetail = openDetail;
  target.tlrPremiumStoreBack = back;
  target.tlrPremiumStoreBackToList = backToList;
  target.tlrPremiumStoreCta = ctaAction;
  target.tlrPremiumStoreConfirmBuy = confirmBuy;
  target.tlrPremiumStoreCancelBuy = cancelBuy;
}
