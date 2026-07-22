const FORM_NAME = 'player-feedback';
const STYLE_ID = 'tlrPlayerFeedbackStyles';

function installStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@layer screens.main-menu {
  .main-menu-feedback-btn{position:absolute;top:max(16px,env(safe-area-inset-top));left:max(16px,env(safe-area-inset-left));z-index:6;height:44px;padding:0 15px;border:1px solid rgba(224,195,109,.38);border-radius:999px;background:linear-gradient(180deg,rgba(24,16,9,.78),rgba(7,5,3,.88));color:#d8ba75;font:700 11px/1 Georgia,serif;letter-spacing:.08em;text-transform:uppercase;text-shadow:0 1px 3px #000;box-shadow:0 4px 12px rgba(0,0,0,.28);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s ease,border-color .15s ease,color .15s ease,transform .12s ease}
  .main-menu-feedback-btn:hover{border-color:rgba(240,213,138,.72);background:linear-gradient(180deg,rgba(36,24,12,.88),rgba(10,7,4,.94));color:#f0d58a}
  .main-menu-feedback-btn:active{transform:scale(.96)}
  .main-menu-feedback-btn:focus-visible,.main-menu-feedback-sheet button:focus-visible{outline:2px solid #e0c36d;outline-offset:3px}
  .main-menu-feedback-backdrop{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:max(18px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));box-sizing:border-box;background:rgba(2,1,1,.78);backdrop-filter:blur(5px);animation:mainMenuFeedbackFade .18s ease-out}
  .main-menu-feedback-backdrop[hidden]{display:none}
  .main-menu-feedback-sheet{position:relative;width:min(430px,100%);max-height:100%;overflow:auto;box-sizing:border-box;padding:30px 26px 24px;border:1px solid rgba(224,195,109,.55);border-radius:18px;background:radial-gradient(circle at 50% 0,rgba(88,56,22,.24),transparent 42%),linear-gradient(180deg,rgba(24,16,10,.98),rgba(7,5,4,.99));box-shadow:0 22px 70px rgba(0,0,0,.72),inset 0 0 0 1px rgba(255,232,166,.06);color:#e6d4ad;animation:mainMenuFeedbackRise .2s ease-out}
  .main-menu-feedback-close{position:absolute;top:12px;right:12px;width:34px;height:34px;border:1px solid rgba(224,195,109,.25);border-radius:50%;background:rgba(0,0,0,.24);color:#c9aa66;font:700 14px/1 system-ui,sans-serif;cursor:pointer}
  .main-menu-feedback-kicker{margin-bottom:8px;color:#a98b52;font:700 10px/1 Georgia,serif;letter-spacing:.22em;text-transform:uppercase}
  .main-menu-feedback-sheet h2{margin:0;color:#f0d58a;font:700 25px/1.1 Georgia,serif;text-shadow:0 2px 8px #000}
  .main-menu-feedback-intro{margin:10px 0 20px;color:#c9b892;font:400 14px/1.45 Georgia,serif}
  .main-menu-feedback-field{display:block;margin-top:14px;color:#d8c49a;font:700 11px/1 Georgia,serif;letter-spacing:.08em;text-transform:uppercase}
  .main-menu-feedback-field small{color:#8f8064;font-size:9px;letter-spacing:.04em;text-transform:none}
  .main-menu-feedback-field textarea,.main-menu-feedback-field input{display:block;width:100%;box-sizing:border-box;margin-top:8px;border:1px solid rgba(224,195,109,.28);border-radius:10px;background:rgba(1,1,1,.42);color:#f1e4ca;font:400 15px/1.45 Georgia,serif;outline:none;box-shadow:inset 0 2px 8px rgba(0,0,0,.36)}
  .main-menu-feedback-field textarea{min-height:132px;resize:vertical;padding:12px 13px}
  .main-menu-feedback-field input{height:44px;padding:0 13px}
  .main-menu-feedback-field textarea:focus,.main-menu-feedback-field input:focus{border-color:rgba(240,213,138,.76);box-shadow:0 0 0 2px rgba(224,195,109,.1),inset 0 2px 8px rgba(0,0,0,.36)}
  .main-menu-feedback-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
  .main-menu-feedback-status{min-height:18px;margin:13px 0 0;color:#a99a7c;font:600 12px/1.35 system-ui,sans-serif}
  .main-menu-feedback-status[data-state="success"]{color:#b8d49a}
  .main-menu-feedback-status[data-state="error"]{color:#e5a08f}
  .main-menu-feedback-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
  .main-menu-feedback-actions button{height:42px;border-radius:999px;padding:0 18px;font:700 11px/1 Georgia,serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer}
  .main-menu-feedback-cancel{border:1px solid rgba(224,195,109,.25);background:transparent;color:#ad9770}
  .main-menu-feedback-send{border:1px solid rgba(243,213,132,.7);background:linear-gradient(180deg,#d8b963,#8f682b);color:#271507;box-shadow:0 4px 12px rgba(0,0,0,.34)}
  .main-menu-feedback-actions button:disabled{opacity:.55;cursor:wait}
  @keyframes mainMenuFeedbackFade{from{opacity:0}to{opacity:1}}
  @keyframes mainMenuFeedbackRise{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}
  @media(max-height:620px){.main-menu-feedback-sheet{padding-top:24px}.main-menu-feedback-field textarea{min-height:92px}}
  @media(prefers-reduced-motion:reduce){.main-menu-feedback-btn{transition:none}.main-menu-feedback-backdrop,.main-menu-feedback-sheet{animation:none}}
}`;
  doc.head.appendChild(style);
}

function feedbackMarkup() {
  return `
    <button id="mainMenuFeedbackBtn" class="main-menu-feedback-btn" type="button" aria-haspopup="dialog" aria-expanded="false">Feedback</button>
    <div id="mainMenuFeedback" class="main-menu-feedback-backdrop" hidden aria-hidden="true">
      <section class="main-menu-feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="mainMenuFeedbackTitle">
        <button id="mainMenuFeedbackClose" class="main-menu-feedback-close" type="button" aria-label="Close feedback form">&#10005;</button>
        <div class="main-menu-feedback-kicker">Player Notes</div>
        <h2 id="mainMenuFeedbackTitle">Leave Feedback</h2>
        <p class="main-menu-feedback-intro">Tell me what worked, what was confusing, or what broke.</p>
        <form id="mainMenuFeedbackForm" name="${FORM_NAME}">
          <input type="hidden" name="form-name" value="${FORM_NAME}">
          <input type="hidden" name="source" value="main-menu">
          <input type="hidden" name="page"><input type="hidden" name="mode">
          <input type="hidden" name="viewport"><input type="hidden" name="user-agent">
          <label class="main-menu-feedback-field"><span>Feedback</span><textarea name="feedback" maxlength="3000" required placeholder="What happened?"></textarea></label>
          <label class="main-menu-feedback-field"><span>Email <small>(optional)</small></span><input name="email" type="email" maxlength="200" autocomplete="email" placeholder="So I can follow up"></label>
          <label class="main-menu-feedback-honeypot" aria-hidden="true">Leave this empty<input name="bot-field" type="text" tabindex="-1" autocomplete="off"></label>
          <p id="mainMenuFeedbackStatus" class="main-menu-feedback-status" aria-live="polite"></p>
          <div class="main-menu-feedback-actions"><button id="mainMenuFeedbackCancel" class="main-menu-feedback-cancel" type="button">Cancel</button><button id="mainMenuFeedbackSend" class="main-menu-feedback-send" type="submit">Send Feedback</button></div>
        </form>
      </section>
    </div>`;
}

export function installPlayerFeedback(target = window) {
  const doc = target?.document;
  if (!doc || target.__tlrPlayerFeedbackInstalled) return;
  const menu = doc.getElementById('mainMenu');
  if (!menu) {
    doc.addEventListener('DOMContentLoaded', () => installPlayerFeedback(target), { once: true });
    return;
  }

  installStyles(doc);
  menu.insertAdjacentHTML('beforeend', feedbackMarkup());
  const button = doc.getElementById('mainMenuFeedbackBtn');
  const backdrop = doc.getElementById('mainMenuFeedback');
  const sheet = backdrop?.querySelector('.main-menu-feedback-sheet');
  const form = doc.getElementById('mainMenuFeedbackForm');
  const closeButton = doc.getElementById('mainMenuFeedbackClose');
  const cancelButton = doc.getElementById('mainMenuFeedbackCancel');
  const sendButton = doc.getElementById('mainMenuFeedbackSend');
  const status = doc.getElementById('mainMenuFeedbackStatus');
  const textarea = form?.elements?.feedback;
  if (!button || !backdrop || !sheet || !form || !closeButton || !cancelButton || !sendButton || !status || !textarea) return;
  target.__tlrPlayerFeedbackInstalled = true;

  let returnFocus = null;
  const setStatus = (message = '', state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const close = () => {
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');
    doc.body.classList.remove('main-menu-feedback-open');
    const focusTarget = returnFocus;
    returnFocus = null;
    focusTarget?.focus?.();
  };
  const open = () => {
    returnFocus = doc.activeElement;
    setStatus();
    backdrop.hidden = false;
    backdrop.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    doc.body.classList.add('main-menu-feedback-open');
    (target.requestAnimationFrame || target.setTimeout)?.(() => textarea.focus());
  };

  target.tlrOpenPlayerFeedback = open;
  target.tlrClosePlayerFeedback = close;
  button.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  cancelButton.addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  sheet.addEventListener('click', event => event.stopPropagation());
  doc.addEventListener('keydown', event => { if (event.key === 'Escape' && !backdrop.hidden) close(); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!String(textarea.value || '').trim()) {
      setStatus('Write a message before sending.', 'error');
      textarea.focus();
      return;
    }
    form.elements.page.value = target.location?.href || '';
    form.elements.mode.value = menu.querySelector('.main-menu-hub')?.dataset.activeTab || 'reading';
    form.elements.viewport.value = `${target.innerWidth || 0}x${target.innerHeight || 0}`;
    form.elements['user-agent'].value = target.navigator?.userAgent || '';
    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';
    setStatus('Sending your feedback...', 'pending');
    try {
      const body = new target.URLSearchParams(new target.FormData(form)).toString();
      const response = await target.fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (!response.ok) throw new Error(`Feedback submission returned ${response.status}`);
      form.reset();
      setStatus('Thanks — your feedback was sent.', 'success');
    } catch (error) {
      console.error('The Last Reading feedback submission failed.', error);
      setStatus('Could not send your feedback. Check your connection and try again.', 'error');
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = 'Send Feedback';
    }
  });
}
