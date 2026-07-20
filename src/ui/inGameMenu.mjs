const STYLE_ID = 'in-game-menu-style';
const STYLE_HREF = '/src/styles/components/inGameMenu.css?v=3';

const ICONS = Object.freeze({
  audio: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8.3a5 5 0 0 1 0 7.4M18.6 5.7a8.7 8.7 0 0 1 0 12.6"/></svg>',
  assistance: '<svg viewBox="0 0 24 24"><path d="M12 3c1.1 3.2 4.3 4.8 4.3 8.3A4.3 4.3 0 0 1 12 15.7a4.3 4.3 0 0 1-4.3-4.4C7.7 8.5 9.5 6.7 12 3Z"/><path d="M8 19h8M9.5 22h5"/></svg>',
  game: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="m12 7 .8 1.7 1.9.3-1.4 1.3.4 1.9-1.7-.9-1.7.9.4-1.9L9.3 9l1.9-.3L12 7Z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8.5a4.8 4.8 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M3.5 5.5c3.2-.7 5.9.1 8.5 2.1v12c-2.6-2-5.3-2.8-8.5-2.1v-12Z"/><path d="M20.5 5.5c-3.2-.7-5.9.1-8.5 2.1v12c2.6-2 5.3-2.8 8.5-2.1v-12Z"/></svg>',
  tutorial: '<svg viewBox="0 0 24 24"><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M7 10.2v5.3c2.8 2 7.2 2 10 0v-5.3M21 8v6"/></svg>',
  attic: '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"/><circle cx="12" cy="10" r="1"/></svg>',
  return: '<svg viewBox="0 0 24 24"><path d="M5 21V4h11v17M9 9h7M9 15h7"/><path d="M16 12h5m0 0-2-2m2 2-2 2"/></svg>',
});

function ensureStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  document.head.appendChild(link);
}

function makeIcon(document, name, className) {
  const icon = document.createElement('span');
  icon.className = className;
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = ICONS[name] || '';
  return icon;
}

function makeHeading(document, iconName, label) {
  const heading = document.createElement('h3');
  heading.className = 'game-menu-section-heading';

  const text = document.createElement('span');
  text.textContent = label;

  heading.append(makeIcon(document, iconName, 'game-menu-section-icon'), text);
  return heading;
}

function makeSection(document, className, iconName, label) {
  const section = document.createElement('section');
  section.className = `game-menu-section ${className}`;
  section.appendChild(makeHeading(document, iconName, label));
  return section;
}

function updateRangeFill(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 1);
  const value = Number(input.value || 0);
  const span = max - min || 1;
  const percent = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  input.style.setProperty('--menu-range-fill', `${percent}%`);
}

function makeRangeRow(document, input, labelText) {
  const row = document.createElement('label');
  row.className = 'game-menu-range-row';
  row.htmlFor = input.id;

  const label = document.createElement('span');
  label.className = 'game-menu-control-label';
  label.textContent = labelText;

  row.append(label, input, makeIcon(document, 'speaker', 'game-menu-speaker'));
  updateRangeFill(input);
  input.addEventListener('input', () => updateRangeFill(input));
  return row;
}

function decorateRowButton(document, button, iconName, labelText) {
  button.className = 'game-menu-row';

  const label = document.createElement('span');
  label.className = 'game-menu-row-label';
  label.textContent = labelText;

  const chevron = document.createElement('span');
  chevron.className = 'game-menu-row-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';

  button.replaceChildren(makeIcon(document, iconName, 'game-menu-row-icon'), label, chevron);
  return button;
}

function decorateMajorButton(document, button, iconName, modifier) {
  const labelText = button.textContent.trim();
  button.className = `game-menu-major-action game-menu-major-action--${modifier}`;

  const label = document.createElement('span');
  label.className = 'game-menu-row-label';
  label.textContent = labelText;

  button.replaceChildren(makeIcon(document, iconName, 'game-menu-row-icon'), label);
  return button;
}

function ensureGlossaryButton(target, panel) {
  const document = target.document;
  let button = document.getElementById('gameTermsGlossaryButton');
  if (button) return button;

  button = document.createElement('button');
  button.id = 'gameTermsGlossaryButton';
  button.type = 'button';
  button.textContent = 'Game Terms';
  button.addEventListener('click', () => target.tlrOpenGameTermsGlossary?.());
  panel.appendChild(button);
  return button;
}

function preserveHiddenControls(document, controls) {
  const hidden = document.createElement('div');
  hidden.className = 'game-menu-hidden-controls';
  hidden.hidden = true;

  for (const control of controls) {
    const element = control?.closest?.('label') || control;
    if (element?.isConnected) hidden.appendChild(element);
  }
  return hidden;
}

function installDimensionGuard(target, panel) {
  const wrap = target.document.getElementById('menuPullWrap');
  const desk = target.document.getElementById('menuPullDesk');
  const shell = panel.querySelector('.game-menu-shell');
  if (!wrap || !desk || !shell) return () => {};

  // The CSS originally stretched the decorative frame to the old, taller menu.
  // Let it hug the remaining controls, then size the drawer/tab to that frame.
  shell.style.minHeight = '0px';

  let scheduled = 0;
  const apply = () => {
    scheduled = 0;
    const narrow = target.innerWidth <= 520;
    const panelWidth = narrow ? 'calc(100vw - 12px)' : 'min(94vw, 620px)';

    if (panel.style.getPropertyValue('max-width') !== panelWidth
      || panel.style.getPropertyPriority('max-width') !== 'important') {
      panel.style.setProperty('max-width', panelWidth, 'important');
    }

    const deskStyle = target.getComputedStyle?.(desk);
    const paddingTop = Number.parseFloat(deskStyle?.paddingTop || '0') || 0;
    const paddingBottom = Number.parseFloat(deskStyle?.paddingBottom || '0') || 0;
    const contentHeight = Math.ceil(panel.getBoundingClientRect().height + paddingTop + paddingBottom + 2);
    const viewportLimit = Math.max(320, target.innerHeight - (narrow ? 46 : 48));
    const drawerHeight = `${Math.min(viewportLimit, Math.max(280, contentHeight))}px`;

    if (wrap.style.getPropertyValue('--tlr-drawer-h') !== drawerHeight
      || wrap.style.getPropertyPriority('--tlr-drawer-h') !== 'important') {
      wrap.style.setProperty('--tlr-drawer-h', drawerHeight, 'important');
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = target.requestAnimationFrame(apply);
  };

  const styleObserver = new MutationObserver(schedule);
  styleObserver.observe(wrap, { attributes: true, attributeFilter: ['style'] });

  let resizeObserver = null;
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(panel);
  }

  target.addEventListener('resize', schedule, { passive: true });
  schedule();
  target.setTimeout(schedule, 120);

  return () => {
    styleObserver.disconnect();
    resizeObserver?.disconnect();
    target.removeEventListener('resize', schedule);
    if (scheduled) target.cancelAnimationFrame(scheduled);
  };
}

export function installInGameMenu(target = window) {
  if (!target?.document || target.__tlrInGameMenuInstalled) return;
  target.__tlrInGameMenuInstalled = true;

  const document = target.document;
  ensureStyles(document);

  const panel = document.getElementById('settingsPanel');
  if (!panel || panel.dataset.gameMenuBuilt === 'true') return;

  const title = panel.querySelector('.settings-title');
  const music = document.getElementById('musicVol');
  const effects = document.getElementById('sfxVol');
  const hintLevelBar = document.getElementById('hintLevelBar');
  const relicHints = document.getElementById('hintRelics');
  const candlelight = document.getElementById('candlelightLighting');
  const reset = document.getElementById('resetInfoBtn');
  const replay = document.getElementById('replayTutorialBtn');
  const getUp = document.getElementById('getUpBtn');
  const returnToMenu = document.getElementById('returnToMenuBtn');
  const glossary = ensureGlossaryButton(target, panel);

  if (!title || !music || !effects || !hintLevelBar || !replay || !getUp || !returnToMenu) {
    target.__tlrInGameMenuInstalled = false;
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'game-menu-shell';

  const header = document.createElement('header');
  header.className = 'game-menu-header';
  title.className = 'game-menu-title';
  header.appendChild(title);

  const audio = makeSection(document, 'game-menu-audio', 'audio', 'Audio');
  audio.append(
    makeRangeRow(document, music, 'Music'),
    makeRangeRow(document, effects, 'Effects'),
  );

  const assistance = makeSection(document, 'game-menu-assistance', 'assistance', 'Assistance');
  const hintsRow = document.createElement('div');
  hintsRow.className = 'game-menu-setting-row game-menu-hints-row';
  const hintsLabel = document.createElement('span');
  hintsLabel.className = 'game-menu-control-label';
  hintsLabel.textContent = 'Scoring hints';
  hintsRow.append(hintsLabel, hintLevelBar);
  assistance.appendChild(hintsRow);

  const game = makeSection(document, 'game-menu-game', 'game', 'Game');
  const gameList = document.createElement('div');
  gameList.className = 'game-menu-list';
  gameList.append(
    decorateRowButton(document, glossary, 'book', 'Game Terms'),
    decorateRowButton(document, replay, 'tutorial', 'Replay Tutorial'),
  );
  game.appendChild(gameList);

  const actions = document.createElement('footer');
  actions.className = 'game-menu-actions';
  actions.append(
    decorateMajorButton(document, getUp, 'attic', 'attic'),
    decorateMajorButton(document, returnToMenu, 'return', 'return'),
  );

  const hiddenControls = preserveHiddenControls(document, [relicHints, candlelight, reset]);
  shell.append(header, audio, assistance, game, actions, hiddenControls);
  panel.replaceChildren(shell);
  panel.dataset.gameMenuBuilt = 'true';
  panel.setAttribute('aria-label', 'In-game menu');

  const removeDimensionGuard = installDimensionGuard(target, panel);
  target.__tlrInGameMenuDestroy = () => {
    removeDimensionGuard();
    target.__tlrInGameMenuInstalled = false;
  };

  target.requestAnimationFrame(() => {
    target.tlrFitDrawerHeights?.();
    target.requestAnimationFrame(() => target.tlrFitDrawerHeights?.());
  });
}
