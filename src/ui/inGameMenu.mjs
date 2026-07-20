const STYLE_ID = 'in-game-menu-style';
const STYLE_HREF = '/src/styles/components/inGameMenu.css?v=1';

function ensureStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  document.head.appendChild(link);
}

function makeHeading(document, icon, label) {
  const heading = document.createElement('h3');
  heading.className = 'game-menu-section-heading';

  const iconElement = document.createElement('span');
  iconElement.className = 'game-menu-section-icon';
  iconElement.setAttribute('aria-hidden', 'true');
  iconElement.textContent = icon;

  const text = document.createElement('span');
  text.textContent = label;

  heading.append(iconElement, text);
  return heading;
}

function makeSection(document, className, icon, label) {
  const section = document.createElement('section');
  section.className = `game-menu-section ${className}`;
  section.appendChild(makeHeading(document, icon, label));
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

  const speaker = document.createElement('span');
  speaker.className = 'game-menu-speaker';
  speaker.setAttribute('aria-hidden', 'true');
  speaker.textContent = '◖))';

  row.append(label, input, speaker);
  updateRangeFill(input);
  input.addEventListener('input', () => updateRangeFill(input));
  return row;
}

function decorateToggle(document, originalLabel, input, fallbackText) {
  const labelText = [...originalLabel.childNodes]
    .filter(node => node.nodeType === 3)
    .map(node => node.textContent || '')
    .join(' ')
    .trim() || fallbackText;

  const text = document.createElement('span');
  text.textContent = labelText;
  originalLabel.className = 'game-menu-toggle';
  originalLabel.replaceChildren(text, input);
  return originalLabel;
}

function decorateRowButton(document, button, icon, options = {}) {
  const labelText = options.label || button.textContent.trim();
  button.className = `game-menu-row${options.subtle ? ' game-menu-row--subtle' : ''}`;

  const iconElement = document.createElement('span');
  iconElement.className = 'game-menu-row-icon';
  iconElement.setAttribute('aria-hidden', 'true');
  iconElement.textContent = icon;

  const label = document.createElement('span');
  label.className = 'game-menu-row-label';
  label.textContent = labelText;

  const chevron = document.createElement('span');
  chevron.className = 'game-menu-row-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = options.chevron === false ? '' : '›';

  button.replaceChildren(iconElement, label, chevron);
  return button;
}

function decorateMajorButton(document, button, icon, modifier) {
  const labelText = button.textContent.trim();
  button.className = `game-menu-major-action game-menu-major-action--${modifier}`;

  const iconElement = document.createElement('span');
  iconElement.className = 'game-menu-row-icon';
  iconElement.setAttribute('aria-hidden', 'true');
  iconElement.textContent = icon;

  const label = document.createElement('span');
  label.className = 'game-menu-row-label';
  label.textContent = labelText;

  button.replaceChildren(iconElement, label);
  return button;
}

function ensureGlossaryButton(target, panel) {
  const document = target.document;
  let button = document.getElementById('gameTermsGlossaryButton');
  if (button) return button;

  // gameTerms.mjs installs after the SPv2 skin. Creating the button here keeps
  // its expected ID available, so that module does not try to insert it beside
  // a Replay button that has already been moved into the structured menu.
  button = document.createElement('button');
  button.id = 'gameTermsGlossaryButton';
  button.type = 'button';
  button.textContent = 'Game Terms';
  button.addEventListener('click', () => target.tlrOpenGameTermsGlossary?.());
  panel.appendChild(button);
  return button;
}

function installDimensionGuard(target, panel) {
  const wrap = target.document.getElementById('menuPullWrap');
  if (!wrap) return () => {};

  let scheduled = 0;
  const apply = () => {
    scheduled = 0;
    const narrow = target.innerWidth <= 520;
    const drawerHeight = narrow ? 'calc(100dvh - 46px)' : 'min(94dvh, 900px)';
    const panelWidth = narrow ? 'calc(100vw - 12px)' : 'min(94vw, 620px)';

    if (wrap.style.getPropertyValue('--tlr-drawer-h') !== drawerHeight
      || wrap.style.getPropertyPriority('--tlr-drawer-h') !== 'important') {
      wrap.style.setProperty('--tlr-drawer-h', drawerHeight, 'important');
    }
    if (panel.style.getPropertyValue('max-width') !== panelWidth
      || panel.style.getPropertyPriority('max-width') !== 'important') {
      panel.style.setProperty('max-width', panelWidth, 'important');
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = target.requestAnimationFrame(apply);
  };

  // gestureDrawers measures every drawer and writes a compact numeric height
  // inline whenever Menu opens or the viewport changes. Restore the dedicated
  // menu dimensions after that write without adding marked-important CSS.
  const observer = new MutationObserver(schedule);
  observer.observe(wrap, { attributes: true, attributeFilter: ['style'] });
  target.addEventListener('resize', schedule, { passive: true });
  apply();

  return () => {
    observer.disconnect();
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

  const audio = makeSection(document, 'game-menu-audio', '◖))', 'Audio');
  audio.append(
    makeRangeRow(document, music, 'Music'),
    makeRangeRow(document, effects, 'Effects'),
  );

  const assistance = makeSection(document, 'game-menu-assistance', '♠', 'Assistance');
  const hintsRow = document.createElement('div');
  hintsRow.className = 'game-menu-setting-row game-menu-hints-row';
  const hintsLabel = document.createElement('span');
  hintsLabel.className = 'game-menu-control-label';
  hintsLabel.textContent = 'Scoring hints';
  hintsRow.append(hintsLabel, hintLevelBar);
  assistance.appendChild(hintsRow);

  const assistanceOptions = document.createElement('div');
  assistanceOptions.className = 'game-menu-assistance-options';
  if (relicHints?.parentElement) {
    assistanceOptions.appendChild(decorateToggle(document, relicHints.parentElement, relicHints, 'Relic hints'));
  }
  if (candlelight?.parentElement) {
    assistanceOptions.appendChild(decorateToggle(document, candlelight.parentElement, candlelight, 'Candlelight lighting'));
  }
  if (assistanceOptions.childElementCount) assistance.appendChild(assistanceOptions);

  const game = makeSection(document, 'game-menu-game', '♣', 'Game');
  const gameList = document.createElement('div');
  gameList.className = 'game-menu-list';
  gameList.append(
    decorateRowButton(document, glossary, '▤', { label: 'Game Terms' }),
    decorateRowButton(document, replay, '⌂', { label: 'Replay Tutorial' }),
  );
  if (reset) gameList.appendChild(decorateRowButton(document, reset, '↺', { subtle: true }));
  game.appendChild(gameList);

  const actions = document.createElement('footer');
  actions.className = 'game-menu-actions';
  actions.append(
    decorateMajorButton(document, getUp, '⌂', 'attic'),
    decorateMajorButton(document, returnToMenu, '▥', 'return'),
  );

  shell.append(header, audio, assistance, game, actions);
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
