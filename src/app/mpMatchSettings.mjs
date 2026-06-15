import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_SHUFFLE_MODES } from '../multiplayer/mpReducer.mjs';

const STORAGE_KEY = 'tlr_mm_shuffle';

function normalizeShuffleMode(value) {
  return value === MP_SHUFFLE_MODES.WHEN_EMPTY ? MP_SHUFFLE_MODES.WHEN_EMPTY : MP_SHUFFLE_MODES.EACH_ROUND;
}

function readShuffleMode(target = window) {
  try { return normalizeShuffleMode(target.localStorage?.getItem(STORAGE_KEY)); }
  catch (_) { return MP_SHUFFLE_MODES.EACH_ROUND; }
}

function writeShuffleMode(target = window, value) {
  const mode = normalizeShuffleMode(value);
  try { target.localStorage?.setItem(STORAGE_KEY, mode); } catch (_) {}
  target.__tlrMpShuffleMode = mode;
  return mode;
}

function installStyle(doc) {
  if (!doc || doc.getElementById('mp-match-settings-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-match-settings-style';
  style.textContent = `
    #matchmakingScreen .mm-inner{min-height:100dvh!important}
    #matchmakingScreen .mm-content-with-footer{display:flex;flex-direction:column;gap:18px;flex:1;min-height:0}
    #matchmakingScreen .mm-settings-stack{display:flex;flex-direction:column;gap:16px}
    #matchmakingScreen .mm-action-footer{margin-top:auto;display:flex;flex-direction:column;gap:10px;padding-top:18px}
    #matchmakingScreen .mm-action-footer .mm-mode-row{margin-top:0}
    #matchmakingScreen .mm-shuffle-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:rgba(12,8,5,.55);border:1px solid rgba(140,100,50,.2);border-radius:10px;padding:5px}
    #matchmakingScreen .mm-shuffle-btn{border:1px solid transparent;border-radius:8px;background:transparent;color:#8a7551;padding:11px 10px;font:800 11px/1.1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;display:flex;flex-direction:column;gap:5px;align-items:center;justify-content:center}
    #matchmakingScreen .mm-shuffle-btn span{font:600 10px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:none;color:#6a5535}
    #matchmakingScreen .mm-shuffle-btn.selected{background:rgba(28,18,8,.95);border-color:rgba(255,217,120,.72);box-shadow:0 0 0 1px rgba(255,217,120,.34);color:#ffd978}
    #matchmakingScreen .mm-shuffle-btn.selected span{color:#b09060}
    #matchmakingScreen .mm-host-settings-note{font:600 10px/1.35 system-ui,sans-serif;color:#6a5535;text-align:center;letter-spacing:.04em;margin-top:-2px}
  `;
  doc.head.appendChild(style);
}

function shuffleSectionHtml(mode) {
  const eachSelected = mode === MP_SHUFFLE_MODES.EACH_ROUND ? ' selected' : '';
  const emptySelected = mode === MP_SHUFFLE_MODES.WHEN_EMPTY ? ' selected' : '';
  return `
    <div class="mm-match-section mm-shuffle-section" data-mp-settings="shuffle">
      <h3 class="mm-section-label">Shuffle</h3>
      <div class="mm-shuffle-toggle" role="group" aria-label="Shuffle">
        <button class="mm-shuffle-btn${eachSelected}" type="button" onclick="tlrMmSetShuffle('${MP_SHUFFLE_MODES.EACH_ROUND}')">Each Round<span>Fresh deck each set</span></button>
        <button class="mm-shuffle-btn${emptySelected}" type="button" onclick="tlrMmSetShuffle('${MP_SHUFFLE_MODES.WHEN_EMPTY}')">When Empty<span>Continuous deck</span></button>
      </div>
      <div class="mm-host-settings-note">Only the host's match settings are used.</div>
    </div>
  `;
}

function isIdleMatchmaking(content) {
  return !!content?.querySelector?.('.mm-mode-row') && !!content.querySelector('.mm-cpu-row') && !!content.querySelector('.mm-targets');
}

function enhanceIdleScreen(target = window) {
  const doc = target.document;
  const content = doc?.getElementById('mmContent');
  if (!content || !isIdleMatchmaking(content)) return;

  const mode = readShuffleMode(target);

  let wrapper = content.querySelector('.mm-content-with-footer');
  if (!wrapper) {
    const nodes = [...content.childNodes];
    const settingsStack = doc.createElement('div');
    settingsStack.className = 'mm-settings-stack';
    const footer = doc.createElement('div');
    footer.className = 'mm-action-footer';
    wrapper = doc.createElement('div');
    wrapper.className = 'mm-content-with-footer';

    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) continue;
      if (node.nodeType === Node.ELEMENT_NODE && (node.classList.contains('mm-mode-row') || node.classList.contains('mm-cpu-row'))) footer.appendChild(node);
      else settingsStack.appendChild(node);
    }

    wrapper.append(settingsStack, footer);
    content.textContent = '';
    content.appendChild(wrapper);
  }

  const settingsStack = wrapper.querySelector('.mm-settings-stack') || wrapper;
  const existing = settingsStack.querySelector('.mm-shuffle-section');
  if (existing) existing.outerHTML = shuffleSectionHtml(mode);
  else settingsStack.insertAdjacentHTML('beforeend', shuffleSectionHtml(mode));
}

function enhanceWhenReady(target = window) {
  const run = () => enhanceIdleScreen(target);
  run();
  target.requestAnimationFrame?.(run);
  target.setTimeout?.(run, 0);
}

export function installMpMatchSettings(target = window) {
  if (!target || target.__tlrMpMatchSettingsInstalled) return;
  target.__tlrMpMatchSettingsInstalled = true;

  installStyle(target.document);
  target.__tlrMpShuffleMode = readShuffleMode(target);

  target.tlrMmSetShuffle = function (value) {
    writeShuffleMode(target, value);
    enhanceWhenReady(target);
  };

  const wrapShow = () => {
    const original = target.tlrShowMatchmaking;
    if (typeof original !== 'function' || original.__tlrMpMatchSettingsWrapped) return false;
    function wrapped(profile) {
      const nextProfile = { ...(profile || {}), shuffleMode: readShuffleMode(target) };
      const result = original.call(this, nextProfile);
      enhanceWhenReady(target);
      return result;
    }
    wrapped.__tlrMpMatchSettingsWrapped = true;
    target.tlrShowMatchmaking = wrapped;
    return true;
  };

  const wrapDispatch = () => {
    const original = target.tlrMpDispatch;
    if (typeof original !== 'function' || original.__tlrMpMatchSettingsWrapped) return false;
    function wrapped(action) {
      let nextAction = action;
      if (action?.type === MP_ACTIONS.MP_INIT) {
        // Only the host/CPU can send MP_INIT. Guests may choose local UI settings,
        // but the match follows the host-authored init action.
        nextAction = { ...action, shuffleMode: readShuffleMode(target) };
      }
      return original.call(this, nextAction);
    }
    wrapped.__tlrMpMatchSettingsWrapped = true;
    target.tlrMpDispatch = wrapped;
    return true;
  };

  wrapShow();
  wrapDispatch();
  target.setTimeout?.(wrapShow, 0);
  target.setTimeout?.(wrapDispatch, 0);
  target.setTimeout?.(wrapDispatch, 500);
  target.setTimeout?.(wrapDispatch, 1500);
}

if (typeof window !== 'undefined') {
  const install = () => installMpMatchSettings(window);
  install();
  window.setTimeout?.(install, 0);
  window.setTimeout?.(install, 500);
  window.setTimeout?.(install, 1500);
}
