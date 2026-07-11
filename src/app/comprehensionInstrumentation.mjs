const STUDY_PARAM = 'termstudy';
const STORAGE_KEY = 'tlr_term_study_sessions';
const ACTIVE_KEY = 'tlr_term_study_active';

function now() {
  return Math.round(performance.now());
}

function safeRead(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(storage, sessions) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-20))); } catch {}
}

export function installComprehensionInstrumentation(target = window) {
  if (!target?.document || target.__tlrComprehensionInstrumentationInstalled) return;
  target.__tlrComprehensionInstrumentationInstalled = true;

  const params = new URLSearchParams(target.location?.search || '');
  const enabled = params.get(STUDY_PARAM) === '1' || target.localStorage?.getItem(ACTIVE_KEY) === '1';
  if (!enabled) {
    target.tlrEnableComprehensionStudy = () => {
      try { target.localStorage.setItem(ACTIVE_KEY, '1'); } catch {}
      return true;
    };
    return;
  }

  try { target.localStorage.setItem(ACTIVE_KEY, '1'); } catch {}
  const session = {
    version: 1,
    startedAt: new Date().toISOString(),
    viewport: { width: target.innerWidth, height: target.innerHeight },
    events: [],
  };

  const record = (type, detail = {}) => {
    session.events.push({ type, atMs: now(), ...detail });
  };

  const listeners = [
    ['tlr:term-open', event => record('term-open', event.detail || {})],
    ['tlr:glossary-open', () => record('glossary-open')],
    ['tlr:tutorial-step', event => record('tutorial-step', event.detail || {})],
    ['tlr:tutorial-complete', event => record('tutorial-complete', event.detail || {})],
  ];
  listeners.forEach(([name, handler]) => target.addEventListener(name, handler));

  target.document.addEventListener('pointerdown', event => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    if (element.closest('#discardBtn')) record('discard-control');
    if (element.closest('#spread .slot')) record('spread-slot');
    if (element.closest('#scoringBtn,#scoringPullTab')) record('scoring-reference-open');
    if (element.closest('#abilitiesBtn,#abilitiesPullTab')) record('ability-reference-open');
  }, true);

  const persist = () => {
    const sessions = safeRead(target.localStorage);
    const snapshot = { ...session, endedAt: new Date().toISOString() };
    const existing = sessions.findIndex(item => item.startedAt === snapshot.startedAt);
    if (existing >= 0) sessions[existing] = snapshot;
    else sessions.push(snapshot);
    safeWrite(target.localStorage, sessions);
    return snapshot;
  };

  target.addEventListener('pagehide', persist);
  target.tlrExportComprehensionStudy = () => JSON.stringify({
    current: persist(),
    sessions: safeRead(target.localStorage),
  }, null, 2);
  target.tlrClearComprehensionStudy = () => {
    try {
      target.localStorage.removeItem(STORAGE_KEY);
      target.localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  };
  target.tlrComprehensionStudy = session;
  record('study-start');
}
