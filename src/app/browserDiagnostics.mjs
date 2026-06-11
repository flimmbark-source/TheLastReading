import { installArchitectureBridge, uninstallArchitectureBridge } from './bootstrap.mjs';
import { ACTIONS } from '../game/actions.mjs';
import { publicRunSnapshot } from '../game/selectors.mjs';

function renderLine(label, value) {
  return `<dt>${label}</dt><dd><code>${String(value)}</code></dd>`;
}

function renderState(target, runtime) {
  const state = runtime.store.getState();
  const snapshot = publicRunSnapshot(state);
  target.innerHTML = `
    <dl>
      ${renderLine('phase', snapshot.phase)}
      ${renderLine('reading', snapshot.reading)}
      ${renderLine('threshold', snapshot.threshold)}
      ${renderLine('reserve', snapshot.reserve)}
      ${renderLine('totalScore', snapshot.totalScore)}
      ${renderLine('handCount', snapshot.handCount)}
      ${renderLine('deckCount', snapshot.deckCount)}
      ${renderLine('discardCount', snapshot.discardCount)}
      ${renderLine('spreadCount', snapshot.spreadCount)}
      ${renderLine('discards', snapshot.discards)}
      ${renderLine('canDiscard', snapshot.canDiscard)}
      ${renderLine('canScore', snapshot.canScore)}
    </dl>
  `;
}

export function installBrowserDiagnostics(target = document) {
  const output = target.getElementById('diagnosticsOutput');
  const log = target.getElementById('diagnosticsLog');
  const startButton = target.getElementById('startReadingButton');
  const uninstallButton = target.getElementById('uninstallBridgeButton');

  if (!output || !log || !startButton || !uninstallButton) {
    throw new Error('Missing diagnostics elements.');
  }

  const runtime = installArchitectureBridge(window, {
    saveKey: 'tlr_architecture_diagnostics_save',
  });

  const writeLog = message => {
    const line = document.createElement('div');
    line.textContent = message;
    log.prepend(line);
  };

  const unsubscribe = runtime.store.subscribe((_state, _previous, action) => {
    writeLog(`dispatched ${action.type}`);
    renderState(output, runtime);
  });

  startButton.addEventListener('click', () => {
    runtime.store.dispatch({ type: ACTIONS.START_READING });
  });

  uninstallButton.addEventListener('click', () => {
    unsubscribe();
    uninstallArchitectureBridge(window);
    writeLog('bridge uninstalled');
    output.innerHTML = '<p>Bridge uninstalled.</p>';
  });

  renderState(output, runtime);
  writeLog('bridge installed');
  return runtime;
}

if (typeof document !== 'undefined') {
  installBrowserDiagnostics(document);
}
